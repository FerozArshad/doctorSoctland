"use client";

import { useFormStatus } from "react-dom";

type Variant = "primary" | "outline" | "link";

type FormSubmitButtonProps = {
  label: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  name?: string;
  value?: string;
  variant?: Variant;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children" | "disabled">;

export default function FormSubmitButton({
  label,
  pendingLabel = "One moment…",
  className,
  style,
  name,
  value,
  variant = "primary",
  disabled = false,
  ...rest
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const resolvedClass =
    className ?? (variant === "outline" ? "btn btn-outline" : variant === "link" ? "" : "btn btn-teal");
  const outline = variant === "outline" || resolvedClass.includes("btn-outline");
  const link = variant === "link";
  const spinnerClass = outline || link ? "ds-spinner ds-spinner-dark" : "ds-spinner";

  return (
    <button
      {...rest}
      type="submit"
      name={name}
      value={value}
      className={resolvedClass || undefined}
      style={{
        ...(link
          ? {
              background: "none",
              border: "none",
              color: "#0E9384",
              fontWeight: 700,
              fontSize: 13,
              cursor: pending ? "wait" : "pointer",
              textDecoration: "underline",
              opacity: pending ? 0.75 : 1,
            }
          : {}),
        ...style,
      }}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span className={spinnerClass} aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
