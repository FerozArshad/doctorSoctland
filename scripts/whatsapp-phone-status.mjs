import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const GRAPH = "https://graph.facebook.com/v21.0";

function pick(dbVal, envVal) {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim();
}

async function main() {
  const row = await db.whatsAppSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  const token = pick(row?.token, process.env.WHATSAPP_TOKEN);
  const phoneNumberId = pick(row?.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID);
  if (!token || !phoneNumberId) {
    console.log(JSON.stringify({ error: "WhatsApp not configured" }, null, 2));
    return;
  }

  const fields = [
    "id",
    "display_phone_number",
    "verified_name",
    "code_verification_status",
    "name_status",
    "quality_rating",
    "platform_type",
    "throughput",
    "status",
    "is_on_biz_app",
    "account_mode",
    "health_status",
  ].join(",");

  const res = await fetch(`${GRAPH}/${phoneNumberId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const phone = await res.json();

  const wabaId =
    phone?.health_status?.entities?.find((e) => e.entity_type === "WABA")?.id ||
    process.env.WHATSAPP_WABA_ID ||
    "2294276881326866";
  const wabaRes = await fetch(`${GRAPH}/${wabaId}?fields=id,name,account_review_status,on_behalf_of_business_info`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const waba = await wabaRes.json();

  const appsRes = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const apps = await appsRes.json();

  console.log(
    JSON.stringify(
      {
        phoneNumberId,
        wabaId,
        phone: {
          ok: res.ok,
          status: phone.status,
          code_verification_status: phone.code_verification_status,
          verified_name: phone.verified_name,
          name_status: phone.name_status,
          display_phone_number: phone.display_phone_number,
          platform_type: phone.platform_type,
          is_on_biz_app: phone.is_on_biz_app,
          account_mode: phone.account_mode,
          waba_health: phone.health_status?.entities?.find((e) => e.entity_type === "WABA"),
          phone_health: phone.health_status?.entities?.find((e) => e.entity_type === "PHONE_NUMBER"),
        },
        waba: {
          ok: wabaRes.ok,
          name: waba.name,
          account_review_status: waba.account_review_status,
        },
        subscribedApps: apps.data?.map((a) => a.whatsapp_business_api_data) || [],
        registerEndpoint: `POST ${GRAPH}/${phoneNumberId}/register`,
        registerBody: { messaging_product: "whatsapp", pin: "<6-digit-two-step-PIN>" },
        note: "Max 10 register attempts per 72 hours. Do not retry without the correct PIN.",
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());
