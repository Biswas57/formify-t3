import { redirect } from "next/navigation";

export const metadata = {
    title: "Formify",
};

export default async function TranscriptionPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const templateId = Array.isArray(params.templateId) ? params.templateId[0] : params.templateId;
    redirect(templateId ? `/forms?templateId=${encodeURIComponent(templateId)}` : "/forms");
}
