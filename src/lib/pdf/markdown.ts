import { PDF, PDF_COLORS, PDF_CONTENT_WIDTH } from "./constants";
import { formatExportDate, safePdfFilename } from "./filename";
import { loadFormifyLogoDataUrl } from "./branding";
import {
    ensureSpace,
    renderFooterWithPageNumbers,
    renderCompactTitle,
    renderMetadataLine,
    renderPdfHeader,
    setDrawColor,
    setFillColor,
    setTextColor,
    splitText,
    textOrFallback,
    type PdfCursor,
} from "./layout";

export interface NotesPdfInput {
    markdown: string;
    title?: string;
    noteStyleLabel?: string;
    sections?: string[];
    exportedAt?: Date;
}

function stripMarkdownDecorators(text: string): string {
    return text
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1");
}

function firstMarkdownH1(markdown: string): string | null {
    const line = markdown.split("\n").find((candidate) => candidate.startsWith("# "));
    return line ? stripMarkdownDecorators(line.slice(2)).trim() : null;
}

function renderLines(cursor: PdfCursor, lines: string[], x: number, lineHeight: number) {
    for (const line of lines) {
        ensureSpace(cursor, lineHeight + 1);
        cursor.pdf.text(line, x, cursor.y);
        cursor.y += lineHeight;
    }
}

function renderHeading(cursor: PdfCursor, text: string, level: 1 | 2 | 3) {
    const { pdf } = cursor;
    const clean = stripMarkdownDecorators(text);

    if (level === 1) {
        const lines = splitText(pdf, clean, PDF_CONTENT_WIDTH - 6);
        ensureSpace(cursor, 12);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        setTextColor(pdf, PDF_COLORS.slate900);
        for (const line of lines) {
            ensureSpace(cursor, 8);
            setFillColor(pdf, PDF_COLORS.brandBlue);
            pdf.rect(PDF.margin, cursor.y - 4.8, 2.2, 7, "F");
            pdf.text(line, PDF.margin + 5.5, cursor.y);
            cursor.y += 6.4;
        }
        cursor.y += 3;
        return;
    }

    if (level === 2) {
        const lines = splitText(pdf, clean, PDF_CONTENT_WIDTH - 8);
        ensureSpace(cursor, 12);
        cursor.y += 1;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.4);
        setTextColor(pdf, PDF_COLORS.brandBlue);
        for (const line of lines) {
            ensureSpace(cursor, 5.2);
            pdf.text(line, PDF.margin, cursor.y);
            cursor.y += 5.2;
        }
        setDrawColor(pdf, PDF_COLORS.brandBlueSoft);
        pdf.setLineWidth(0.3);
        pdf.line(PDF.margin, cursor.y - 1.5, PDF.margin + PDF_CONTENT_WIDTH, cursor.y - 1.5);
        cursor.y += 1;
        return;
    }

    const lines = splitText(pdf, clean, PDF_CONTENT_WIDTH);
    ensureSpace(cursor, 8);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    setTextColor(pdf, PDF_COLORS.slate700);
    renderLines(cursor, lines, PDF.margin, 4.8);
    cursor.y += 1.4;
}

function renderParagraph(cursor: PdfCursor, text: string) {
    const { pdf } = cursor;
    const clean = stripMarkdownDecorators(text);
    const lines = splitText(pdf, clean, PDF_CONTENT_WIDTH);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.7);
    setTextColor(pdf, PDF_COLORS.slate600);
    renderLines(cursor, lines, PDF.margin, 4.5);
    cursor.y += 1.4;
}

function renderBullet(cursor: PdfCursor, text: string) {
    const { pdf } = cursor;
    const clean = stripMarkdownDecorators(text);
    const lines = splitText(pdf, clean, PDF_CONTENT_WIDTH - 7);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.7);
    setTextColor(pdf, PDF_COLORS.slate600);

    lines.forEach((line, index) => {
        ensureSpace(cursor, 4.8);
        if (index === 0) {
            setFillColor(pdf, PDF_COLORS.brandBlue);
            pdf.circle(PDF.margin + 1.8, cursor.y - 1.4, 0.8, "F");
        }
        pdf.text(line, PDF.margin + 6, cursor.y);
        cursor.y += 4.5;
    });
    cursor.y += 0.7;
}

function renderNumbered(cursor: PdfCursor, number: string, text: string) {
    const { pdf } = cursor;
    const clean = stripMarkdownDecorators(text);
    const lines = splitText(pdf, clean, PDF_CONTENT_WIDTH - 9);

    lines.forEach((line, index) => {
        ensureSpace(cursor, 4.8);
        if (index === 0) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.7);
            setTextColor(pdf, PDF_COLORS.brandBlue);
            pdf.text(`${number}.`, PDF.margin, cursor.y);
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.7);
        setTextColor(pdf, PDF_COLORS.slate600);
        pdf.text(line, PDF.margin + 8, cursor.y);
        cursor.y += 4.5;
    });
    cursor.y += 0.7;
}

