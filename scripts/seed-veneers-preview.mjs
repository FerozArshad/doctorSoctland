import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const email = "preview.veneers@dentalscotland.com";
const existing = await db.patient.findUnique({ where: { email } });

const data = {
  firstName: "Preview",
  lastName: "Veneers",
  email,
  phone: "07700900000",
  treatmentType: "veneers",
  alignerCount: 10,
  includeWhitening: false,
  pkg: "Go",
  videoUrl: "",
  notes: "Demo patient for veneers UI preview",
  status: "sent",
  pricePence: 350000,
  discountPct: 5,
  upfrontPaidPence: 25000,
  sentByName: "Millie Buchanan",
  sentByEmail: "millie@dentalscotland.com",
};

let patient;
if (existing) {
  patient = await db.patient.update({ where: { id: existing.id }, data });
} else {
  patient = await db.patient.create({ data });
}

console.log(
  JSON.stringify({
    id: patient.id,
    token: patient.proposalToken,
    previewUrl: `http://localhost:3000/p/${patient.proposalToken}?preview=admin`,
    proposalUrl: `http://localhost:3000/admin/patients/${patient.id}/proposal`,
  })
);

await db.$disconnect();
