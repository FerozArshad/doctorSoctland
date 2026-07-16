import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { getAdmin, getPatientSession } from "@/lib/auth";
import { estMonths, finance36Pence, fmt, fullPricePence, instalmentPence, netPricePence } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-settings";
import { COMP_ITEMS, COMP_TOTAL, WHY_US } from "@/lib/content";
import { bookCall } from "@/app/p/actions";
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
  const c = await db.patient.findUnique({ where: { proposalToken: params.token } });
  if (!c) notFound();

  const admin = searchParams.preview === "admin" ? await getAdmin() : null;
  const session = await getPatientSession();
  const loggedIn = session?.id === c.id;

  // Identity gate: the secure link alone isn't enough — the patient must
  // verify with a one-time code (email/WhatsApp) unless already logged in
  // or this is an admin preview.
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

  // Net total = treatment price minus any £250 upfront already paid. Every
  // payment option is calculated on this so the charge matches what's shown.
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
      desc: `${c.discountPct}% discount when paid in full — secure card payment.`,
      strike: fmt(net),
      price: fmt(full),
      tag: "Best value",
      cta: `Pay ${fmt(full)} securely →`,
    },
    {
      key: "deposit",
      title: "Deposit + 3 instalments",
      desc: `${fmt(cfg.depositPence)} today, then 3 monthly payments collected automatically. No credit checks.`,
      priceTop: "then",
      price: fmt(instal),
      priceSub: "/mo",
      cta: `Pay ${fmt(cfg.depositPence)} deposit →`,
    },
    {
      key: "finance",
      title: "0% interest-free finance",
      desc: "Spread the cost over 12, 24 (most popular) or 36 months with our finance partner.",
      priceTop: "from",
      price: fmt(fin36),
      priceSub: "/mo",
      cta: "Apply for 0% finance →",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#EAF0F2", display: "flex", flexDirection: "column" }}>
      {/* admin preview banner */}
      {admin && (
        <div style={{ background: "#0B7A6E", color: "#EAFBF7", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8FF0DE", display: "inline-block", animation: "ds-pulse 2s infinite" }} />
            Preview mode — this is exactly what {c.firstName} receives by email
          </div>
          <Link href={`/admin/patients/${c.id}`} style={{ background: "rgba(255,255,255,.15)", color: "#fff", padding: "7px 14px", borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
            ← Back to admin
          </Link>
        </div>
      )}

      <div className="ds-scroll ds-view" style={{ flex: 1, overflow: "auto", padding: "36px 20px 60px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 30px 60px -30px rgba(11,24,40,.4)" }}>
          {/* brand header */}
          <div style={{ background: "#0E1A2B", padding: "30px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Image src="/logo.webp" alt="Dental Scotland" width={170} height={46} style={{ height: 46, width: "auto" }} />
            <div style={{ textAlign: "right", color: "#8FA6C0", fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>Invisalign Proposal</div>
          </div>

          <div style={{ padding: "40px 44px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#0E9384" }}>Your Personalised Plan</div>
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0 0", letterSpacing: "-.02em", lineHeight: 1.15 }}>Your Invisalign Treatment Proposal</h1>

            {/* payment status banners */}
            {searchParams.paid && (
              <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 12, background: "#E6F6EA", color: "#1C7C3A", fontWeight: 700, fontSize: 14.5 }}>
                ✓ {searchParams.paid === "deposit"
                  ? "Deposit received! Your 3 monthly instalments are scheduled automatically — a receipt is on its way to your inbox."
                  : "Payment received — thank you! A receipt is on its way to your inbox and we'll be in touch to book your fitting."}
              </div>
            )}
            {searchParams.cancelled && (
              <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 12, background: "#FBF3E2", color: "#B7791F", fontWeight: 700, fontSize: 14.5 }}>
                Payment cancelled — no charge was made. You can try again below whenever you&apos;re ready.
              </div>
            )}

            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#3C4a59", margin: "22px 0 0" }}>Hi {c.firstName},</p>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#3C4a59", margin: "12px 0 0" }}>
              Thank you for attending your Invisalign assessment with Dental Scotland. We&apos;re pleased to confirm that your personalised ClinCheck treatment plan is now complete.
            </p>

            {/* plan summary */}
            <div style={{ marginTop: 28, border: "1px solid #E7ECF2", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ background: "#F6F9FA", padding: "14px 20px", fontWeight: 700, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase", color: "#0E1A2B", borderBottom: "1px solid #E7ECF2" }}>Your Invisalign Plan</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ padding: "18px 20px", borderRight: "1px solid #EEF2F6", borderBottom: "1px solid #EEF2F6" }}>
                  <div style={{ fontSize: 12, color: "#7A8696", fontWeight: 600 }}>Number of Aligners</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{c.alignerCount}</div>
                </div>
                <div style={{ padding: "18px 20px", borderBottom: "1px solid #EEF2F6" }}>
                  <div style={{ fontSize: 12, color: "#7A8696", fontWeight: 600 }}>Estimated Treatment Time</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>≈ {estMonths(c.alignerCount)} months</div>
                </div>
                <div style={{ padding: "18px 20px", borderRight: "1px solid #EEF2F6" }}>
                  <div style={{ fontSize: 12, color: "#7A8696", fontWeight: 600 }}>Treatment Package</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>Invisalign {c.pkg}</div>
                </div>
                <div style={{ padding: "18px 20px", background: "#F0FBF8" }}>
                  <div style={{ fontSize: 12, color: "#0B7A6E", fontWeight: 600 }}>Total Investment</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#0B7A6E" }}>{fmt(c.pricePence)}</div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#8A96A5", margin: "10px 2px 0", lineHeight: 1.5 }}>
              Treatment times are estimates and may vary by ~1 month depending on tooth movement and aligner compliance.
            </p>

            {/* complimentary */}
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "34px 0 4px" }}>Included at no extra cost</h2>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 2 }}>
              {COMP_ITEMS.map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "#F6F9FA" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#DDF3EC", color: "#0B7A6E", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12, flex: "none" }}>✓</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#2C3847" }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#7A8696", textDecoration: "line-through" }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 12, paddingRight: 2 }}>
              <span style={{ fontSize: 14, color: "#5C6a79", fontWeight: 600 }}>Total complimentary value</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0B7A6E" }}>{COMP_TOTAL}</span>
            </div>

            {/* video */}
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "34px 0 14px" }}>Watch your future smile</h2>
            <VideoBlock url={c.videoUrl} />

            {/* payment options */}
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "36px 0 16px" }}>Payment options</h2>
            {c.upfrontPaidPence > 0 && !paid && !depositPaid && (
              <div style={{ border: "1px solid #CFEDE5", background: "#F4FCFA", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16, lineHeight: 1.4 }}>✓</span>
                <div style={{ fontSize: 13.5, color: "#3C4a59", lineHeight: 1.6 }}>
                  Thank you — we&apos;ve received your <strong>{fmt(c.upfrontPaidPence)}</strong> booking payment.
                  It&apos;s already been credited against your treatment, so the balance remaining is{" "}
                  <strong style={{ color: "#0B7A6E" }}>{fmt(net)}</strong>. The options below reflect this.
                </div>
              </div>
            )}
            {paid ? (
              <div style={{ padding: "18px 20px", borderRadius: 14, background: "#E6F6EA", color: "#1C7C3A", fontWeight: 700, fontSize: 15 }}>
                ✓ Your treatment is paid in full — thank you! We&apos;ll be in touch to arrange your aligner fitting.
              </div>
            ) : depositPaid ? (
              <div style={{ border: "1px solid #CFEDE5", background: "#F4FCFA", borderRadius: 16, padding: "20px 22px" }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0B7A6E" }}>✓ Deposit received</div>
                <div style={{ fontSize: 13.5, color: "#5C6a79", marginTop: 4, lineHeight: 1.6 }}>
                  Your remaining 3 instalments of <strong>{fmt(instal)}</strong> are collected automatically each month — nothing more to do.
                </div>
              </div>
            ) : (
              <PaymentOptionsForm token={c.proposalToken} options={payOptions} applicant={applicant} />
            )}

            {/* why us */}
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "36px 0 14px" }}>Why Dental Scotland?</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {WHY_US.map((w) => (
                <div key={w.title} style={{ padding: "16px 18px", borderRadius: 14, background: "#F6F9FA", border: "1px solid #EEF2F6" }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "#16202E" }}>{w.title}</div>
                  <div style={{ fontSize: 13, color: "#5C6a79", marginTop: 4, lineHeight: 1.55 }}>{w.text}</div>
                </div>
              ))}
            </div>

            {/* account creation / login */}
            {!admin && !c.passwordHash && <CreateAccountCard token={c.proposalToken} email={c.email} />}
            {!admin && c.passwordHash && !loggedIn && (
              <div style={{ marginTop: 28, padding: "14px 18px", borderRadius: 12, background: "#F6F9FA", border: "1px solid #EEF2F6", fontSize: 13.5, color: "#5C6a79" }}>
                You have a patient account — <Link href="/login" style={{ color: "#0E9384", fontWeight: 700 }}>log in</Link> any time to return to this page.
              </div>
            )}

            {/* CTA */}
            {!paid && (
              <div style={{ marginTop: 34, padding: 26, borderRadius: 16, background: "#0E1A2B", textAlign: "center" }}>
                <div style={{ color: "#fff", fontSize: 19, fontWeight: 800 }}>Questions before you choose?</div>
                <div style={{ color: "#9FB2C8", fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>Your Treatment Coordinator is happy to talk anything through — no obligation.</div>
                <form action={bookCall} style={{ marginTop: 18 }}>
                  <input type="hidden" name="token" value={c.proposalToken} />
                  <button className="btn btn-teal" style={{ padding: "13px 28px", fontSize: 14.5, fontWeight: 800 }}>
                    Book a follow-up call
                  </button>
                </form>
              </div>
            )}

            <div style={{ marginTop: 28, textAlign: "center", color: "#9AA6B4", fontSize: 12, lineHeight: 1.7 }}>
              Dental Scotland · It&apos;s time to smile · <a href="https://dentalscotland.com" style={{ color: "#9AA6B4" }}>dentalscotland.com</a>
              <br />This proposal is valid for 30 days. Payments are processed securely by Stripe.
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
