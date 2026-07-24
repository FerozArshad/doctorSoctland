import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getWhatsAppConfig, getWhatsAppHealth } from "@/lib/whatsapp-settings";
import TopBar from "@/components/TopBar";
import WhatsAppSettingsForm from "@/components/WhatsAppSettingsForm";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");

  const cfg = await getWhatsAppConfig();
  const health = cfg.token && cfg.phoneNumberId ? await getWhatsAppHealth() : null;
  const appUrl = process.env.APP_URL || "https://dashboard.dentalscotland.com";

  return (
    <>
      <TopBar title="WhatsApp" sub="Cloud API connection (shared for local + production)" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div className="ds-view">
          <WhatsAppSettingsForm cfg={cfg} appUrl={appUrl} health={health} />
        </div>
      </div>
    </>
  );
}
