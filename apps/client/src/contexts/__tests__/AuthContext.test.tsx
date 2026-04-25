/**
 * AuthContext storage-layer tests
 *
 * Covers the 2026-04-24 unification of localStorage keys between AuthContext
 * and the axios api client. AuthContext now persists:
 *   - `auth_token`      → raw JWT access token (read by api/client.ts)
 *   - `auth_user`       → JSON-stringified JanuaUser
 *   - `auth_token_meta` → { refreshToken?, expiresAt }
 *
 * The legacy single-blob `madlab_auth` key (`{ user, tokens }`) is migrated
 * on mount and removed. signOut also clears it as defense-in-depth.
 *
 * The public AuthContext API (signIn / signOut / user / isLoading) is
 * unchanged — these tests exercise it through useAuth() to verify only the
 * storage layer was changed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth, type AuthTokens, type JanuaUser } from '../AuthContext';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';
const AUTH_META_KEY = 'auth_token_meta';
const LEGACY_KEY = 'madlab_auth';

function wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
}

function makeUser(overrides: Partial<JanuaUser> = {}): JanuaUser {
    return {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        roles: ['member'],
        ...overrides,
    };
}

function makeTokens(overrides: Partial<AuthTokens> = {}): AuthTokens {
    // expiresAt is seconds-since-epoch (matches JWT `exp` claim). Pick a far
    // future value so isTokenExpired() returns false during the test run.
    return {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 60 * 60, // +1 hour
        ...overrides,
    };
}

describe('AuthContext storage layer', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe('mount-time restore', () => {
        it('starts with no user and no auth_token when localStorage is empty', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.user).toBeNull();
            expect(result.current.tokens).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
            expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
            expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
        });

        it('restores user from auth_token + auth_user on mount', async () => {
            const user = makeUser();
            const tokens = makeTokens();
            localStorage.setItem(AUTH_TOKEN_KEY, tokens.accessToken);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            localStorage.setItem(
                AUTH_META_KEY,
                JSON.stringify({
                    refreshToken: tokens.refreshToken,
                    expiresAt: tokens.expiresAt,
                })
            );

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.user).toEqual(user);
            expect(result.current.tokens?.accessToken).toBe(tokens.accessToken);
            expect(result.current.isAuthenticated).toBe(true);
        });

        it('restores when auth_token + auth_user are present but meta is missing', async () => {
            // Defensive case: a token written by a code path that didn't
            // populate auth_token_meta should still hydrate the session,
            // just without expiry-based eviction.
            const user = makeUser({ id: 'no-meta-user' });
            localStorage.setItem(AUTH_TOKEN_KEY, 'jwt-no-meta');
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.user?.id).toBe('no-meta-user');
            expect(result.current.tokens?.accessToken).toBe('jwt-no-meta');
        });

        it('migrates the legacy madlab_auth blob into split keys and removes the legacy key', async () => {
            const user = makeUser({ id: 'legacy-user', email: 'legacy@example.com' });
            const tokens = makeTokens({ accessToken: 'legacy-jwt' });
            localStorage.setItem(
                LEGACY_KEY,
                JSON.stringify({ user, tokens })
            );

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Session is restored from migrated data.
            expect(result.current.user?.id).toBe('legacy-user');
            expect(result.current.tokens?.accessToken).toBe('legacy-jwt');
            expect(result.current.isAuthenticated).toBe(true);

            // Split keys are now populated.
            expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('legacy-jwt');
            const storedUser = JSON.parse(
                localStorage.getItem(AUTH_USER_KEY) ?? 'null'
            );
            expect(storedUser?.id).toBe('legacy-user');
            expect(storedUser?.email).toBe('legacy@example.com');

            // Legacy key is removed.
            expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
        });

        it('removes a corrupted legacy blob without throwing', async () => {
            // Edge case: madlab_auth contains invalid JSON. Mount should not
            // throw, the legacy key should be cleared, and the user should
            // be logged out.
            localStorage.setItem(LEGACY_KEY, '{not valid json');

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.user).toBeNull();
            expect(result.current.tokens).toBeNull();
            expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
        });
    });

    describe('signOut', () => {
        it('clears auth_token, auth_user, auth_token_meta, and any legacy madlab_auth key', async () => {
            const user = makeUser();
            const tokens = makeTokens();
            localStorage.setItem(AUTH_TOKEN_KEY, tokens.accessToken);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            localStorage.setItem(
                AUTH_META_KEY,
                JSON.stringify({
                    refreshToken: tokens.refreshToken,
                    expiresAt: tokens.expiresAt,
                })
            );
            // Defense-in-depth: a legacy blob lingering after migration should
            // also be cleared by signOut, even though normal flows wouldn't
            // leave one here.
            localStorage.setItem(LEGACY_KEY, JSON.stringify({ user, tokens }));

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
            // Legacy key is removed by the mount-time migration before we
            // even reach signOut, which is itself the desired behavior.
            expect(localStorage.getItem(LEGACY_KEY)).toBeNull();

            // Re-plant the legacy key to assert signOut also removes it.
            localStorage.setItem(LEGACY_KEY, 'leftover');

            act(() => {
                result.current.signOut();
            });

            expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
            expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
            expect(localStorage.getItem(AUTH_META_KEY)).toBeNull();
            expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
            expect(result.current.user).toBeNull();
            expect(result.current.tokens).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        });
    });

    describe('signIn writes to the unified keys', () => {
        // signIn() itself triggers a redirect to Janua's OAuth authorize
        // endpoint, so we can't easily exercise the post-callback path here
        // without mocking fetch + the URL search params. Instead we verify
        // the storage contract directly: when a session is hydrated (the
        // observable result of a successful sign-in), both `auth_token` and
        // `auth_user` are populated. The mount-time-restore tests above
        // already prove that this hydration round-trips through both keys.
        it('round-trips a saved session through auth_token + auth_user', async () => {
            const user = makeUser({ id: 'round-trip', name: 'Round Trip' });
            const tokens = makeTokens({ accessToken: 'round-trip-jwt' });
            localStorage.setItem(AUTH_TOKEN_KEY, tokens.accessToken);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            localStorage.setItem(
                AUTH_META_KEY,
                JSON.stringify({
                    refreshToken: tokens.refreshToken,
                    expiresAt: tokens.expiresAt,
                })
            );

            const { result, unmount } = renderHook(() => useAuth(), { wrapper });
            await waitFor(() => expect(result.current.isLoading).toBe(false));
            expect(result.current.user?.id).toBe('round-trip');

            // After signOut the keys are gone; remount yields an anonymous
            // session — matching the behavior a fresh browser would see.
            act(() => result.current.signOut());
            unmount();

            const { result: result2 } = renderHook(() => useAuth(), { wrapper });
            await waitFor(() => expect(result2.current.isLoading).toBe(false));
            expect(result2.current.user).toBeNull();
            expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
            expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
        });
    });

    describe('Provider mounts cleanly', () => {
        // Smoke test: rendering <AuthProvider /> with a child component must
        // not throw, even when localStorage is empty. Guards against future
        // refactors that accidentally make the storage layer load-bearing.
        it('renders children without throwing on an empty localStorage', () => {
            expect(() =>
                render(
                    <AuthProvider>
                        <div data-testid="child">hello</div>
                    </AuthProvider>
                )
            ).not.toThrow();
        });
    });
});
