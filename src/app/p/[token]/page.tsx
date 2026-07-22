import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { getAdmin, getPatientSession } from "@/lib/auth";
import { estMonths, finance36Pence, fmt, fullPricePence, instalmentPence, netPricePence } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-settings";
import { COMP_ITEMS, COMP_TOTAL, WHY_US } from "@/lib/content";
import { bookCall } from "@/app/p/actions";
import BrandLogo from "@/components/BrandLogo";
import CreateAccountCard from "@/components/CreateAccountCard";
import PaymentOptionsForm, { PayOption } from "@/components/PaymentOptionsForm";
import OtpGate from "@/components/OtpGate";
import VideoBlock from "@/components/VideoBlock";
import Toast from "@/components/Toast";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { preview?: string; paid?: string; cancelled?: string; otp?: string; channel?: string; devcode?: string };
}) {
  const c = await db.patient.findUnique({
    where: { proposalToken: params.token },
    include: { uploads: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, sizeBytes: true } } },
  });
  if (!c) notFound();

  const admin = searchParams.preview === "admin" ? await getAdmin() : null;
  const session = await getPatientSession();
  const loggedIn = session?.id === c.id;

  if (!admin && !loggedIn) {
    return (
      <OtpGate
        token={c.proposalToken}
        firstName={c.firstName}
        email={c.email}
        phone={c.phone}
        sent={searchParams.otp === "sent"}
        channel={searchParams.channel || "email"}
        devCode={searchParams.devcode}
      />
    );
  }

  const cfg = await getPricing();
  const net = netPricePence(c.pricePence, c.upfrontPaidPence);
  const full = fullPricePence(net, c.discountPct);
  const instal = instalmentPence(net, cfg.depositPence);
  const fin36 = finance36Pence(net);
  const paid = c.status === "paid";
  const depositPaid = c.status === "deposit";
  const applicant = {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    dateOfBirth: c.dateOfBirth,
  };

  const payOptions: PayOption[] = [
    {
      key: "full",
      title: "Pay in full today",
      desc: `${c.discountPct}% off — secure card payment.`,
      strike: fmt(net),
      price: fmt(full),
      tag: "Best value",
      cta: `Pay ${fmt(full)} securely →`,
    },
    {
      key: "deposit",
      title: "Deposit + 3 instalments",
      desc: `${fmt(cfg.depositPence)} today, then 3 auto payments.`,
      priceTop: "then",
      price: fmt(instal),
      priceSub: "/mo",
      cta: `Pay ${fmt(cfg.depositPence)} deposit →`,
    },
    {
      key: "finance",
      title: "0% interest-free finance",
      desc: "Spread over 12, 24 or 36 months.",
      priceTop: "from",
      price: fmt(fin36),
      priceSub: "/mo",
      cta: "Apply for 0% finance →",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#E8F1F3 0%,#F4F7F9 42%,#EEF2F5 100%)", display: "flex", flexDirection: "column" }}>
      {admin && (
        <div style={{ background: "#0B7A6E", color: "#EAFBF7", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8FF0DE", display: "inline-block", animation: "ds-pulse 2s infinite" }} />
            Preview mode — this is exactly what {c.firstName} receives by email
          </div>
          <Link href={`/admin/patients/${c.id}`} style={{ background: "rgba(255,255,255,.15)", color: "#fff", padding: "7px 14px", borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
            ← Back to admin
          </Link>
        </div>
      )}

      <div className="ds-scroll ds-view ds-proposal-pad" style={{ flex: 1, overflow: "auto", padding: "24px 16px 44px" }}>
        <div className="ds-proposal-shell" style={{ maxWidth: 1080, margin: "0 auto", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 48px -24px rgba(11,24,40,.35)", border: "1px solid rgba(14,26,43,.06)" }}>
          <div className="ds-pad-header" style={{ background: "#0B1828", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <BrandLogo width={150} height={40} priority />
            <div style={{ textAlign: "right", color: "#8FA6C0", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Invisalign Proposal</div>
          </div>

          <div className="ds-proposal-body" style={{ padding: "22px 22px 28px" }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#1EA8D8" }}>Your personalised plan</div>
              <h1 className="ds-proposal-title" style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0", letterSpacing: "-.02em", lineHeight: 1.2, color: "#0E1A2B" }}>
                Your Invisalign Treatment Proposal
              </h1>
              {searchParams.paid && (
                <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: 11, background: "#E6F6EA", color: "#1C7C3A", fontWeight: 700, fontSize: 13.5 }}>
                  ✓ {searchParams.paid === "deposit"
                    ? "Deposit received! Your 3 monthly instalments are scheduled automatically."
                    : "Payment received — thank you! A receipt is on its way."}
                </div>
              )}
              {searchParams.cancelled && (
                <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: 11, background: "#FBF3E2", color: "#B7791F", fontWeight: 700, fontSize: 13.5 }}>
                  Payment cancelled — no charge was made. You can try again whenever you&apos;re ready.
                </div>
              )}
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "#3C4a59", margin: "10px 0 0", maxWidth: 680 }}>
                Hi {c.firstName} — review your plan on the left, then choose how to pay on the right. You&apos;ll agree &amp; e-sign before anything is charged.
              </p>
            </div>

            {/* Desktop: plan left | payment right | video full-width under both
                Mobile: plan → payment → video (clear reading order) */}
            <div
              className="ds-proposal-split"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateAreas: `"data pay" "video video"`,
                gap: 14,
                alignItems: "stretch",
              }}
            >
              <section className="ds-proposal-data" style={{ gridArea: "data", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ border: "1px solid #E7ECF2", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ background: "#0E1A2B", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "#C5D4E6" }}>
                    Your Invisalign plan
                  </div>
                  <div className="ds-proposal-metrics" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "12px 12px", borderRight: "1px solid #EEF2F6", borderBottom: "1px solid #EEF2F6" }}>
                      <div style={{ fontSize: 11, color: "#7A8696", fontWeight: 600 }}>Aligners</div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{c.alignerCount}</div>
                    </div>
                    <div style={{ padding: "12px 12px", borderBottom: "1px solid #EEF2F6" }}>
                      <div style={{ fontSize: 11, color: "#7A8696", fontWeight: 600 }}>Duration</div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>≈ {estMonths(c.alignerCount)} mo</div>
                    </div>
                    <div style={{ padding: "12px 12px", borderRight: "1px solid #EEF2F6" }}>
                      <div style={{ fontSize: 11, color: "#7A8696", fontWeight: 600 }}>Package</div>
                      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3 }}>Invisalign {c.pkg}</div>
                    </div>
                    <div style={{ padding: "12px 12px", background: "#F0FBF8" }}>
                      <div style={{ fontSize: 11, color: "#0B7A6E", fontWeight: 600 }}>Total</div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, color: "#0B7A6E" }}>{fmt(c.pricePence)}</div>
                    </div>
                  </div>
                </div>

                <div style={{ border: "1px solid #E7ECF2", borderRadius: 14, padding: "12px 11px 10px", background: "#fff", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Included free</div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0B7A6E" }}>{COMP_TOTAL}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {COMP_ITEMS.map((item) => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 8px", borderRadius: 8, background: "#F6F9FA", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                          <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#DDF3EC", color: "#0B7A6E", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 9, flex: "none" }}>✓</span>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2C3847" }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#9AA6B4", textDecoration: "line-through", flex: "none" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: "#9AA6B4", margin: "8px 2px 0", lineHeight: 1.4 }}>
                    Treatment time is an estimate and may vary by about 1 month.
                  </p>
                </div>
              </section>

              <section
                className="ds-proposal-pay"
                style={{
                  gridArea: "pay",
                  background: "#F3F8F9",
                  border: "1px solid #D7E3E9",
                  borderRadius: 14,
                  padding: "14px 12px 12px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#0E1A2B" }}>How would you like to pay?</h2>
                <p style={{ fontSize: 12, color: "#6B7785", margin: "4px 0 11px", lineHeight: 1.4 }}>
                  Choose one. Next step is agree &amp; e-sign — under a minute.
                </p>

                {c.upfrontPaidPence > 0 && !paid && !depositPaid && (
                  <div style={{ border: "1px solid #CFEDE5", background: "#F4FCFA", borderRadius: 10, padding: "9px 11px", marginBottom: 10, fontSize: 12, color: "#3C4a59", lineHeight: 1.45 }}>
                    ✓ Credit <strong>{fmt(c.upfrontPaidPence)}</strong> applied — balance <strong style={{ color: "#0B7A6E" }}>{fmt(net)}</strong>.
                  </div>
                )}

                {paid ? (
                  <div style={{ padding: "14px", borderRadius: 12, background: "#E6F6EA", color: "#1C7C3A", fontWeight: 700, fontSize: 14, lineHeight: 1.45, marginTop: "auto" }}>
                    ✓ Paid in full — we&apos;ll arrange your aligner fitting.
                  </div>
                ) : depositPaid ? (
                  <div style={{ border: "1px solid #CFEDE5", background: "#F4FCFA", borderRadius: 12, padding: "14px", marginTop: "auto" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0B7A6E" }}>✓ Deposit received</div>
                    <div style={{ fontSize: 12.5, color: "#5C6a79", marginTop: 4, lineHeight: 1.5 }}>
                      Remaining 3 × <strong>{fmt(instal)}</strong> collected automatically each month.
                    </div>
                  </div>
                ) : (
                  <PaymentOptionsForm
                    token={c.proposalToken}
                    options={payOptions}
                    applicant={applicant}
                    initialUploads={c.uploads}
                    compact
                  />
                )}
              </section>

              <section className="ds-proposal-video" style={{ gridArea: "video" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#0E1A2B" }}>Watch your future smile</h2>
                  <span style={{ fontSize: 11.5, color: "#7A8696", fontWeight: 600 }}>Full ClinCheck preview</span>
                </div>
                <VideoBlock url={c.videoUrl} />
              </section>
            </div>

            <div style={{ marginTop: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>Why Dental Scotland?</h2>
              <div className="ds-proposal-why" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {WHY_US.map((w) => (
                  <div key={w.title} style={{ padding: "11px 11px", borderRadius: 11, background: "#F6F9FA", border: "1px solid #EEF2F6" }}>
                    <div style={{ fontWeight: 800, fontSize: 12.5, color: "#16202E" }}>{w.title}</div>
                    <div style={{ fontSize: 11.5, color: "#5C6a79", marginTop: 3, lineHeight: 1.4 }}>{w.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {!admin && !c.passwordHash && <CreateAccountCard token={c.proposalToken} email={c.email} />}
            {!admin && c.passwordHash && !loggedIn && (
              <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 11, background: "#F6F9FA", border: "1px solid #EEF2F6", fontSize: 13, color: "#5C6a79" }}>
                You have a patient account — <Link href="/login" style={{ color: "#0E9384", fontWeight: 700 }}>log in</Link> any time to return here.
              </div>
            )}

            {!paid && (
              <div className="ds-proposal-cta" style={{ marginTop: 18, padding: "16px 18px", borderRadius: 14, background: "#0E1A2B", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>Questions before you choose?</div>
                  <div style={{ color: "#9FB2C8", fontSize: 12.5, marginTop: 3, lineHeight: 1.45 }}>Happy to talk it through — no obligation.</div>
                </div>
                <form action={bookCall}>
                  <input type="hidden" name="token" value={c.proposalToken} />
                  <button className="btn btn-teal" style={{ padding: "11px 18px", fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                    Book a follow-up call
                  </button>
                </form>
              </div>
            )}

            <div style={{ marginTop: 18, textAlign: "center", color: "#9AA6B4", fontSize: 11.5, lineHeight: 1.65 }}>
              Dental Scotland · It&apos;s time to smile ·{" "}
              <a href="https://dentalscotland.com/" style={{ color: "#1EA8D8", fontWeight: 700, textDecoration: "none" }}>
                dentalscotland.com
              </a>
              <br />Valid 30 days. Payments secured by Stripe.
            </div>
          </div>
        </div>
      </div>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
