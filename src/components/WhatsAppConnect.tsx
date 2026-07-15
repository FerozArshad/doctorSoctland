"use client";
// WhatsApp Embedded Signup (Coexistence) — connects the practice's existing
// WhatsApp Business app number to the Cloud API. On success it shows the
// Phone Number ID + business token to paste into env (WHATSAPP_PHONE_NUMBER_ID
// / WHATSAPP_TOKEN). Uses Meta's Facebook JS SDK per the v4 implementation.
import { useEffect, useState } from "react";

// NOTE: NEXT_PUBLIC_* are inlined at BUILD time. Strip stray quotes/whitespace —
// a value pasted into Vercel WITH the surrounding "…" leaves a quoted appId,
// which makes the button enable (non-empty) but silently breaks FB.init.
const APP_ID = (process.env.NEXT_PUBLIC_META_APP_ID || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
const CONFIG_ID = (process.env.NEXT_PUBLIC_META_CONFIG_ID || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { FB?: any; fbAsyncInit?: () => void }
}

export default function WhatsAppConnect() {
  const [sdkReady, setSdkReady] = useState(false);
  const [wabaId, setWabaId] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    // Capture the Embedded Signup result (waba_id + phone_number_id) posted by Meta.
    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin === "string" && !event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(data.event).startsWith("FINISH")) {
          setWabaId(data.data?.waba_id || "");
          setPhoneId(data.data?.phone_number_id || "");
        } else if (data.event === "CANCEL") {
          setStatus("Onboarding cancelled" + (data.data?.current_step ? ` at: ${data.data.current_step}` : "") + ".");
        }
      } catch { /* non-JSON FB messages — ignore */ }
    };
    window.addEventListener("message", onMessage);

    const initFb = () => {
      if (!window.FB) return;
      try {
        window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: "v23.0" });
        console.log("[wa-connect] initFb: FB.init done", { APP_ID, appIdLen: APP_ID.length });
        setSdkReady(true);
      } catch (e) {
        console.error("[wa-connect] initFb: FB.init threw", e);
      }
    };
    window.fbAsyncInit = initFb;
    if (window.FB) {
      initFb(); // SDK already loaded — initialise immediately
    } else if (!document.getElementById("facebook-jssdk")) {
      const js = document.createElement("script");
      js.id = "facebook-jssdk";
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.async = true;
      js.defer = true;
      document.body.appendChild(js);
    }
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Kept separate because FB.login rejects an async callback ("Expression is of
  // type asyncfunction, not function"). The callback below must be a plain fn.
  const exchangeCode = async (code: string) => {
    setStatus("Finishing connection…");
    try {
      const r = await fetch("/api/whatsapp/embedded-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (j.access_token) { setToken(j.access_token); setStatus("✓ Connected. Save the two values below into your environment variables."); }
      else { setStatus("Token exchange failed: " + (j.error || "unknown error")); }
    } catch (e) {
      setStatus("Token exchange request failed: " + (e as Error).message);
    }
  };

  const launch = () => {
    console.log("[wa-connect] launch()", { APP_ID, CONFIG_ID, appIdLen: APP_ID.length, configIdLen: CONFIG_ID.length, hasFB: !!window.FB });
    if (!window.FB) { setStatus("Facebook SDK is still loading — wait a second and click again."); return; }
    if (!APP_ID || !CONFIG_ID) { setStatus("App ID / Config ID missing at runtime — check the env vars."); return; }
    // Guarantee init has run before login (prevents "FB.login() called before FB.init()").
    try {
      window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: "v23.0" });
      console.log("[wa-connect] FB.init() succeeded");
    } catch (e) {
      console.error("[wa-connect] FB.init() threw", e);
      setStatus("FB.init failed: " + (e as Error).message);
      return;
    }
    setStatus("Opening WhatsApp sign-up…");
    setWabaId(""); setPhoneId(""); setToken("");
    console.log("[wa-connect] calling FB.login()", { config_id: CONFIG_ID });
    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        if (!code) { setStatus("No authorisation code returned — the popup may have been closed."); return; }
        void exchangeCode(code);
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        // Coexistence: onboard a number that's already on the WhatsApp Business app.
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      }
    );
  };

  const configured = !!APP_ID && !!CONFIG_ID;

  return (
    <div className="card" style={{ padding: 26, maxWidth: 640 }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>Connect WhatsApp (Cloud API)</div>
      <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.6 }}>
        Links your WhatsApp Business app number to the Cloud API (Coexistence). You&apos;ll scan a QR code from
        your WhatsApp Business app to confirm — your existing app keeps working.
      </div>

      {!configured && (
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "#FBF3E2", color: "#8A6D1F", fontSize: 13, lineHeight: 1.6 }}>
          Set <code>NEXT_PUBLIC_META_APP_ID</code>, <code>NEXT_PUBLIC_META_CONFIG_ID</code> (and server-side
          <code> META_APP_SECRET</code>) in your environment, then redeploy, to enable the button.
        </div>
      )}

      <button
        onClick={launch}
        disabled={!sdkReady || !configured}
        className="btn btn-teal"
        style={{ marginTop: 18, padding: "13px 22px", fontSize: 14.5, opacity: sdkReady && configured ? 1 : 0.55 }}
      >
        {sdkReady ? "Connect WhatsApp →" : "Loading…"}
      </button>

      {status && <div style={{ marginTop: 14, fontSize: 13.5, color: "#3C4a59" }}>{status}</div>}

      {/* Debug panel — shows the actual runtime values (App ID / Config ID are not secret) */}
      <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "#0E1A2B", color: "#9FB2C8", fontSize: 12, fontFamily: "ui-monospace, monospace", lineHeight: 1.7, wordBreak: "break-all" }}>
        <div style={{ color: "#7CF3D6", fontWeight: 700, marginBottom: 4 }}>debug</div>
        <div>APP_ID: {APP_ID ? `"${APP_ID}"` : "(empty)"} · len {APP_ID.length}</div>
        <div>CONFIG_ID: {CONFIG_ID ? `"${CONFIG_ID}"` : "(empty)"} · len {CONFIG_ID.length}</div>
        <div>SDK ready: {String(sdkReady)} · window.FB: {typeof window !== "undefined" && window.FB ? "present" : "missing"}</div>
      </div>
      {(phoneId || token) && (
        <div style={{ marginTop: 18, border: "1px solid #CFEDE5", background: "#F4FCFA", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#0B7A6E", marginBottom: 10 }}>Paste these into your env vars (Vercel + local), then redeploy:</div>
          {phoneId && <Field label="WHATSAPP_PHONE_NUMBER_ID" value={phoneId} />}
          {token && <Field label="WHATSAPP_TOKEN" value={token} />}
          {wabaId && <Field label="WhatsApp Business Account ID (reference)" value={wabaId} />}
          <div style={{ fontSize: 11.5, color: "#7A8696", marginTop: 8 }}>Shown once — copy them now. Keep the token secret.</div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5C6a79", letterSpacing: ".03em" }}>{label}</div>
      <div style={{ fontSize: 12.5, fontFamily: "ui-monospace, monospace", background: "#0E1A2B", color: "#7CF3D6", padding: "9px 11px", borderRadius: 9, marginTop: 3, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}
