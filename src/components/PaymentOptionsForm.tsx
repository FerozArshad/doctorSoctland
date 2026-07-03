"use client";
// Compact payment chooser: the patient selects one of four routes and
// continues. Full/deposit go straight to Stripe; monthly/finance notify
// the practice, which sends the payment link or lender application.
import { useState } from "react";
import { selectPaymentOption } from "@/app/p/actions";

export type PayOption = {
  key: "full" | "deposit" | "monthly" | "finance";
  title: string;
  desc: string;
  priceTop?: string; // small line above the price (e.g. "then" / "from")
  price: string;
  priceSub?: string; // e.g. "/mo"
  strike?: string; // struck-through original price
  tag?: string; // e.g. "Best value"
  cta: string; // button label when selected
};

export default function PaymentOptionsForm({ token, options }: { token: string; options: PayOption[] }) {
  const [choice, setChoice] = useState<PayOption["key"]>(options[0]?.key ?? "full");
  const [submitting, setSubmitting] = useState(false);
  const selected = options.find((o) => o.key === choice)!;

  return (
    <form action={selectPaymentOption} onSubmit={() => setSubmitting(true)}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="choice" value={choice} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((o) => {
          const active = o.key === choice;
          return (
            <label
              key={o.key}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
                borderRadius: 14, cursor: "pointer", position: "relative",
                border: active ? "2px solid #0E9384" : "1px solid #E7ECF2",
                background: active ? "#F4FCFA" : "#fff",
                margin: active && o.tag ? "6px 0 0" : 0,
              }}
            >
              {o.tag && (
                <span style={{ position: "absolute", top: -10, left: 16, background: "#0E9384", color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", padding: "3px 9px", borderRadius: 20, textTransform: "uppercase" }}>{o.tag}</span>
              )}
              <input
                type="radio"
                name="choiceRadio"
                checked={active}
                onChange={() => setChoice(o.key)}
                style={{ accentColor: "#0E9384", width: 17, height: 17, flex: "none", cursor: "pointer" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{o.title}</div>
                <div style={{ fontSize: 12.5, color: "#5C6a79", marginTop: 2, lineHeight: 1.5 }}>{o.desc}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                {o.strike && <div style={{ fontSize: 12, color: "#9AA6B4", textDecoration: "line-through" }}>{o.strike}</div>}
                {o.priceTop && <div style={{ fontSize: 11, color: "#9AA6B4" }}>{o.priceTop}</div>}
                <div style={{ fontSize: 19, fontWeight: 800, color: active ? "#0B7A6E" : "#16202E" }}>
                  {o.price}
                  {o.priceSub && <span style={{ fontSize: 12, color: "#7A8696", fontWeight: 600 }}>{o.priceSub}</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <textarea
          name="note"
          rows={2}
          placeholder="Optional message for our team — questions, preferred start date, anything…"
          className="input"
          style={{ marginTop: 0, resize: "vertical", fontSize: 13.5 }}
        />
      </div>

      <button className="btn btn-teal" disabled={submitting} style={{ marginTop: 14, width: "100%", padding: 14, fontSize: 15 }}>
        {submitting ? "One moment…" : selected.cta}
      </button>
      <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 10, textAlign: "center", lineHeight: 1.6 }}>
        Whichever you choose, your Treatment Coordinator is notified and will confirm everything with you.
      </div>
    </form>
  );
}
