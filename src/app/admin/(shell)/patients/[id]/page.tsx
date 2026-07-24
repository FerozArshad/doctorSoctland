import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { estMonths, fmt, netPricePence, paymentPreferenceLabel } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-settings";
import { avatarBg, initials, statusOf, timeAgo } from "@/lib/status";
import { COMP_ITEMS, COMP_TOTAL } from "@/lib/content";
import { approveFinance, markPaid, recordDeposit, sendPatientTemplate, sendProposal, setFinanceStatus } from "@/app/admin/actions";
import { canAccessPatient, requireAdmin } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import MessageLog from "@/components/MessageLog";
import FormSubmitButton from "@/components/FormSubmitButton";
import DeletePatientButton from "@/components/DeletePatientButton";
import AdminFileUpload from "@/components/AdminFileUpload";
import { isMessageActivity } from "@/lib/messages";
import { publicActivityText } from "@/lib/activity-display";
import { patientTemplateText } from "@/lib/patient-templates";
import { CONSENT_PARAGRAPHS, CONSENT_TITLE } from "@/lib/consent";

export const dynamic = "force-dynamic";

const TIMELINE_STEPS = [
  "Draft created",
  "Proposal sent",
  "Interested",
  "Awaiting payment",
  "Deposit paid",
  "Paid in full",
];

