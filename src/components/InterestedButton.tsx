"use client";
// "I'm interested" trigger — opens the consent + info modal before recording interest.
import { useState } from "react";
import ConsentModal, { Applicant } from "./ConsentModal";

export default function InterestedButton({ token, applicant }: { token: string; applicant: Applicant }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-teal"
        style={{ marginTop: 18, padding: "14px 30px", fontSize: 15, fontWeight: 800, letterSpacing: ".02em" }}
      >
        I&apos;M INTERESTED
      </button>
      <ConsentModal open={open} onClose={() => setOpen(false)} token={token} intent="interested" applicant={applicant} />
    </>
  );
}
