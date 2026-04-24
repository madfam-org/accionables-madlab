/**
 * Janua Authentication Context
 *
 * Provides authentication state and methods for the MADLAB app.
 * Integrates with Janua IdP (https://github.com/madfam-io/janua)
 *
 * Usage:
 * ```tsx
 * import { useAuth } from '../contexts/AuthContext';
 *
 * function MyComponent() {
 *   const { user, isAuthenticated, signIn, signOut } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <button onClick={signIn}>Sign In</button>;
 *   }
 *
 *   return <p>Hello, {user?.name}</p>;
 * }
 * ```
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { setAuthLogoutHandler } from '../api/client';

// ============================================================================
// Types
// ============================================================================

export interface JanuaUser {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    emailVerified: boolean;
    orgId?: string;
    roles: string[];
}

export interface AuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
}

interface AuthContextValue {
    user: JanuaUser | null;
    tokens: AuthTokens | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    signIn: () => void;
    signOut: () => void;
    refreshSession: () => Promise<boolean>;
    hasRole: (role: string) => boolean;
}

interface AuthProviderProps {
    children: ReactNode;
    januaUrl?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'madlab_auth';
const JANUA_URL = import.meta.env.VITE_JANUA_URL || 'https://auth.enclii.com';

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// Helper Functions
// ============================================================================

function parseJWT(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - (base64.length % 4)) % 4);
        const payload = JSON.parse(atob(base64 + padding));

        return payload;
    } catch {
        return null;
    }
}

function isTokenExpired(expiresAt: number): boolean {
    // Add 30 second buffer
    return Date.now() >= (expiresAt - 30) * 1000;
}

function loadStoredAuth(): { user: JanuaUser; tokens: AuthTokens } | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const data = JSON.parse(stored);

        // Verify token isn't expired
        if (data.tokens && isTokenExpired(data.tokens.expiresAt)) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return data;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function saveAuth(user: JanuaUser, tokens: AuthTokens): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens }));
}

function clearAuth(): void {
    localStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// Provider Component
// ============================================================================

export function AuthProvider({ children, januaUrl = JANUA_URL }: AuthProviderProps) {
    const [user, setUser] = useState<JanuaUser | null>(null);
    const [tokens, setTokens] = useState<AuthTokens | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize auth state from storage
    useEffect(() => {
        const stored = loadStoredAuth();
        if (stored) {
            setUser(stored.user);
            setTokens(stored.tokens);
        }
        setIsLoading(false);
    }, []);

    // Handle OAuth callback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        if (code && state) {
            handleOAuthCallback(code, state);
        }
    }, []);

    const handleOAuthCallback = async (code: string, state: string) => {
        try {
            setIsLoading(true);
            setError(null);

            // Verify state matches stored state
            const storedState = sessionStorage.getItem('janua_oauth_state');
            if (state !== storedState) {
                throw new Error('Invalid OAuth state');
            }
            sessionStorage.removeItem('janua_oauth_state');

            // Exchange code for tokens
            const response = await fetch(`${januaUrl}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: window.location.origin,
                    client_id: import.meta.env.VITE_JANUA_CLIENT_ID,
                }),
            });

            if (!response.ok) {
                throw new Error('Token exchange failed');
            }

            const data = await response.json();
            const payload = parseJWT(data.access_token);

            if (!payload) {
                throw new Error('Invalid token received');
            }

            const newUser: JanuaUser = {
                id: payload.sub as string,
                email: payload.email as string,
                name: payload.name as string | undefined,
                picture: payload.picture as string | undefined,
                emailVerified: payload.email_verified as boolean || false,
                orgId: payload.org_id as string | undefined,
                roles: (payload.roles as string[]) || [],
            };

            const newTokens: AuthTokens = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: payload.exp as number,
            };

            setUser(newUser);
            setTokens(newTokens);
            saveAuth(newUser, newTokens);

            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    const signIn = useCallback(() => {
        // Generate random state for CSRF protection
        const state = crypto.randomUUID();
        sessionStorage.setItem('janua_oauth_state', state);

        // Build OAuth URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: import.meta.env.VITE_JANUA_CLIENT_ID || 'madlab-app',
            redirect_uri: window.location.origin,
            scope: 'openid profile email',
            state,
        });

        // Redirect to Janua login
        window.location.href = `${januaUrl}/oauth/authorize?${params.toString()}`;
    }, [januaUrl]);

    const signOut = useCallback(() => {
        setUser(null);
        setTokens(null);
        clearAuth();

        // Optionally redirect to Janua logout
        // window.location.href = `${januaUrl}/logout?redirect_uri=${window.location.origin}`;
    }, []);

    // Register signOut with the API client so the axios 401 interceptor can
    // trigger logout when the server rejects a token. Cleanup on unmount to
    // avoid stale handler references during HMR / test teardown.
    useEffect(() => {
        setAuthLogoutHandler(signOut);
        return () => setAuthLogoutHandler(null);
    }, [signOut]);

    const refreshSession = useCallback(async (): Promise<boolean> => {
        if (!tokens?.refreshToken) return false;

        try {
            const response = await fetch(`${januaUrl}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: tokens.refreshToken,
                    client_id: import.meta.env.VITE_JANUA_CLIENT_ID,
                }),
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            const payload = parseJWT(data.access_token);

            if (!payload) {
                throw new Error('Invalid token received');
            }

            const newTokens: AuthTokens = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token || tokens.refreshToken,
                expiresAt: payload.exp as number,
            };

            setTokens(newTokens);
            if (user) {
                saveAuth(user, newTokens);
            }

            return true;
        } catch {
            signOut();
            return false;
        }
    }, [tokens, user, januaUrl, signOut]);

    const hasRole = useCallback((role: string): boolean => {
        return user?.roles.includes(role) ?? false;
    }, [user]);

    const value: AuthContextValue = {
        user,
        tokens,
        isAuthenticated: !!user && !!tokens,
        isLoading,
        error,
        signIn,
        signOut,
        refreshSession,
        hasRole,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// ============================================================================
// Higher-Order Component for Protected Routes
// ============================================================================

interface ProtectedRouteProps {
    children: ReactNode;
    requiredRoles?: string[];
    fallback?: ReactNode;
}

export function ProtectedRoute({ children, requiredRoles, fallback }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, hasRole } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return fallback ? <>{fallback}</> : null;
    }

    if (requiredRoles && !requiredRoles.some(role => hasRole(role))) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-medium text-slate-700 dark:text-slate-300">
                        Access Denied
                    </h2>
                    <p className="text-slate-500 mt-2">
                        You don't have permission to access this page.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
