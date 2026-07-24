import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy route — proposal editing lives at /proposal */
export default function EditPatientRedirect({ params }: { params: { id: string } }) {
  redirect(`/admin/patients/${params.id}/proposal`);
}
