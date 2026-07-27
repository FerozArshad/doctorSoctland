import TopBar from "@/components/TopBar";
import PricingSettingsForm from "@/components/PricingSettingsForm";
import { getPricing } from "@/lib/pricing-settings";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requireAdmin();
  const cfg = await getPricing();
  return (
    <>
      <TopBar title="Pricing tiers" sub="Treatment prices, deposit, and payment options for new proposals" />
      <div className="ds-scroll ds-admin-pad" style={{ flex: 1, overflow: "auto" }}>
        <PricingSettingsForm cfg={cfg} />
      </div>
    </>
  );
}
