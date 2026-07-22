"use client";

import { useFormStatus } from "react-dom";

export default function FormSubmitButton({
  label,
  pendingLabel = "One moment…",
  className = "btn btn-teal",
  style,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} style={style} disabled={pending} aria-busy={pending}>
      {pending ? (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span className="ds-spinner" aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
