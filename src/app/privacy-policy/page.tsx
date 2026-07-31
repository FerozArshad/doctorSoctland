import type { Metadata } from "next";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";

const APP_URL = (process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, "");
const CONTACT_EMAIL = "concierge@dentalscotland.com";

export const metadata: Metadata = {
  title: `Privacy Policy — ${BRAND.name}`,
  description: `Official privacy policy for ${BRAND.name}. Explains what personal data we collect, how we use it, how we use WhatsApp and Meta services, and how you can request deletion of your data under UK GDPR.`,
  metadataBase: new URL(APP_URL),
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    title: `Privacy Policy — ${BRAND.name}`,
    description: `How ${BRAND.name} collects, uses, stores and deletes personal information in line with UK data protection law.`,
    url: "/privacy-policy",
    siteName: BRAND.name,
    locale: "en_GB",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const dynamic = "force-static";

type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };

type Section = {
  title: string;
  blocks: Block[];
};

const sections: Section[] = [
  {
    title: "1. Introduction",
    blocks: [
      {
        type: "p",
        text: `This is the official privacy policy for ${BRAND.name}. It applies to our website, patient portal at ${APP_URL}, treatment proposal pages, payment services, email communications, and WhatsApp messaging.`,
      },
      {
        type: "p",
        text: `${BRAND.name} (“we”, “us”, “our”) is committed to protecting your privacy and handling your personal data responsibly.`,
      },
      {
        type: "p",
        text: "We process personal data in accordance with the UK General Data Protection Regulation (UK GDPR), the Data Protection Act 2018, the Privacy and Electronic Communications Regulations (PECR), and guidance from the Information Commissioner’s Office (ICO).",
      },
    ],
  },
  {
    title: "2. Who is responsible for your data?",
    blocks: [
      {
        type: "p",
        text: `For the purposes of UK data protection law, ${BRAND.name} is the data controller of the personal information described in this policy.`,
      },
      {
        type: "p",
        text: `Data protection enquiries: ${CONTACT_EMAIL}\nWebsite: ${BRAND.url}\nPatient portal: ${APP_URL}`,
      },
    ],
  },
  {
    title: "3. What personal data we collect",
    blocks: [
      { type: "p", text: "We may collect and process the following categories of information:" },
      {
        type: "ul",
        items: [
          "Identity and contact details — name, email address, telephone number (including WhatsApp number), date of birth and address.",
          "Treatment and clinical information — dental history, orthodontic assessments, treatment plans, ClinCheck records, notes, photographs, scans and correspondence relating to your care.",
          "Consent and documentation — informed consent records, e-signatures, terms acceptance and documents you upload or we share with you.",
          "Payment and finance information — payment preferences, transaction status, deposit and instalment records. Card payments are processed by Stripe; we do not store your full card number.",
          "Communications — emails, WhatsApp messages, one-time verification codes, appointment reminders, follow-up messages and records of enquiries.",
          "Messaging metadata — message delivery status, timestamps and limited profile information provided by messaging platforms when you contact us or we message you.",
          "Technical and usage data — IP address, browser type, device information and essential session cookies when you use our secure patient portal.",
        ],
      },
    ],
  },
  {
    title: "4. Special category (health) data",
    blocks: [
      {
        type: "p",
        text: "Some information we hold about you relates to your health and is treated as special category personal data under UK law.",
      },
      {
        type: "p",
        text: "We only process health-related information where this is necessary to provide dental or orthodontic treatment, to maintain clinical records, for reasons of substantial public interest in the area of public health, or with your explicit consent where required.",
      },
    ],
  },
  {
    title: "5. How we collect your data",
    blocks: [
      { type: "p", text: "We collect personal data when you:" },
      {
        type: "ul",
        items: [
          "Complete forms on our website or patient portal.",
          "Attend consultations, assessments or treatment.",
          "Open secure proposal links sent by email or WhatsApp.",
          "Request a one-time login or verification code by email or WhatsApp.",
          "Make payments or apply for finance through our services.",
          "Contact us by phone, email or WhatsApp.",
          "Interact with third-party services we use to support your care, such as payment or messaging providers.",
        ],
      },
    ],
  },
  {
    title: "6. Lawful bases and purposes for processing",
    blocks: [
      {
        type: "p",
        text: "We only use your personal data where the law allows. Depending on the activity, we rely on one or more of the following lawful bases:",
      },
      {
        type: "ul",
        items: [
          "Performance of a contract — to provide treatment proposals, care, payments and related services you have requested.",
          "Legal obligation — to comply with laws applying to dental practices, tax, accounting, and regulatory requirements.",
          "Legitimate interests — to operate and improve our services, prevent fraud, maintain security, and communicate with you about your care, provided your rights do not override those interests.",
          "Consent — where you have given clear consent, for example for certain marketing communications or optional processing.",
          "Vital interests — in rare circumstances where necessary to protect someone’s life.",
          "Substantial public interest / health and social care — for processing special category health data necessary for the provision of health treatment and maintenance of clinical records.",
        ],
      },
      {
        type: "p",
        text: "Purposes for which we process your data include providing dental care, sending treatment proposals and payment options, verifying your identity, processing payments, sending service-related messages (including via WhatsApp), maintaining records, and meeting legal obligations.",
      },
    ],
  },
  {
    title: "7. How we use your information",
    blocks: [
      { type: "p", text: "We use personal data to:" },
      {
        type: "ul",
        items: [
          "Provide dental and orthodontic assessments, treatment plans and ongoing care.",
          "Send secure treatment proposals, videos, documents and payment options.",
          "Send one-time verification codes to unlock your secure proposal link.",
          "Process card payments, deposits and instalments.",
          "Support finance applications and communicate about payment choices.",
          "Send appointment reminders, follow-up messages and service updates relating to your care.",
          "Maintain accurate clinical and business records.",
          "Respond to enquiries and complaints.",
          "Meet our legal, regulatory and insurance obligations.",
          "Protect the security and integrity of our systems.",
        ],
      },
    ],
  },
  {
    title: "8. WhatsApp and Meta services",
    blocks: [
      {
        type: "p",
        text: "We use the WhatsApp Business Platform (provided by Meta Platforms Technologies Ltd) to send service-related messages, such as treatment proposal links, appointment reminders, follow-up messages, and one-time verification codes, where you have provided your mobile number and chosen to receive messages by WhatsApp.",
      },
      {
        type: "p",
        text: "When we use WhatsApp, we may process your phone number, message content, delivery and read receipts, and limited profile information made available by the platform. Meta acts as an independent data controller for its own processing. Meta’s privacy policy is available at https://www.whatsapp.com/legal/privacy-policy.",
      },
      {
        type: "p",
        text: "Inbound WhatsApp messages to our business number may be processed by our patient dashboard and, where relevant to a separate Dental Scotland membership programme (Gold Card), forwarded securely to our affiliate service at affiliate.dentalscotland.com. That programme has its own signup flow and consent wording; membership signup is not started by generic replies such as “Hi” unless you began the flow using a Gold Card referral link or QR code.",
      },
      {
        type: "ul",
        items: [
          "Service messages (proposals, OTP codes, payment-related follow-ups) use Meta-approved message templates where required by WhatsApp policy.",
          "We do not use WhatsApp to send unsolicited marketing without a lawful basis and appropriate consent.",
          "Marketing communications are separate from service messages — we will not send marketing WhatsApp templates unless you have given specific marketing consent.",
          "We do not sell your WhatsApp data to third parties.",
          "You can ask us to stop WhatsApp messages by contacting us at " + CONTACT_EMAIL + " or blocking our number in WhatsApp. If you reply STOP, we will treat that as a request to opt out of further messages from us and update our records accordingly.",
          "Our use of WhatsApp for treatment purposes is limited to communicating about your care, proposals, payments and account access.",
        ],
      },
    ],
  },
  {
    title: "9. Gold Card membership programme",
    blocks: [
      {
        type: "p",
        text: "Dental Scotland may operate a separate membership or referral programme (Gold Card) hosted at affiliate.dentalscotland.com. If you join through WhatsApp, we (or our affiliate service provider) will record the consent wording shown to you, the time you agreed, and your WhatsApp identifier, separately from any marketing preferences.",
      },
      {
        type: "p",
        text: "Membership consent does not automatically mean you agree to marketing. If we ask for marketing consent, it will be presented separately and you may decline it while still using membership benefits where applicable.",
      },
    ],
  },
  {
    title: "10. Marketing",
    blocks: [
      {
        type: "p",
        text: "We may send you information about our services where you have asked us to, or where we have another lawful basis to do so, in line with PECR and UK GDPR.",
      },
      {
        type: "p",
        text: "You can opt out of marketing communications at any time by using the unsubscribe link in an email, replying STOP to a WhatsApp message, or contacting us. Opting out of marketing will not affect messages we need to send about your treatment or account.",
      },
    ],
  },
  {
    title: "11. Who we share your data with",
    blocks: [
      {
        type: "p",
        text: "We do not sell your personal data. We may share information with trusted third parties where necessary, including:",
      },
      {
        type: "ul",
        items: [
          "Payment processors (such as Stripe) to take secure card payments.",
          "Finance providers, where you choose to apply for finance.",
          "Meta / WhatsApp to deliver messages you have requested or agreed to receive.",
          "Our affiliate platform (affiliate.dentalscotland.com) for Gold Card membership signups initiated via WhatsApp referral flows.",
          "Email, messaging and hosting providers that help us operate our systems.",
          "IT support and software providers acting under contract as data processors.",
          "Professional advisers such as insurers, accountants or lawyers where required.",
          "Regulators, courts or law enforcement where we are legally required to do so.",
        ],
      },
      {
        type: "p",
        text: "Where we use service providers, we require them to protect your data and only process it on our instructions under appropriate contractual safeguards.",
      },
    ],
  },
  {
    title: "12. International transfers",
    blocks: [
      {
        type: "p",
        text: "Some of our service providers (including Meta, Stripe and cloud hosting providers) may process data outside the UK. Where this happens, we ensure appropriate safeguards are in place, such as UK adequacy regulations, the UK International Data Transfer Agreement, standard contractual clauses, or equivalent protections required by UK data protection law.",
      },
    ],
  },
  {
    title: "13. How long we keep your data",
    blocks: [
      {
        type: "p",
        text: "We keep personal data only for as long as necessary for the purposes set out in this policy.",
      },
      {
        type: "p",
        text: "Clinical records are retained in line with UK dental record-keeping requirements and professional guidance — typically for a minimum period after your last attendance, and often longer where required for clinical, legal or insurance reasons.",
      },
      {
        type: "p",
        text: "Payment, consent, messaging and correspondence records are kept for as long as needed to manage your care, resolve disputes, and meet legal and accounting obligations.",
      },
      {
        type: "p",
        text: "When data is no longer required, we securely delete or anonymise it.",
      },
    ],
  },
  {
    title: "14. How to request deletion of your data",
    blocks: [
      {
        type: "p",
        text: "You have the right to ask us to delete your personal data in certain circumstances under UK GDPR (the “right to erasure”).",
      },
      {
        type: "p",
        text: "To request deletion of your data, email us at " + CONTACT_EMAIL + " with the subject line “Data deletion request” and include:",
      },
      {
        type: "ul",
        items: [
          "Your full name.",
          "The email address and/or phone number we hold for you.",
          "A brief description of what you would like deleted (for example: portal account, messaging records, or all personal data we hold).",
        ],
      },
      {
        type: "p",
        text: "We will verify your identity before processing the request and respond within one month, as required by law. We may need to retain certain information where we have a legal obligation or legitimate reason to do so (for example, clinical records we are required to keep, or payment records for tax purposes).",
      },
      {
        type: "p",
        text: "Deleting data from our systems does not automatically delete messages already delivered via WhatsApp on your device or records held independently by Meta. You may also contact Meta directly regarding data held on their platforms.",
      },
    ],
  },
  {
    title: "15. Your other rights under UK data protection law",
    blocks: [
      { type: "p", text: "Subject to certain conditions, you also have the right to:" },
      {
        type: "ul",
        items: [
          "Access — request a copy of the personal data we hold about you.",
          "Rectification — ask us to correct inaccurate or incomplete data.",
          "Restriction — ask us to limit how we use your data in certain circumstances.",
          "Object — object to processing based on legitimate interests or for direct marketing.",
          "Data portability — receive certain data in a structured, commonly used format, or ask us to transfer it to another controller where technically feasible.",
          "Withdraw consent — where processing is based on consent, you may withdraw it at any time without affecting the lawfulness of processing before withdrawal.",
        ],
      },
      {
        type: "p",
        text: `To exercise any of these rights, email ${CONTACT_EMAIL}. We aim to respond within one month.`,
      },
      {
        type: "p",
        text: "You also have the right to lodge a complaint with the Information Commissioner’s Office (ICO), the UK supervisory authority for data protection: https://ico.org.uk or 0303 123 1113.",
      },
    ],
  },
  {
    title: "16. Security",
    blocks: [
      {
        type: "p",
        text: "We use appropriate technical and organisational measures to protect your personal data, including encrypted connections (HTTPS), access controls, secure hosting, and staff training.",
      },
      {
        type: "p",
        text: "No method of transmission or storage is completely secure. If you believe your account or data has been compromised, please contact us promptly at " + CONTACT_EMAIL + ".",
      },
    ],
  },
  {
    title: "17. Cookies",
    blocks: [
      {
        type: "p",
        text: "Our patient portal uses essential cookies and similar technologies required for security, authentication and session management. These are necessary for the site to function and do not require consent under UK rules.",
      },
      {
        type: "p",
        text: "We do not use non-essential tracking or advertising cookies on the proposal and payment pages.",
      },
    ],
  },
  {
    title: "18. Children",
    blocks: [
      {
        type: "p",
        text: "Our services may relate to patients under 18. Where a child cannot provide valid consent themselves, we rely on a parent or guardian with parental responsibility, or another lawful basis, to provide consent and information on the child’s behalf as appropriate.",
      },
    ],
  },
  {
    title: "19. Automated decision-making",
    blocks: [
      {
        type: "p",
        text: "We do not use automated decision-making or profiling that produces legal or similarly significant effects on you.",
      },
    ],
  },
  {
    title: "20. Changes to this policy",
    blocks: [
      {
        type: "p",
        text: "We may update this privacy policy from time to time to reflect changes in our practices, technology or legal requirements. The “Last updated” date at the top of this page will change when we do.",
      },
      {
        type: "p",
        text: "Where changes are significant, we will take reasonable steps to inform you, for example by email or a notice on our website.",
      },
    ],
  },
  {
    title: "21. Contact us",
    blocks: [
      {
        type: "p",
        text: "If you have any questions about this privacy policy, our use of WhatsApp or Meta services, or wish to exercise your data protection rights, please contact:",
      },
      {
        type: "p",
        text: `${BRAND.name}\nEmail: ${CONTACT_EMAIL}\nWebsite: ${BRAND.url}\nPatient portal: ${APP_URL}`,
      },
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#E8F4FB 0%,#F4F7F9 100%)",
        padding: "24px 20px 40px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ background: "#0B1828", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
          <BrandLogo width={150} height={40} priority />
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px 32px", boxShadow: "0 20px 50px -30px rgba(11,24,40,.25)" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "#0E1A2B" }}>Privacy policy</h1>
          <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "#7A8696", lineHeight: 1.6 }}>
            Last updated: 31 July 2026 · Public policy for {APP_URL.replace("https://", "")}
          </p>
          {sections.map((s) => (
            <section key={s.title} style={{ marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800, color: "#16202E" }}>{s.title}</h2>
              {s.blocks.map((block, i) =>
                block.type === "p" ? (
                  <p key={`${s.title}-p-${i}`} style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.7, color: "#3C4a59", whiteSpace: "pre-line" }}>
                    {block.text}
                  </p>
                ) : (
                  <ul key={`${s.title}-ul-${i}`} style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "#3C4a59" }}>
                    {block.items.map((item) => (
                      <li key={item.slice(0, 48)} style={{ marginBottom: 6 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: "#7A8696" }}>
          <Link href="/login" style={{ color: "#1EA8D8", fontWeight: 700, textDecoration: "none" }}>
            Patient login
          </Link>
          {" · "}
          <a href={BRAND.url} style={{ color: "#1EA8D8", fontWeight: 700, textDecoration: "none" }}>
            dentalscotland.com
          </a>
        </p>
      </div>
    </div>
  );
}
