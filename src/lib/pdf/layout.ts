import type { jsPDF as JsPDF } from "jspdf";
import { PDF, PDF_COLORS, PDF_CONTENT_WIDTH, type Rgb } from "./constants";
import { renderFormifyBrand } from "./branding";

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

export function addPdfPage(cursor: PdfCursor, newPageY = 18) {
    cursor.pdf.addPage();
    drawTopStripe(cursor.pdf);
    cursor.y = newPageY;
}

export function renderPdfHeader(
    pdf: JsPDF,
    {
        descriptor,
        rightMeta,
        logoDataUrl,
    }: {
        descriptor: string;
        rightMeta?: string;
        logoDataUrl: string | null;
    }
): number {
    drawTopStripe(pdf);

    setFillColor(pdf, PDF_COLORS.white);
    pdf.rect(0, PDF.topStripeHeight, PDF.pageWidth, 26, "F");

    renderFormifyBrand(pdf, {
        x: PDF.margin,
        y: 8,
        logoDataUrl,
        markSize: 9.5,
    });

    setTextColor(pdf, PDF_COLORS.slate500);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(descriptor, PDF.margin + 13, 20.1);

    if (rightMeta) {
        setTextColor(pdf, PDF_COLORS.slate500);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text(clampText(pdf, rightMeta, 82, 7.5), PDF.pageWidth - PDF.margin, 13.8, { align: "right" });
    }

    setDrawColor(pdf, PDF_COLORS.border);
    pdf.setLineWidth(0.25);
    pdf.line(PDF.margin, 29, PDF.pageWidth - PDF.margin, 29);

    return 40;
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

export function renderCompactTitle(
    cursor: PdfCursor,
    title: string,
    subtitle: string,
) {
    const { pdf } = cursor;
    const titleLines = splitText(pdf, title, PDF_CONTENT_WIDTH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    setTextColor(pdf, PDF_COLORS.slate900);

    for (const line of titleLines) {
        ensureSpace(cursor, 7.5);
        pdf.text(line.toUpperCase(), PDF.margin, cursor.y);
        cursor.y += 7.5;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.2);
    setTextColor(pdf, PDF_COLORS.slate500);
    pdf.text(subtitle, PDF.margin, cursor.y);
    cursor.y += 6;
}

export function renderMetadataLine(cursor: PdfCursor, text: string) {
    const { pdf } = cursor;
    ensureSpace(cursor, 9);

    setFillColor(pdf, PDF_COLORS.slate50);
    setDrawColor(pdf, PDF_COLORS.borderLight);
    pdf.rect(PDF.margin, cursor.y, PDF_CONTENT_WIDTH, 6.8, "FD");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.4);
    setTextColor(pdf, PDF_COLORS.slate600);
    pdf.text(clampText(pdf, text, PDF_CONTENT_WIDTH - 6, 7.4), PDF.margin + 3, cursor.y + 4.5);
    cursor.y += 10;
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
