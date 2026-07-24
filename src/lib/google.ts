// Google OAuth (gmail.send) + Gmail REST send for a single sending mailbox.
// One-time flow: an admin authorises at /api/auth/google, Google redirects back
// with a code, we swap it for a refresh token and store it in env
// (GMAIL_REFRESH_TOKEN). Access tokens are cached and refreshed automatically
// before expiry — see google-token.ts.

import { getGoogleAccessToken, invalidateGoogleAccessToken, seedGoogleAccessToken } from "./google-token";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const SCOPE = "https://www.googleapis.com/auth/gmail.send";

// Client id/secret present → we can run the OAuth handshake.
export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Refresh token also present → we can actually send mail.
export function gmailConfigured(): boolean {
  return googleConfigured() && !!process.env.GMAIL_REFRESH_TOKEN;
}

// Must byte-for-byte match a URI registered in Google Cloud Console.
// Derives from APP_URL so it tracks the environment (localhost / ngrok / prod).
export function googleRedirectUri(): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force the refresh token even on re-auth
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// Exchange the one-time auth code for tokens (refresh_token is what we keep).
export async function exchangeCodeForTokens(
  code: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope: string }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  if (tokens.access_token && tokens.expires_in) {
    seedGoogleAccessToken(tokens.access_token, tokens.expires_in);
  }
  return tokens;
}

function base64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMime(to: string, subject: string, html: string, from: string): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  return (
    [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
    ].join("\r\n") +
    "\r\n\r\n" +
    Buffer.from(html, "utf8").toString("base64")
  );
}

async function postGmailMessage(accessToken: string, mime: string): Promise<Response> {
  return fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(mime) }),
  });
}

// Send an HTML email through Gmail. `from` should be the authorised mailbox
// (or one of its verified send-as aliases), e.g. EMAIL_FROM.
export async function sendGmail(to: string, subject: string, html: string, from: string): Promise<{ messageId: string }> {
  const mime = buildMime(to, subject, html, from);
  let accessToken = await getGoogleAccessToken();
  let res = await postGmailMessage(accessToken, mime);

  // Token may have expired between cache check and send — refresh once and retry.
  if (res.status === 401) {
    invalidateGoogleAccessToken();
    accessToken = await getGoogleAccessToken(true);
    res = await postGmailMessage(accessToken, mime);
  }

  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`Gmail send failed: ${res.status} ${body}`);
    (err as Error & { httpStatus?: number }).httpStatus = res.status;
    throw err;
  }

  let messageId = "";
  try {
    const json = JSON.parse(body) as { id?: string };
    messageId = json.id || "";
  } catch {
    messageId = "";
  }
  return { messageId };
}

export { getGoogleAccessToken, getGoogleTokenStatus, warmGoogleAccessToken } from "./google-token";
