/**
 * AIM OAuth authentication for Chrome extension.
 * Uses chrome.identity.launchWebAuthFlow() for browser-native OAuth.
 */

export interface AIMAuthState {
  isLoggedIn: boolean;
  accessToken: string | null;
  userEmail: string | null;
  expiresAt: string | null;
}

const AUTH_STORAGE_KEY = 'aimAuth';
const DEFAULT_AUTH_STATE: AIMAuthState = {
  isLoggedIn: false,
  accessToken: null,
  userEmail: null,
  expiresAt: null,
};

/**
 * Get the current AIM auth state from chrome.storage.local.
 */
export async function getAIMAuthState(): Promise<AIMAuthState> {
  try {
    const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    return { ...DEFAULT_AUTH_STATE, ...(result[AUTH_STORAGE_KEY] ?? {}) };
  } catch {
    return { ...DEFAULT_AUTH_STATE };
  }
}

/**
 * Save AIM auth state to chrome.storage.local.
 */
export async function saveAIMAuthState(state: AIMAuthState): Promise<void> {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: state });
}

/**
 * Initiate AIM OAuth login via chrome.identity.launchWebAuthFlow.
 * Returns the auth state on success.
 */
export async function loginToAIM(aimBaseUrl: string): Promise<AIMAuthState> {
  const redirectUrl = chrome.identity.getRedirectURL('callback');
  const authUrl = new URL('/api/v1/oauth/authorize', aimBaseUrl);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('client_id', 'browserguard');

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error('OAuth flow was cancelled');
  }

  // Parse the token from the redirect URL hash fragment
  const url = new URL(responseUrl);
  const params = new URLSearchParams(url.hash.substring(1));
  const accessToken = params.get('access_token');
  const email = params.get('email');
  const expiresIn = params.get('expires_in');

  if (!accessToken) {
    throw new Error('No access token received from AIM');
  }

  const expiresAt = expiresIn
    ? new Date(Date.now() + parseInt(expiresIn, 10) * 1000).toISOString()
    : null;

  const authState: AIMAuthState = {
    isLoggedIn: true,
    accessToken,
    userEmail: email,
    expiresAt,
  };

  await saveAIMAuthState(authState);
  return authState;
}

/**
 * Log out of AIM and clear stored auth state.
 */
export async function logoutFromAIM(): Promise<void> {
  await saveAIMAuthState(DEFAULT_AUTH_STATE);
}

/**
 * Check if the current auth token is still valid.
 */
export function isTokenExpired(state: AIMAuthState): boolean {
  if (!state.expiresAt) return false;
  return new Date(state.expiresAt).getTime() < Date.now();
}
