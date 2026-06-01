export function dateStamp(date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

export function safePdfFilename(title: string, fallback: string, date = new Date()): string {
    const safeTitle = title
        .trim()
        .replace(/\.pdf$/i, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s._-]+/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^\.+/, "")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72);

    return `${safeTitle || fallback}-${dateStamp(date)}.pdf`;
}

export function formatExportDate(date = new Date()): string {
    return new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}
