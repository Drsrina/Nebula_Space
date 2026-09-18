/**
 * Centralized API & Authentication helper for Nebula Frontend.
 * Standardizes token management across sessionStorage and localStorage,
 * and attaches Authorization Bearer headers to all backend requests.
 */

const TOKEN_KEY = 'nebula_token';
const LEGACY_JWT_KEY = 'nebula_jwt';

export function getAuthToken(): string {
  try {
    return (
      sessionStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(LEGACY_JWT_KEY) ||
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(LEGACY_JWT_KEY) ||
      ''
    );
  } catch {
    return '';
  }
}

export function setAuthToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(LEGACY_JWT_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage quota errors
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_JWT_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_JWT_KEY);
  } catch {
    // ignore
  }
}

export function getAuthHeaders(headersInit?: HeadersInit): Headers {
  const headers = new Headers(headersInit || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const modifiedInit: RequestInit = {
    ...init,
    headers: getAuthHeaders(init?.headers),
  };
  return fetch(input, modifiedInit);
}
