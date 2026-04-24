/**
 * API Client interceptor tests
 *
 * Covers the auth-related behavior added in 2026-04-24:
 *   - Request interceptor attaches `Authorization: Bearer <token>` when a
 *     token is present in localStorage under `auth_token`.
 *   - Request interceptor leaves the header off when no token is stored.
 *   - Response interceptor on 401: clears `auth_token` + `auth_user` (and the
 *     legacy `madlab_auth` key) and triggers the registered logout handler.
 *   - Non-401 errors propagate without touching auth state.
 *
 * Strategy: replace the axios instance's `adapter` with a stub that returns
 * canned responses. This exercises the real interceptors end-to-end without
 * needing axios-mock-adapter or a real network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import apiClient, {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  setAuthLogoutHandler,
} from '../client';

const LEGACY_AUTH_KEY = 'madlab_auth';

/**
 * Build an axios adapter that captures the outgoing request config and
 * returns the canned response. Lets tests assert on headers and trigger
 * specific status codes.
 */
function makeAdapter(opts: {
  status: number;
  data?: unknown;
  onRequest?: (config: InternalAxiosRequestConfig) => void;
}): AxiosAdapter {
  return (config) => {
    opts.onRequest?.(config);
    if (opts.status >= 200 && opts.status < 300) {
      return Promise.resolve({
        data: opts.data ?? {},
        status: opts.status,
        statusText: 'OK',
        headers: {},
        config,
      });
    }
    // Build an axios-style error.
    const err: any = new Error(`Request failed with status code ${opts.status}`);
    err.isAxiosError = true;
    err.config = config;
    err.response = {
      data: opts.data ?? {},
      status: opts.status,
      statusText: 'Error',
      headers: {},
      config,
    };
    return Promise.reject(err);
  };
}

describe('apiClient interceptors', () => {
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    localStorage.clear();
    setAuthLogoutHandler(null);
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    setAuthLogoutHandler(null);
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('request interceptor', () => {
    it('attaches Bearer header when auth_token is in localStorage', async () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'test-jwt-abc');

      let capturedAuth: unknown;
      apiClient.defaults.adapter = makeAdapter({
        status: 200,
        data: { ok: true },
        onRequest: (cfg) => {
          capturedAuth = cfg.headers?.Authorization;
        },
      });

      await apiClient.get('/anything');

      expect(capturedAuth).toBe('Bearer test-jwt-abc');
    });

    it('does NOT attach Authorization header when no token is stored', async () => {
      // Ensure no token leaks in from prior tests.
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();

      let capturedAuth: unknown = 'sentinel';
      apiClient.defaults.adapter = makeAdapter({
        status: 200,
        data: { ok: true },
        onRequest: (cfg) => {
          capturedAuth = cfg.headers?.Authorization;
        },
      });

      await apiClient.get('/anything');

      // Header should be undefined (never set), not an empty string.
      expect(capturedAuth).toBeUndefined();
    });
  });

  describe('response interceptor — 401 handling', () => {
    it('clears auth_token, auth_user, and madlab_auth on 401', async () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'expired-token');
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: 'u1' }));
      localStorage.setItem(LEGACY_AUTH_KEY, JSON.stringify({ user: 'x' }));

      apiClient.defaults.adapter = makeAdapter({ status: 401 });

      await expect(apiClient.get('/protected')).rejects.toMatchObject({
        response: { status: 401 },
      });

      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
      expect(localStorage.getItem(LEGACY_AUTH_KEY)).toBeNull();
    });

    it('invokes the registered logout handler on 401', async () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'expired-token');
      const logoutSpy = vi.fn();
      setAuthLogoutHandler(logoutSpy);

      apiClient.defaults.adapter = makeAdapter({ status: 401 });

      await expect(apiClient.get('/protected')).rejects.toBeDefined();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to window.location redirect when no handler is registered', async () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'expired-token');
      // No handler registered (beforeEach cleared it).

      // jsdom's window.location.href is read/write but assignment doesn't
      // navigate; we can assert on the assigned value via a spy on the
      // setter. Simplest: mock the property.
      const hrefSetter = vi.fn();
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: new Proxy(originalLocation, {
          set(_target, prop, value) {
            if (prop === 'href') {
              hrefSetter(value);
              return true;
            }
            return Reflect.set(originalLocation, prop, value);
          },
          get(_target, prop) {
            return Reflect.get(originalLocation, prop);
          },
        }),
      });

      apiClient.defaults.adapter = makeAdapter({ status: 401 });

      try {
        await expect(apiClient.get('/protected')).rejects.toBeDefined();
        expect(hrefSetter).toHaveBeenCalledWith('/');
      } finally {
        Object.defineProperty(window, 'location', {
          configurable: true,
          value: originalLocation,
        });
      }
    });
  });

  describe('response interceptor — non-401 errors', () => {
    it('propagates 500 errors without clearing auth or invoking logout', async () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'still-valid');
      const logoutSpy = vi.fn();
      setAuthLogoutHandler(logoutSpy);

      apiClient.defaults.adapter = makeAdapter({ status: 500 });

      await expect(apiClient.get('/boom')).rejects.toMatchObject({
        response: { status: 500 },
      });

      expect(logoutSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('still-valid');
    });

    it('propagates 404 errors unchanged', async () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'still-valid');
      const logoutSpy = vi.fn();
      setAuthLogoutHandler(logoutSpy);

      apiClient.defaults.adapter = makeAdapter({ status: 404 });

      await expect(apiClient.get('/missing')).rejects.toMatchObject({
        response: { status: 404 },
      });

      expect(logoutSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('still-valid');
    });
  });
});
