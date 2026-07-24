// Gmail OAuth access-token cache with proactive refresh.
// Refresh tokens live in env (GMAIL_REFRESH_TOKEN); access tokens are short-lived
// (~1 h) and cached in memory with expiry tracking so we only hit Google's token
// endpoint when needed — not on every email send.

import { log, summarizeError } from "./log";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
/** Refresh this many ms before Google reports expiry. */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_EXPIRES_IN_SEC = 3600;
const MAX_REFRESH_RETRIES = 3;
const RETRY_BASE_MS = 400;

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let cache: TokenCache | null = null;
let refreshPromise: Promise<string> | null = null;

function gmailCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth credentials are not configured");
  }
  return { clientId, clientSecret, refreshToken };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isCacheValid(entry: TokenCache | null): entry is TokenCache {
  if (!entry) return false;
  return Date.now() < entry.expiresAt - EXPIRY_BUFFER_MS;
}

function retryableStatus(status: number) {
  return status === 429 || status >= 500;
}

async function requestAccessToken(): Promise<TokenCache> {
  const { clientId, clientSecret, refreshToken } = gmailCredentials();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_REFRESH_RETRIES; attempt++) {
    try {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const body = await res.text();
      if (!res.ok) {
        const err = new Error(`Google token refresh failed: ${res.status} ${body}`);
        if (!retryableStatus(res.status) || attempt === MAX_REFRESH_RETRIES - 1) throw err;
        lastError = err;
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }

      const json = JSON.parse(body) as { access_token?: string; expires_in?: number };
      if (!json.access_token) throw new Error("Google token refresh returned no access_token");

      const expiresIn = json.expires_in ?? DEFAULT_EXPIRES_IN_SEC;
      const entry: TokenCache = {
        accessToken: json.access_token,
        expiresAt: Date.now() + expiresIn * 1000,
      };

      log.info("gmail.token.refreshed", {
        expiresInSec: expiresIn,
        expiresAt: new Date(entry.expiresAt).toISOString(),
      });

      return entry;
    } catch (e) {
      lastError = e;
      if (attempt < MAX_REFRESH_RETRIES - 1) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
    }
  }

  log.error("gmail.token.refresh.fail", summarizeError(lastError));
  throw lastError instanceof Error ? lastError : new Error("Google token refresh failed");
}

/** Seed cache after the initial OAuth code exchange (optional). */
export function seedGoogleAccessToken(accessToken: string, expiresInSec: number) {
  cache = {
    accessToken,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
}

/** Drop cached access token (e.g. after a 401 from Gmail API). */
export function invalidateGoogleAccessToken() {
  cache = null;
}

export function getGoogleTokenStatus() {
  const valid = isCacheValid(cache);
  return {
    configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN),
    cached: !!cache,
    valid,
    expiresAt: cache ? new Date(cache.expiresAt).toISOString() : null,
    refreshInProgress: !!refreshPromise,
  };
}

/**
 * Return a valid access token. Reuses the in-memory cache when still fresh;
 * otherwise refreshes using client id/secret + refresh token. Concurrent callers
 * share one in-flight refresh.
 */
export async function getGoogleAccessToken(force = false): Promise<string> {
  if (!force && isCacheValid(cache)) {
    return cache.accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const fresh = await requestAccessToken();
        cache = fresh;
        return fresh.accessToken;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

/** Proactively refresh when the cache is missing or near expiry (cron / warmup). */
export async function warmGoogleAccessToken(): Promise<void> {
  if (isCacheValid(cache)) return;
  await getGoogleAccessToken();
}
