import { TREATMENT_TAG_STYLE, treatmentLabel } from "@/lib/treatments";

export default function TreatmentBadge({
  treatmentType,
  style,
}: {
  treatmentType: string | null | undefined;
  style?: React.CSSProperties;
}) {
  const key = treatmentType || "invisalign";
  const tag = TREATMENT_TAG_STYLE[key as keyof typeof TREATMENT_TAG_STYLE] ?? TREATMENT_TAG_STYLE.other;
  return (
    <span
      className="badge"
      style={{
        color: tag.fg,
        background: tag.bg,
        padding: "4px 11px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {treatmentLabel(treatmentType)}
    </span>
  );
}
