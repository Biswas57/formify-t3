import AuthenticatedShell from "@/app/_components/AuthenticatedShell";

export default async function FormsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
