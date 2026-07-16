"use client";
// Practice-wide pricing, editable by admins. Values shown in pounds, stored in
// pence. Live preview shows exactly what a patient would be quoted.
import { useState } from "react";
import { updatePricing } from "@/app/admin/actions";
import type { PricingConfig } from "@/lib/pricing";

const gbp = (n: number) => "£" + n.toLocaleString("en-GB");

export default function PricingSettingsForm({ cfg }: { cfg: PricingConfig }) {
  const [t1Max, setT1Max] = useState(cfg.tier1MaxAligners);
  const [t1, setT1] = useState(cfg.tier1Pence / 100);
  const [t2Max, setT2Max] = useState(cfg.tier2MaxAligners);
  const [t2, setT2] = useState(cfg.tier2Pence / 100);
  const [t3, setT3] = useState(cfg.tier3Pence / 100);
  const [dep, setDep] = useState(cfg.depositPence / 100);
  const [up, setUp] = useState(cfg.upfrontPence / 100);
  const [disc, setDisc] = useState(cfg.discountPct);
  const [saving, setSaving] = useState(false);

  // Preview on the mid tier — the most common case.
  const net = Math.max(0, t2 - up);
  const full = Math.round(net * (1 - disc / 100));
  const instal = Math.round((net - dep) / 3);
  const depTooBig = dep >= t1;

  const num = (v: number, set: (n: number) => void, name: string, step = "1") => (
    <input className="input" name={name} type="number" min="0" step={step} value={v}
      onChange={(e) => set(parseFloat(e.target.value) || 0)} />
  );

  return (
    <form action={updatePricing} onSubmit={() => setSaving(true)} className="ds-view"
      style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, alignItems: "start" }}>
      <div className="card" style={{ padding: 26 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Pricing</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2, lineHeight: 1.6 }}>
          Applies to <strong>new and edited proposals</strong>. Patients already sent a proposal keep the
          price they were quoted — nothing changes retroactively.
        </div>

        <div style={{ height: 1, background: "#EEF2F6", margin: "22px 0" }} />
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Treatment price by aligner count</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="label">Tier 1 — up to (aligners)</label>
            {num(t1Max, setT1Max, "tier1MaxAligners")}
          </div>
          <div>
            <label className="label">Tier 1 price (£)</label>
            {num(t1, setT1, "tier1Pounds", "0.01")}
          </div>
          <div>
            <label className="label">Tier 2 — up to (aligners)</label>
            {num(t2Max, setT2Max, "tier2MaxAligners")}
          </div>
          <div>
            <label className="label">Tier 2 price (£)</label>
            {num(t2, setT2, "tier2Pounds", "0.01")}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Tier 3 price (£) — above {t2Max} aligners</label>
            {num(t3, setT3, "tier3Pounds", "0.01")}
          </div>
        </div>

        <div style={{ height: 1, background: "#EEF2F6", margin: "22px 0" }} />
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Payments</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="label">Deposit (£)</label>
            {num(dep, setDep, "depositPounds", "0.01")}
            <div style={{ fontSize: 11.5, color: depTooBig ? "#C23B34" : "#9AA6B4", marginTop: 4, lineHeight: 1.5 }}>
              {depTooBig ? "Must be less than the Tier 1 price" : "Taken upfront, then 3 monthly instalments"}
            </div>
          </div>
          <div>
            <label className="label">Booking credit (£)</label>
            {num(up, setUp, "upfrontPounds", "0.01")}
            <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 4 }}>Deducted when “paid upfront” is ticked</div>
          </div>
          <div>
            <label className="label">Pay-in-full discount (%)</label>
            {num(disc, setDisc, "discountPct")}
          </div>
        </div>

        <button className="btn btn-teal" disabled={saving || depTooBig}
          style={{ marginTop: 26, width: "100%", padding: 13, fontSize: 15, opacity: saving || depTooBig ? 0.55 : 1 }}>
          {saving ? "Saving…" : "Save pricing"}
        </button>
      </div>

      {/* live preview */}
      <div className="card" style={{ padding: 24, position: "sticky", top: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#0E9384" }}>What a patient sees</div>
        <div style={{ fontSize: 13, color: "#8A96A5", marginTop: 6 }}>Example: {t1Max + 1}–{t2Max} aligners, booking credit paid</div>

        <div style={{ marginTop: 18, border: "1px solid #EEF2F6", borderRadius: 14, overflow: "hidden" }}>
          <Row label="Treatment total" value={gbp(t2)} />
          <Row label="Less booking credit" value={"− " + gbp(up)} />
          <Row label="Balance" value={gbp(net)} strong />
        </div>

        <div style={{ marginTop: 14, border: "1px solid #EEF2F6", borderRadius: 14, overflow: "hidden" }}>
          <Row label={`Pay in full (${disc}% off)`} value={gbp(full)} teal />
          <Row label="Deposit" value={gbp(dep)} />
          <Row label="then 3 × monthly" value={instal > 0 ? gbp(instal) : "—"} />
          <Row label="0% finance (36mo)" value={gbp(Math.round(net / 36)) + "/mo"} />
        </div>

        <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 14, lineHeight: 1.6 }}>
          These are the exact figures the proposal page, emails and Stripe will use.
        </div>
      </div>
    </form>
  );
}

function Row({ label, value, strong, teal }: { label: string; value: string; strong?: boolean; teal?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid #F1F4F8", background: teal ? "#F0FBF8" : undefined }}>
      <span style={{ fontSize: 13, color: teal ? "#0B7A6E" : "#7A8696", fontWeight: teal ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: strong || teal ? 15 : 14, fontWeight: 800, color: teal ? "#0B7A6E" : "#16202E" }}>{value}</span>
    </div>
  );
}
