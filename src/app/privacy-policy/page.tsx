import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Privacy Policy — ${BRAND.name}`,
  description: `How ${BRAND.name} collects, uses and protects your personal information in line with UK data protection law.`,
};

const CONTACT_EMAIL = "concierge@dentalscotland.com";

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
        text: `${BRAND.name} (“we”, “us”, “our”) is committed to protecting your privacy and handling your personal data responsibly.`,
      },
      {
        type: "p",
        text: "This privacy policy explains how we collect, use, store and share personal information when you visit our website, use our patient portal and treatment proposal pages, communicate with us, or receive dental and orthodontic care.",
      },
      {
        type: "p",
        text: "We process personal data in accordance with the UK General Data Protection Regulation (UK GDPR), the Data Protection Act 2018, and guidance from the Information Commissioner’s Office (ICO).",
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
        text: `If you have questions about this policy or how we handle your data, contact us at ${CONTACT_EMAIL} or via ${BRAND.url}.`,
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
          "Identity and contact details — name, email address, telephone number, date of birth and address.",
          "Treatment and clinical information — dental history, orthodontic assessments, treatment plans, ClinCheck records, notes, photographs, scans and correspondence relating to your care.",
          "Consent and documentation — informed consent records, e-signatures, terms acceptance and documents you upload or we share with you.",
          "Payment and finance information — payment preferences, transaction status, deposit and instalment records. Card payments are processed by Stripe; we do not store your full card number.",
          "Communications — emails, WhatsApp messages, appointment reminders, follow-up messages and records of enquiries.",
          "Technical and usage data — IP address, browser type, device information and essential session cookies when you use our secure patient portal.",
          "Staff and administrative records — where relevant to providing your care or managing our relationship with you.",
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
          "Make payments or apply for finance through our services.",
          "Contact us by phone, email or messaging.",
          "Interact with third-party services we use to support your care, such as payment providers.",
        ],
      },
    ],
  },
  {
    title: "6. Lawful bases for processing",
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
    title: "8. Marketing",
    blocks: [
      {
        type: "p",
        text: "We may send you information about our services where you have asked us to, or where we have another lawful basis to do so.",
      },
      {
        type: "p",
        text: "You can opt out of marketing communications at any time by using the unsubscribe link in an email or by contacting us. Opting out of marketing will not affect messages we need to send about your treatment or account.",
      },
    ],
  },
  {
    title: "9. Who we share your data with",
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
          "Email, messaging and hosting providers that help us operate our systems.",
          "IT support and software providers acting under contract.",
          "Professional advisers such as insurers, accountants or lawyers where required.",
          "Regulators, courts or law enforcement where we are legally required to do so.",
        ],
      },
      {
        type: "p",
        text: "Where we use service providers, we require them to protect your data and only process it on our instructions.",
      },
    ],
  },
  {
    title: "10. International transfers",
    blocks: [
      {
        type: "p",
        text: "Some of our service providers may process data outside the UK. Where this happens, we ensure appropriate safeguards are in place, such as UK adequacy regulations, standard contractual clauses, or equivalent protections required by UK data protection law.",
      },
    ],
  },
  {
    title: "11. How long we keep your data",
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
        text: "Payment, consent and correspondence records are kept for as long as needed to manage your care, resolve disputes, and meet legal and accounting obligations.",
      },
      {
        type: "p",
        text: "When data is no longer required, we securely delete or anonymise it.",
      },
    ],
  },
  {
    title: "12. Your rights under UK data protection law",
    blocks: [
      { type: "p", text: "Subject to certain conditions, you have the right to:" },
      {
        type: "ul",
        items: [
          "Access — request a copy of the personal data we hold about you.",
          "Rectification — ask us to correct inaccurate or incomplete data.",
          "Erasure — ask us to delete your data in certain circumstances.",
          "Restriction — ask us to limit how we use your data in certain circumstances.",
          "Object — object to processing based on legitimate interests or for direct marketing.",
          "Data portability — receive certain data in a structured, commonly used format, or ask us to transfer it to another controller where technically feasible.",
          "Withdraw consent — where processing is based on consent, you may withdraw it at any time without affecting the lawfulness of processing before withdrawal.",
        ],
      },
      {
        type: "p",
        text: `To exercise any of these rights, email us at ${CONTACT_EMAIL}. We may need to verify your identity before responding. We aim to respond within one month, as required by law.`,
      },
      {
        type: "p",
        text: "You also have the right to lodge a complaint with the Information Commissioner’s Office (ICO), the UK supervisory authority for data protection: ico.org.uk or 0303 123 1113.",
      },
    ],
  },
  {
    title: "13. Security",
    blocks: [
      {
        type: "p",
        text: "We use appropriate technical and organisational measures to protect your personal data, including encrypted connections (HTTPS), access controls, secure hosting, and staff training.",
      },
      {
        type: "p",
        text: "No method of transmission or storage is completely secure. If you believe your account or data has been compromised, please contact us promptly.",
      },
    ],
  },
  {
    title: "14. Cookies",
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
    title: "15. Children",
    blocks: [
      {
        type: "p",
        text: "Our services may relate to patients under 18. Where a child cannot provide valid consent themselves, we rely on a parent or guardian with parental responsibility, or another lawful basis, to provide consent and information on the child’s behalf as appropriate.",
      },
    ],
  },
  {
    title: "16. Automated decision-making",
    blocks: [
      {
        type: "p",
        text: "We do not use automated decision-making or profiling that produces legal or similarly significant effects on you.",
      },
    ],
  },
  {
    title: "17. Changes to this policy",
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
    title: "18. Contact us",
    blocks: [
      {
        type: "p",
        text: "If you have any questions about this privacy policy or wish to exercise your data protection rights, please contact:",
      },
      {
        type: "p",
        text: `${BRAND.name}\nEmail: ${CONTACT_EMAIL}\nWebsite: ${BRAND.url}`,
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
            Last updated: 25 July 2026
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