export default async function PatientProfile({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const c = await db.patient.findUnique({
    where: { id: params.id },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 80 },
      instalments: { orderBy: { number: "asc" } },
      uploads: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          uploadedBy: true,
          createdAt: true,
        },
      },
    },
  });
  if (!c) notFound();
  if (!canAccessPatient(admin, c)) {
    const q = new URLSearchParams({
      toast: "You don't have access to that patient",
      ticon: "!",
      tbg: "#E0A429",
    });
    redirect(`/admin/patients?${q.toString()}`);
  }
  const cfg = await getPricing();

  const st = statusOf(c.status);
  const overdue = c.status === "overdue";
  const curOrder = st.order;
  // Progress is against what they actually owe (net of any booking credit).
  // Guard the divide — a zero price would render width:"NaN%" and break the bar.
  const netOwed = netPricePence(c.pricePence, c.upfrontPaidPence);
  const paidPct = netOwed > 0 ? Math.min(100, Math.max(0, Math.round((100 * c.amountPaidPence) / netOwed))) : 0;

  const timeline = TIMELINE_STEPS.map((label, i) => {
    const isPaid = c.status === "paid";
    const done = i < curOrder || (isPaid && i <= 5);
    const isCur = i === curOrder && !(isPaid && i < 5);
    const reached = i <= curOrder;
    return {
      label,
      mark: i < curOrder || (isPaid && i === 5) ? "✓" : "",
      sub: isCur ? (overdue ? "Overdue" : "Current stage") : i < curOrder ? "Completed" : "Pending",
      dotBg: i < curOrder || (isPaid && i === 5) ? "#0E9384" : isCur ? (overdue ? "#E5544B" : "#0E9384") : "#fff",
      dotBorder: reached ? (overdue && isCur ? "#E5544B" : "#0E9384") : "#D5DCE5",
      lineColor: i < curOrder ? "#0E9384" : "#EEF2F6",
      labelColor: reached ? "#16202E" : "#9AA6B4",
      done,
    };
  });

  return (
    <>
      <TopBar title="Patient" sub="Treatment & payment details" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div className="ds-view">
          <Link href="/admin/patients" style={{ color: "#7A8696", fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6, marginBottom: 16, textDecoration: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            All patients
          </Link>

          {/* header card */}
          <div className="card" style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 58, height: 58, borderRadius: "50%", background: avatarBg(c.id), color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20, flex: "none" }}>{initials(c.firstName, c.lastName)}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.01em" }}>{c.firstName} {c.lastName}</span>
                  <span className="badge" style={{ color: st.fg, background: st.bg, padding: "4px 11px" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />
                    {st.label}
                  </span>
                  {c.passwordHash && (
                    <span className="badge" style={{ color: "#1B7F6B", background: "#E3F6F0", padding: "4px 11px" }}>Account active</span>
                  )}
                  {c.priceLockExpired && (
                    <span className="badge" title="The 30-day quote window closed — follow-ups have stopped. Requote to re-engage." style={{ color: "#B7791F", background: "#FBF3E2", padding: "4px 11px" }}>
                      Price lock expired — requote
                    </span>
                  )}
                  {c.financeStatus && c.financeStatus !== "none" && (
                    <span
                      className="badge"
                      style={{
                        padding: "4px 11px",
                        color:
                          c.financeStatus === "accepted"
                            ? "#1C7C3A"
                            : c.financeStatus === "declined"
                              ? "#C23B34"
                              : "#7A3EC0",
                        background:
                          c.financeStatus === "accepted"
                            ? "#E6F6EA"
                            : c.financeStatus === "declined"
                              ? "#FBE9E8"
                              : "#F3EBFC",
                      }}
                    >
                      {c.financeStatus === "accepted"
                        ? "Finance accepted"
                        : c.financeStatus === "declined"
                          ? "Finance not accepted"
                          : "Finance pending"}
                    </span>
                  )}
                  {!c.priceLockExpired && c.sequenceTouch > 0 && (
                    <span className="badge" title={`Follow-up sequence: ${c.sequenceTouch} of 7 sent`} style={{ color: "#5C6a79", background: "#F1F4F8", padding: "4px 11px" }}>
                      Follow-up {c.sequenceTouch}/7
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13.5, color: "#7A8696", marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span>{c.email}</span>
                  <span>{c.phone || "—"}</span>
                  {c.sentByName && <span>Sent by {c.sentByName}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Link href={`/admin/patients/${c.id}/proposal`} className={c.status === "draft" ? "btn btn-teal" : "btn btn-outline"} style={{ padding: "11px 18px", fontSize: 13.5, textDecoration: "none" }}>
                {c.status === "draft" ? "Continue proposal" : "Edit proposal"}
              </Link>
              <form action={sendProposal}>
                <input type="hidden" name="patientId" value={c.id} />
                <FormSubmitButton
                  className="btn btn-outline"
                  style={{ padding: "11px 16px", fontSize: 13.5 }}
                  label={c.status === "draft" ? "Send proposal" : "Resend proposal"}
                  pendingLabel="Sending…"
                />
              </form>
              <Link href={`/p/${c.proposalToken}`} className="btn btn-teal" style={{ padding: "11px 18px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
                </svg>
                Open pay link
              </Link>
              <Link href={`/p/${c.proposalToken}?preview=admin`} className="btn btn-outline" style={{ padding: "11px 16px", fontSize: 13.5, textDecoration: "none" }}>
                Preview layout
              </Link>
              {admin.isSuperAdmin && (
                <DeletePatientButton patientId={c.id} patientName={`${c.firstName} ${c.lastName}`.trim()} />
              )}
            </div>
          </div>

          <div className="ds-split" style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 18, marginTop: 18, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Signed consent + statement copy — top of patient record */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
                  {c.consentSignedAt
                    ? c.paymentPreference === "finance" || c.financeStatus !== "none"
                      ? "Signed consent & finance"
                      : "Signed consent"
                    : "Consent & documents"}
                </div>
                {c.consentSignedAt ? (
                  <>
                    <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 14 }}>
                      Consent signed {c.consentSignedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {c.dateOfBirth ? ` · DOB ${c.dateOfBirth}` : ""}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#3C4a59", marginBottom: 8 }}>{CONSENT_TITLE}</div>
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F7FAFC", border: "1px solid #E7ECF2", maxHeight: 220, overflow: "auto", marginBottom: 14 }}>
                      {CONSENT_PARAGRAPHS.map((p, i) => (
                        <p key={i} style={{ fontSize: 12.5, color: "#3C4a59", lineHeight: 1.55, margin: i === 0 ? 0 : "10px 0 0" }}>{p}</p>
                      ))}
                    </div>
                    {c.consentSignature && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.consentSignature} alt="Patient signature" style={{ maxWidth: "100%", height: 90, objectFit: "contain", border: "1px solid #E7ECF2", borderRadius: 10, background: "#fff", padding: 6, display: "block" }} />
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 13.5, color: "#9AA6B4", lineHeight: 1.55 }}>
                    No consent signature yet — it appears here when the patient signs on their proposal.
                  </div>
                )}

                {/* Finance status — persists independently of payment stage */}
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #EEF2F6" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Finance (external)</div>
                  <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 12, lineHeight: 1.5 }}>
                    Mark whether finance was accepted. This badge stays visible even if they later pay another way.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {(["applied", "accepted", "declined"] as const).map((s) => (
                      <form key={s} action={setFinanceStatus}>
                        <input type="hidden" name="patientId" value={c.id} />
                        <input type="hidden" name="financeStatus" value={s} />
                        <FormSubmitButton
                          variant="outline"
                          label={s === "applied" ? "Pending" : s === "accepted" ? "Accepted" : "Not accepted"}
                          pendingLabel="Updating…"
                          style={{
                            padding: "8px 12px",
                            fontSize: 12.5,
                            borderColor: c.financeStatus === s ? "#0E9384" : "#E1E7EE",
                            background: c.financeStatus === s ? "#E3F6F0" : "#fff",
                            color: c.financeStatus === s ? "#0B7A6E" : "#5C6a79",
                            fontWeight: 700,
                          }}
                        />
                      </form>
                    ))}
                  </div>
                  {c.financeStatus === "accepted" && c.financeLink ? (
                    <div style={{ padding: "12px 14px", borderRadius: 12, background: "#E6F6EA", color: "#1C7C3A", fontSize: 13, fontWeight: 600 }}>
                      ✓ Accepted{c.financeApprovedAt ? ` ${c.financeApprovedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""} — link emailed.
                      <div style={{ fontWeight: 500, marginTop: 4, wordBreak: "break-all" }}>
                        <a href={c.financeLink} style={{ color: "#0B7A6E" }}>{c.financeLink}</a>
                      </div>
                    </div>
                  ) : (c.financeStatus === "applied" || c.paymentPreference === "finance") && !c.financeApprovedAt ? (
                    <form action={approveFinance}>
                      <input type="hidden" name="patientId" value={c.id} />
                      <label className="label">Finance / info link to send</label>
                      <input className="input" name="financeLink" placeholder="https://…" defaultValue={c.financeLink} />
                      <FormSubmitButton
                        className="btn btn-teal"
                        style={{ marginTop: 10, width: "100%", padding: 11, fontSize: 13.5 }}
                        label="Approve & email finance link"
                        pendingLabel="Sending…"
                      />
                    </form>
                  ) : null}
                </div>
              </div>

              {/* files — above treatment plan */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Files &amp; documents</div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 14 }}>
                  Upload up to 5 files for this patient (consent forms, photos, PDFs). They appear at the top of the patient&apos;s proposal — patients can view but not upload.
                  {c.uploads.length > 0 && (
                    <>
                      {" "}
                      <Link href={`/p/${c.proposalToken}?preview=admin`} style={{ color: "#0E9384", fontWeight: 700 }}>
                        Preview proposal →
                      </Link>
                    </>
                  )}
                </div>
                <AdminFileUpload patientId={c.id} />
                {c.uploads.length === 0 ? (
                  <div style={{ marginTop: 14, fontSize: 13.5, color: "#9AA6B4" }}>No files yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                    {c.uploads.map((u) => (
                      <a
                        key={u.id}
                        href={`/api/admin/patients/${c.id}/files/${u.id}`}
                        download={u.fileName}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 11, border: "1px solid #EEF2F6", background: "#FBFCFD", textDecoration: "none", color: "inherit" }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {u.fileName}</div>
                          <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 2 }}>
                            {Math.round(u.sizeBytes / 1024)} KB · {u.uploadedBy === "admin" ? "Admin" : "Patient"} · {u.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0E9384", flex: "none" }}>Download</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* plan */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Treatment plan</div>
                <div className="ds-quad" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                  <div style={{ background: "#FBFCFD", border: "1px solid #EEF2F6", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 12, color: "#8A96A5", fontWeight: 600 }}>Aligners</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{c.alignerCount}</div>
                  </div>
                  <div style={{ background: "#FBFCFD", border: "1px solid #EEF2F6", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 12, color: "#8A96A5", fontWeight: 600 }}>Duration</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{estMonths(c.alignerCount)}<span style={{ fontSize: 13, color: "#7A8696" }}>mo</span></div>
                  </div>
                  <div style={{ background: "#FBFCFD", border: "1px solid #EEF2F6", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 12, color: "#8A96A5", fontWeight: 600 }}>Package</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{c.pkg}</div>
                  </div>
                  <div style={{ background: "#F0FBF8", border: "1px solid #CFEDE5", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 12, color: "#0B7A6E", fontWeight: 600 }}>
                      {c.upfrontPaidPence > 0 ? "Amount to pay" : "Total"}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#0B7A6E" }}>{fmt(netOwed)}</div>
                    {c.upfrontPaidPence > 0 && (
                      <div style={{ fontSize: 11.5, color: "#5C6a79", marginTop: 4 }}>
                        {fmt(c.pricePence)} − {fmt(c.upfrontPaidPence)} booking
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "#0E1A2B" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center", flex: "none" }}>
                    <div style={{ width: 0, height: 0, borderLeft: "11px solid #fff", borderTop: "7px solid transparent", borderBottom: "7px solid transparent", marginLeft: 3 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700 }}>ClinCheck video attached</div>
                    <div style={{ color: "#8FA6C0", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.videoUrl || "No video link added"}</div>
                  </div>
                </div>
              </div>

              {/* complimentary */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Complimentary (included)</div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0B7A6E" }}>{COMP_TOTAL} value</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {COMP_ITEMS.map((item) => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#FBFCFD", border: "1px solid #EEF2F6" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#DDF3EC", color: "#0B7A6E", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 10 }}>✓</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#2C3847" }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: 12.5, color: "#9AA6B4", fontWeight: 700 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* payment progress */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Payment</div>
                {c.paymentPreference && (
                  <div style={{ marginBottom: 14, padding: "11px 14px", borderRadius: 11, background: "#F3EBFC", border: "1px solid #E4D3F7", fontSize: 13.5, color: "#7A3EC0", fontWeight: 700 }}>
                    Patient&apos;s choice: {paymentPreferenceLabel(c.paymentPreference, cfg.depositPence)}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontSize: 26, fontWeight: 800 }}>{fmt(c.amountPaidPence)}</span>
                  <span style={{ fontSize: 13.5, color: "#7A8696" }}>of {fmt(netOwed)} to collect</span>
                </div>
                <div style={{ height: 12, borderRadius: 8, background: "#F0F3F7", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 8, background: "linear-gradient(90deg,#0E9384,#12B39E)", width: paidPct + "%" }} />
                </div>

                {c.instalments.length > 0 && (
                  <div style={{ marginTop: 16, border: "1px solid #EEF2F6", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", background: "#FAFBFC", fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8A96A5" }}>Scheduled instalments (auto-collected)</div>
                    {c.instalments.map((inst) => (
                      <div key={inst.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderTop: "1px solid #F1F4F8", fontSize: 13.5 }}>
                        <span style={{ fontWeight: 700 }}>Instalment {inst.number}/3 · {fmt(inst.amountPence)}</span>
                        <span style={{ color: "#7A8696" }}>{inst.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className="badge" style={{
                          color: inst.status === "paid" ? "#1C7C3A" : inst.status === "failed" ? "#C23B34" : "#B7791F",
                          background: inst.status === "paid" ? "#E6F6EA" : inst.status === "failed" ? "#FBE9E8" : "#FBF3E2",
                        }}>
                          {inst.status === "paid" ? "Paid" : inst.status === "failed" ? "Failed" : "Scheduled"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <form action={recordDeposit} style={{ flex: 1, display: "flex" }}>
                    <input type="hidden" name="patientId" value={c.id} />
                    <FormSubmitButton
                      className="btn btn-outline"
                      style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 13.5 }}
                      label={`Record ${fmt(cfg.depositPence)} deposit`}
                      pendingLabel="Saving…"
                    />
                  </form>
                  <form action={markPaid} style={{ flex: 1, display: "flex" }}>
                    <input type="hidden" name="patientId" value={c.id} />
                    <FormSubmitButton
                      className="btn btn-dark"
                      style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 13.5 }}
                      label="Mark paid in full"
                      pendingLabel="Saving…"
                    />
                  </form>
                </div>
              </div>

              {/* quick message templates */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Message templates</div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 14, lineHeight: 1.5 }}>
                  One-click send to {c.firstName} by email (and WhatsApp when available).
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "#F7FAFC", border: "1px solid #E7ECF2", fontSize: 13, color: "#3C4a59", lineHeight: 1.6, marginBottom: 12 }}>
                  {patientTemplateText("invisalign_ordered", c.firstName)}
                </div>
                <form action={sendPatientTemplate}>
                  <input type="hidden" name="patientId" value={c.id} />
                  <input type="hidden" name="template" value="invisalign_ordered" />
                  <FormSubmitButton
                    className="btn btn-teal"
                    style={{ width: "100%", padding: 12, fontSize: 13.5 }}
                    label="Send “Invisalign ordered”"
                    pendingLabel="Sending…"
                  />
                </form>
              </div>

              <MessageLog patient={c} activities={c.activities} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* timeline */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Status</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {timeline.map((t) => (
                    <div key={t.label} style={{ display: "flex", gap: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: t.dotBg, border: `2px solid ${t.dotBorder}`, display: "grid", placeItems: "center", flex: "none" }}>
                          <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>{t.mark}</span>
                        </div>
                        <div style={{ width: 2, flex: 1, background: t.lineColor, minHeight: 18 }} />
                      </div>
                      <div style={{ paddingBottom: 16 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.labelColor }}>{t.label}</div>
                        <div style={{ fontSize: 12, color: "#9AA6B4" }}>{t.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* activity */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Activity</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {c.activities.filter((a) => !isMessageActivity(a.text)).map((a) => (
                    <div key={a.id} style={{ display: "flex", gap: 12, padding: "9px 0" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0E9384", marginTop: 6, flex: "none" }} />
                      <div>
                        <div style={{ fontSize: 13, color: "#2C3847", lineHeight: 1.4 }}>{publicActivityText(a.text)}</div>
                        <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 1 }}>{timeAgo(a.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {c.notes && (
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Notes</div>
                  <div style={{ fontSize: 13.5, color: "#3C4a59", lineHeight: 1.6 }}>{c.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
