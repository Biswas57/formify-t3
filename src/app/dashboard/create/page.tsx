import { redirect } from "next/navigation";

function safeReturnTo(value: string | string[] | undefined): "/templates" | "/forms" | null {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate === "/forms" || candidate === "/templates" ? candidate : null;
}

export default async function DashboardCreatePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const returnTo = safeReturnTo(params.returnTo);
    redirect(returnTo ? `/templates/new?returnTo=${encodeURIComponent(returnTo)}` : "/templates/new");
}
