"use client";
// Patient proposal: pick a payment route → optional note → consent
// popup with e-signature (required for full / deposit / finance).
import { useState } from "react";
import ConsentModal, { Applicant, ConsentChoice } from "./ConsentModal";

export type PayOption = {
  key: "full" | "deposit" | "finance";
  title: string;
  desc: string;
  priceTop?: string;
  price: string;
  priceSub?: string;
  strike?: string;
  tag?: string;
  cta: string;
};

export default function PaymentOptionsForm({
  token,
  options,
  applicant,
  compact = false,
  previewMode = false,
  financeRedirectUrl = null,
}: {
  token: string;
  options: PayOption[];
  applicant: Applicant;
  compact?: boolean;
  /** Admin preview — show layout only; payments must use the patient link. */
  previewMode?: boolean;
  /** External finance portal — opens in a new tab after consent. */
  financeRedirectUrl?: string | null;
}) {
  const [choice, setChoice] = useState<PayOption["key"]>(options[0]?.key ?? "full");
  const [note, setNote] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const selected = options.find((o) => o.key === choice)!;

  return (
    <>
      <ConsentModal
        open={showConsent}
        onClose={() => setShowConsent(false)}
        token={token}
        choice={choice as ConsentChoice}
        note={note}
        applicant={applicant}
        previewMode={previewMode}
        financeRedirectUrl={financeRedirectUrl}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
        {options.map((o) => {
          const active = o.key === choice;
          return (
            <label
              key={o.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: compact ? 10 : 14,
                padding: compact ? "12px 12px" : "16px 18px",
                borderRadius: 13,
                cursor: "pointer",
                position: "relative",
                border: active ? "2px solid #3CC7F7" : "1px solid #E1E7EE",
                background: active ? "#F3FBFE" : "#fff",
                boxShadow: active ? "0 6px 16px -10px rgba(60,199,247,.55)" : "none",
                margin: active && o.tag ? "6px 0 0" : 0,
              }}
            >
              {o.tag && (
                <span style={{ position: "absolute", top: -9, left: 12, background: "#3CC7F7", color: "#06101C", fontSize: 10, fontWeight: 800, letterSpacing: ".04em", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase" }}>
                  {o.tag}
                </span>
              )}
              <input
                type="radio"
                name="choiceRadio"
                checked={active}
                onChange={() => setChoice(o.key)}
                style={{ accentColor: "#3CC7F7", width: 16, height: 16, flex: "none", cursor: "pointer" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: compact ? 13.5 : 15 }}>{o.title}</div>
                <div style={{ fontSize: compact ? 11.5 : 12.5, color: "#5C6a79", marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                {o.strike && <div style={{ fontSize: 11, color: "#9AA6B4", textDecoration: "line-through" }}>{o.strike}</div>}
                {o.priceTop && <div style={{ fontSize: 10.5, color: "#9AA6B4" }}>{o.priceTop}</div>}
                <div style={{ fontSize: compact ? 17 : 19, fontWeight: 800, color: active ? "#1EA8D8" : "#16202E" }}>
                  {o.price}
                  {o.priceSub && <span style={{ fontSize: 11.5, color: "#7A8696", fontWeight: 600 }}>{o.priceSub}</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional message for our team…"
          className="input"
          style={{ marginTop: 0, resize: "vertical", fontSize: 13 }}
        />
      </div>

      {previewMode ? (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "#FBF3E2", border: "1px solid #F0DCA8", fontSize: 13, color: "#8A5A12", lineHeight: 1.55, textAlign: "center" }}>
          Preview only — payments and finance are disabled here. Use the patient&apos;s email link (or open pay link from admin without preview) to test checkout.
        </div>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-teal"
            onClick={() => setShowConsent(true)}
            style={{ marginTop: 14, width: "100%", padding: 13, fontSize: 14.5 }}
          >
            {selected.cta}
          </button>
          <div style={{ fontSize: 11.5, color: "#8A96A5", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
            Next: agree &amp; e-sign, then continue to payment.
          </div>
        </>
      )}
    </>
  );
}
