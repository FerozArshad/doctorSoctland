"use client";

import { useFormStatus } from "react-dom";

export default function FormSubmitButton({
  label,
  pendingLabel = "One moment…",
  className = "btn btn-teal",
  style,
  name,
  value,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const outline = className.includes("btn-outline");

  return (
    <button type="submit" name={name} value={value} className={className} style={style} disabled={pending} aria-busy={pending}>
      {pending ? (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span className={outline ? "ds-spinner ds-spinner-dark" : "ds-spinner"} aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
