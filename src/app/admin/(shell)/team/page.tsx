// Team management — Super Admin only. Creates isolated admin logins: each
// plain admin sees only the patients they own or sent, and their own reports.
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { initials, timeAgo } from "@/lib/status";
import { createAdminAccount } from "@/app/admin/actions";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");

  const admins = await db.admin.findMany({ orderBy: { createdAt: "asc" } });
  // Patients attributed to each admin (owned or sent by them).
  const counts = await Promise.all(
    admins.map((a) =>
      db.patient.count({ where: { OR: [{ ownerId: a.id }, { sentByEmail: a.email }] } })
    )
  );

  return (
    <>
      <TopBar title="Team" sub="Admin accounts & access" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div className="ds-view" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, alignItems: "start" }}>
          {/* admin list */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #EEF2F6" }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Admins</div>
              <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2 }}>
                Plain admins see only their own patients and stats. Super Admins see everything.
              </div>
            </div>
            {admins.map((a, i) => {
              const [first, ...rest] = a.name.replace(/^Dr\.?\s+/i, "").split(" ");
              return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid #F1F4F8" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: a.isSuperAdmin ? "#0E9384" : "#33465F", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, flex: "none" }}>
                  {initials(first || "?", rest.join(" "))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                    {a.name}
                    {a.id === me.id && <span style={{ fontSize: 11, color: "#9AA6B4", fontWeight: 600 }}> (you)</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#8A96A5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.email} · {a.role}</div>
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <span className="badge" style={{ fontSize: 11, background: a.isSuperAdmin ? "#DDF3EC" : "#EEF2F6", color: a.isSuperAdmin ? "#0B7A6E" : "#5C6a79" }}>
                    {a.isSuperAdmin ? "Super Admin" : "Admin"}
                  </span>
                  <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 4 }}>{counts[i]} patients · added {timeAgo(a.createdAt)}</div>
                </div>
              </div>
              );
            })}
          </div>

          {/* create admin */}
          <form action={createAdminAccount} className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Add an admin</div>
            <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2, lineHeight: 1.6 }}>
              They log in at <strong>/admin</strong> with the email and password you set here.
            </div>
            <div style={{ marginTop: 18 }}>
              <label className="label">Full name *</label>
              <input className="input" name="name" placeholder="Millie Buchanan" required />
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="label">Email *</label>
              <input className="input" name="email" type="email" placeholder="millie@dentalscotland.com" required />
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="label">Password * (min 8 characters)</label>
              <input className="input" name="password" type="password" minLength={8} required />
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="label">Role title</label>
              <input className="input" name="role" placeholder="Treatment Coordinator" />
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, cursor: "pointer" }}>
              <input type="checkbox" name="isSuperAdmin" style={{ width: 17, height: 17, accentColor: "#0E9384", marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#3C4a59", lineHeight: 1.5 }}>
                <strong>Super Admin</strong> — sees all patients, revenue and every admin&apos;s reports
              </span>
            </label>
            <button className="btn btn-teal" style={{ marginTop: 20, width: "100%", padding: 13 }}>Create admin</button>
          </form>
        </div>
      </div>
    </>
  );
}
