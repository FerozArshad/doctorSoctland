import TopBar from "@/components/TopBar";
import WhatsAppConnect from "@/components/WhatsAppConnect";

export const dynamic = "force-dynamic";

export default function WhatsAppConnectPage() {
  return (
    <>
      <TopBar title="WhatsApp" sub="Connect your number to the Cloud API" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <WhatsAppConnect />
      </div>
    </>
  );
}