function renderRule(cursor: PdfCursor) {
    ensureSpace(cursor, 7);
    cursor.y += 2;
    setDrawColor(cursor.pdf, PDF_COLORS.border);
    cursor.pdf.setLineWidth(0.2);
    cursor.pdf.line(PDF.margin, cursor.y, PDF.margin + PDF_CONTENT_WIDTH, cursor.y);
    cursor.y += 5;
}

function renderMarkdownBody(cursor: PdfCursor, markdown: string, skipFirstH1: boolean) {
    let skippedH1 = false;
    let inCodeBlock = false;

    for (const rawLine of markdown.split("\n")) {
        const line = rawLine.trimEnd();

        if (line.startsWith("```")) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) {
            ensureSpace(cursor, 7);
            setFillColor(cursor.pdf, PDF_COLORS.panelBg);
            setDrawColor(cursor.pdf, PDF_COLORS.borderLight);
            cursor.pdf.rect(PDF.margin, cursor.y - 4, PDF_CONTENT_WIDTH, 7, "FD");
            cursor.pdf.setFont("courier", "normal");
            cursor.pdf.setFontSize(7.8);
            setTextColor(cursor.pdf, PDF_COLORS.slate700);
            cursor.pdf.text(stripMarkdownDecorators(line), PDF.margin + 3, cursor.y);
            cursor.y += 7;
            continue;
        }

        if (line.startsWith("# ")) {
            if (skipFirstH1 && !skippedH1) {
                skippedH1 = true;
                continue;
            }
            renderHeading(cursor, line.slice(2), 1);
            continue;
        }

        if (line.startsWith("## ")) {
            renderHeading(cursor, line.slice(3), 2);
            continue;
        }

        if (line.startsWith("### ")) {
            renderHeading(cursor, line.slice(4), 3);
            continue;
        }

        if (line.startsWith("- ") || line.startsWith("* ")) {
            renderBullet(cursor, line.slice(2));
            continue;
        }

        const numberedMatch = /^(\d+)\.\s+(.+)$/.exec(line);
        if (numberedMatch) {
            renderNumbered(cursor, numberedMatch[1]!, numberedMatch[2]!);
            continue;
        }

        if (line === "---" || line === "***") {
            renderRule(cursor);
            continue;
        }

        if (line.startsWith("> ")) {
            ensureSpace(cursor, 8);
            setFillColor(cursor.pdf, PDF_COLORS.panelBg);
            cursor.pdf.rect(PDF.margin, cursor.y - 4, 2, 7, "F");
            const quoteLines = splitText(cursor.pdf, stripMarkdownDecorators(line.slice(2)), PDF_CONTENT_WIDTH - 7);
            cursor.pdf.setFont("helvetica", "normal");
            cursor.pdf.setFontSize(8.8);
            setTextColor(cursor.pdf, PDF_COLORS.slate600);
            renderLines(cursor, quoteLines, PDF.margin + 6, 4.8);
            cursor.y += 2;
            continue;
        }

        if (line.trim() === "") {
            ensureSpace(cursor, 3);
            cursor.y += 3;
            continue;
        }

        renderParagraph(cursor, line);
    }
}

export async function exportNotesPdf(input: NotesPdfInput): Promise<void> {
    const markdown = input.markdown.trim();
    if (!markdown) return;

    const { default: jsPDF } = await import("jspdf");
    const exportedAt = input.exportedAt ?? new Date();
    const logoDataUrl = await loadFormifyLogoDataUrl();
    const markdownTitle = firstMarkdownH1(markdown);
    const inputTitle = input.title?.trim() ?? "";
    const title = textOrFallback(input.title, markdownTitle ?? "Generated Notes");
    const skipFirstH1 = inputTitle.length === 0 && Boolean(markdownTitle);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const cursor: PdfCursor = {
        pdf,
        y: renderPdfHeader(pdf, {
            descriptor: "Voice notes",
            rightMeta: `Exported ${formatExportDate(exportedAt)}`,
            logoDataUrl,
        }),
    };

    const metadata = [
        input.noteStyleLabel ? `Style: ${input.noteStyleLabel}` : null,
        input.sections && input.sections.length > 0 ? `Sections: ${input.sections.length} configured` : null,
    ].filter((item): item is string => Boolean(item));

    renderCompactTitle(cursor, title, "Generated notes export");
    renderMetadataLine(cursor, metadata.length > 0 ? metadata.join(" · ") : "Current visible notes");
    renderMarkdownBody(cursor, markdown, skipFirstH1);

    renderFooterWithPageNumbers(pdf);
    pdf.save(safePdfFilename(title, "formify-notes", exportedAt));
}
