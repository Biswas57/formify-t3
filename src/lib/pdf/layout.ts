import type { jsPDF as JsPDF } from "jspdf";
import { PDF, PDF_COLORS, PDF_CONTENT_WIDTH, type Rgb } from "./constants";

export interface PdfCursor {
    pdf: JsPDF;
    y: number;
}

export interface MetadataItem {
    label: string;
    value: string;
}

export function setTextColor(pdf: JsPDF, color: Rgb) {
    pdf.setTextColor(color[0], color[1], color[2]);
}

export function setFillColor(pdf: JsPDF, color: Rgb) {
    pdf.setFillColor(color[0], color[1], color[2]);
}

export function setDrawColor(pdf: JsPDF, color: Rgb) {
    pdf.setDrawColor(color[0], color[1], color[2]);
}

export function splitText(pdf: JsPDF, text: string, width: number): string[] {
    const lines: unknown = pdf.splitTextToSize(text, width);
    return Array.isArray(lines) ? lines.map(String) : [String(lines)];
}

export function clampText(pdf: JsPDF, text: string, maxWidth: number, fontSize: number): string {
    pdf.setFontSize(fontSize);
    if (pdf.getTextWidth(text) <= maxWidth) return text;

    let clipped = text;
    while (clipped.length > 1 && pdf.getTextWidth(`${clipped}...`) > maxWidth) {
        clipped = clipped.slice(0, -1);
    }
    return `${clipped}...`;
}

export function textOrFallback(value: string | undefined, fallback: string): string {
    const trimmed = value?.trim();
    if (trimmed === undefined) return fallback;
    if (trimmed.length === 0) return fallback;
    return trimmed;
}

export function drawTopStripe(pdf: JsPDF) {
    setFillColor(pdf, PDF_COLORS.brandBlue);
    pdf.rect(0, 0, PDF.pageWidth, PDF.topStripeHeight, "F");
}

export function ensureSpace(cursor: PdfCursor, needed: number, newPageY = 18) {
    if (cursor.y + needed <= PDF.bottomLimit) return;
    cursor.pdf.addPage();
    drawTopStripe(cursor.pdf);
    cursor.y = newPageY;
}

export function renderPdfHeader(
    pdf: JsPDF,
    {
        title,
        descriptor,
        rightMeta,
    }: {
        title: string;
        descriptor: string;
        rightMeta?: string;
    }
): number {
    drawTopStripe(pdf);

    setFillColor(pdf, PDF_COLORS.headerBg);
    pdf.rect(0, PDF.topStripeHeight, PDF.pageWidth, 34, "F");

    setFillColor(pdf, PDF_COLORS.brandBlue);
    setDrawColor(pdf, PDF_COLORS.brandBlue);
    pdf.roundedRect(PDF.margin, 9, 11, 11, 2.5, 2.5, "F");

    setTextColor(pdf, PDF_COLORS.white);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text("F", PDF.margin + 4.1, 16.1);

    setTextColor(pdf, PDF_COLORS.brandBlue);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Formify", PDF.margin + 15, 14.4);

    setTextColor(pdf, PDF_COLORS.slate500);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(descriptor, PDF.margin + 15, 19.1);

    setTextColor(pdf, PDF_COLORS.slate900);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.text(clampText(pdf, title, 86, 10.5), PDF.pageWidth - PDF.margin, 14, { align: "right" });

    if (rightMeta) {
        setTextColor(pdf, PDF_COLORS.slate500);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text(clampText(pdf, rightMeta, 86, 7.5), PDF.pageWidth - PDF.margin, 19.3, { align: "right" });
    }

    setDrawColor(pdf, PDF_COLORS.border);
    pdf.setLineWidth(0.3);
    pdf.line(0, 36, PDF.pageWidth, 36);

    return 47;
}

export function renderDocumentTitle(
    cursor: PdfCursor,
    title: string,
    subtitle: string,
) {
    const { pdf } = cursor;
    const titleLines = splitText(pdf, title, PDF_CONTENT_WIDTH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    setTextColor(pdf, PDF_COLORS.slate900);

    for (const line of titleLines) {
        ensureSpace(cursor, 9);
        pdf.text(line, PDF.margin, cursor.y);
        cursor.y += 9;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    setTextColor(pdf, PDF_COLORS.slate500);
    pdf.text(subtitle, PDF.margin, cursor.y);
    cursor.y += 8;
}

export function renderMetadataPanel(cursor: PdfCursor, items: MetadataItem[]) {
    const { pdf } = cursor;
    const columns = 2;
    const gap = 6;
    const colWidth = (PDF_CONTENT_WIDTH - gap) / columns;
    const rowHeight = 13;
    const rows = Math.ceil(items.length / columns);
    const panelHeight = rows * rowHeight + 8;

    ensureSpace(cursor, panelHeight + 4);

    setFillColor(pdf, PDF_COLORS.panelBg);
    setDrawColor(pdf, PDF_COLORS.borderLight);
    pdf.roundedRect(PDF.margin, cursor.y, PDF_CONTENT_WIDTH, panelHeight, 3, 3, "FD");

    items.forEach((item, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = PDF.margin + 5 + col * (colWidth + gap);
        const y = cursor.y + 8 + row * rowHeight;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.8);
        setTextColor(pdf, PDF_COLORS.slate500);
        pdf.text(item.label.toUpperCase(), x, y);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.4);
        setTextColor(pdf, PDF_COLORS.slate900);
        pdf.text(clampText(pdf, item.value, colWidth - 8, 8.4), x, y + 5);
    });

    cursor.y += panelHeight + 9;
}

export function renderFooterWithPageNumbers(pdf: JsPDF) {
    const totalPages = pdf.getNumberOfPages();

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        pdf.setPage(pageNumber);
        setDrawColor(pdf, PDF_COLORS.border);
        pdf.setLineWidth(0.2);
        pdf.line(PDF.margin, PDF.footerTop, PDF.pageWidth - PDF.margin, PDF.footerTop);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        setTextColor(pdf, PDF_COLORS.slate500);
        pdf.text("Generated by Formify", PDF.margin, PDF.footerTextY);
        pdf.text(`Page ${pageNumber} of ${totalPages}`, PDF.pageWidth - PDF.margin, PDF.footerTextY, { align: "right" });
    }
}
