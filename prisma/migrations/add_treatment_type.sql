-- Safe to run multiple times (production + local).
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "treatmentType" TEXT NOT NULL DEFAULT 'invisalign';
