// Team management — Super Admin only. Creates isolated admin logins: each
// plain admin sees only the patients they own or sent, and their own reports.
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { initials, timeAgo } from "@/lib/status";
import TopBar from "@/components/TopBar";
import AdminTeamMemberCard from "@/components/AdminTeamMemberCard";
import CreateAdminForm from "@/components/CreateAdminForm";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");

  const admins = await db.admin.findMany({ orderBy: { createdAt: "asc" } });
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
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #EEF2F6" }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Admins</div>
              <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2 }}>
                Manage profiles, reset passwords, and resend login emails. Plain admins see only their own patients.
              </div>
            </div>
            {admins.map((a, i) => {
              const [first, ...rest] = a.name.replace(/^Dr\.?\s+/i, "").split(" ");
              const isSelf = a.id === me.id;
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "14px 20px",
                    borderBottom: "1px solid #F1F4F8",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: a.isSuperAdmin ? "#0E9384" : "#33465F",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: 13,
                      flex: "none",
                    }}
                  >
                    {initials(first || "?", rest.join(" "))}
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                      {a.name}
                      {isSelf && <span style={{ fontSize: 11, color: "#9AA6B4", fontWeight: 600 }}> (you)</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#8A96A5", wordBreak: "break-word" }}>
                      {a.email} · {a.role}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: 11,
                          background: a.isSuperAdmin ? "#DDF3EC" : "#EEF2F6",
                          color: a.isSuperAdmin ? "#0B7A6E" : "#5C6a79",
                        }}
                      >
                        {a.isSuperAdmin ? "Super Admin" : "Admin"}
                      </span>
                      <span style={{ fontSize: 12, color: "#9AA6B4", marginLeft: 8 }}>
                        {counts[i]} patients · added {timeAgo(a.createdAt)}
                      </span>
                    </div>
                  </div>
                  <AdminTeamMemberCard
                    isSelf={isSelf}
                    admin={{
                      id: a.id,
                      name: a.name,
                      email: a.email,
                      role: a.role,
                      isSuperAdmin: a.isSuperAdmin,
                      patientCount: counts[i] ?? 0,
                      addedLabel: timeAgo(a.createdAt),
                    }}
                  />
                </div>
              );
            })}
          </div>

          <CreateAdminForm />
        </div>
      </div>
    </>
  );
}
