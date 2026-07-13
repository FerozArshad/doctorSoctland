// Google OAuth (gmail.send) + Gmail REST send for a single sending mailbox.
// One-time flow: an admin authorises at /api/auth/google, Google redirects back
// with a code, we swap it for a refresh token and store it in env
// (GMAIL_REFRESH_TOKEN). Sending then swaps that refresh token for a short-lived
// access token and posts the message to the Gmail API — no heavy SDK needed.

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
  return res.json();
}

// Swap the stored refresh token for a fresh access token before each send.
async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

function base64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Send an HTML email through Gmail. `from` should be the authorised mailbox
// (or one of its verified send-as aliases), e.g. EMAIL_FROM.
export async function sendGmail(to: string, subject: string, html: string, from: string): Promise<void> {
  const accessToken = await getAccessToken();
  // RFC 2047-encode the subject and base64 the body so £ and other UTF-8 survive.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const mime =
    [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
    ].join("\r\n") +
    "\r\n\r\n" +
    Buffer.from(html, "utf8").toString("base64");

  const res = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(mime) }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
}
