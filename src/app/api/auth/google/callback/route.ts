import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdmin } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google";

// GET /api/auth/google/callback — Google redirects here with ?code&state.
// We verify the admin session + CSRF state, swap the code for tokens, and show
// the refresh token once so it can be pasted into env as GMAIL_REFRESH_TOKEN.
export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.redirect(new URL("/admin/login", req.url));

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) return page(`Google returned an error: ${escapeHtml(error)}`, false);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = cookies().get("g_oauth_state")?.value;
  cookies().delete("g_oauth_state");

  if (!code) return page("No authorisation code returned.", false);
  if (!state || !expected || state !== expected) return page("State mismatch — please start again.", false);

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (e) {
    return page(`Token exchange failed: ${escapeHtml((e as Error).message)}`, false);
  }

  if (!tokens.refresh_token) {
    return page(
      "Google did not return a refresh token. Remove this app's access at " +
        "myaccount.google.com/permissions and authorise again (we request prompt=consent to force it).",
      false
    );
  }

  return page(tokens.refresh_token, true);
}

function page(message: string, ok: boolean): NextResponse {
  const body = ok
    ? `<h1>✓ Gmail connected</h1>
       <p>Copy this refresh token into your <code>.env</code> (and Vercel env vars) as <code>GMAIL_REFRESH_TOKEN</code>, then restart:</p>
       <pre>GMAIL_REFRESH_TOKEN=${escapeHtml(message)}</pre>
       <p class="muted">Shown once. It grants send-only access to the authorised mailbox. Keep it secret; revoke at myaccount.google.com/permissions.</p>`
    : `<h1>Couldn't connect Gmail</h1><p>${message}</p><p><a href="/api/auth/google">Try again</a></p>`;
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gmail authorisation</title>
     <style>body{font-family:system-ui,Segoe UI,sans-serif;max-width:640px;margin:48px auto;padding:0 20px;color:#16202E}
     h1{font-size:22px}code{background:#F0F3F7;padding:2px 6px;border-radius:6px}
     pre{background:#0E1A2B;color:#7CF3D6;padding:16px;border-radius:12px;overflow:auto;word-break:break-all;white-space:pre-wrap}
     .muted{color:#7A8696;font-size:13px}a{color:#0E9384}</style></head>
     <body>${body}</body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
