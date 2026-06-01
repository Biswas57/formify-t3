import { formatFieldLabel } from "@/lib/format-field-label";
import { PDF, PDF_COLORS, PDF_CONTENT_WIDTH } from "./constants";
import { formatExportDate, safePdfFilename } from "./filename";
import { loadFormifyLogoDataUrl } from "./branding";
import {
    addPdfPage,
    clampText,
    ensureSpace,
    renderCompactTitle,
    renderFooterWithPageNumbers,
    renderMetadataLine,
    renderPdfHeader,
    setDrawColor,
    setFillColor,
    setTextColor,
    splitText,
    textOrFallback,
    type PdfCursor,
} from "./layout";

export interface FormPdfField {
    key: string;
    label?: string;
    value?: string;
}

export interface FormPdfBlock {
    title: string;
    fields: FormPdfField[];
}

export interface FormPdfInput {
    title: string;
    blocks: FormPdfBlock[];
    exportedAt?: Date;
}

interface PreparedField {
    key: string;
    label: string;
    value: string;
}

type PreparedRow =
    | { type: "pair"; left: PreparedField; right?: PreparedField }
    | { type: "full"; field: PreparedField };

const SECTION_HEADER_HEIGHT = 7.6;
const COMPACT_ROW_HEIGHT = 6.6;
const SECTION_GAP = 4.5;
const COLUMN_GAP = 7;
const COLUMN_WIDTH = (PDF_CONTENT_WIDTH - COLUMN_GAP) / 2;
const COMPACT_LABEL_WIDTH = 27;
const FULL_LABEL_WIDTH = 42;

function prepareField(field: FormPdfField): PreparedField {
    return {
        key: field.key,
        label: textOrFallback(field.label, formatFieldLabel(field.key)),
        value: textOrFallback(field.value, "—"),
    };
}

function isCompactField(pdf: PdfCursor["pdf"], field: PreparedField): boolean {
    const compactValueWidth = COLUMN_WIDTH - COMPACT_LABEL_WIDTH - 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.8);

    if (field.value === "—") return true;
    if (field.value.length > 54) return false;
    return splitText(pdf, field.value, compactValueWidth).length <= 1;
}

function prepareRows(pdf: PdfCursor["pdf"], fields: FormPdfField[]): PreparedRow[] {
    const rows: PreparedRow[] = [];
    const compactQueue: PreparedField[] = [];

    const flushCompactQueue = () => {
        while (compactQueue.length > 0) {
            const left = compactQueue.shift()!;
            const right = compactQueue.shift();
            rows.push(right ? { type: "pair", left, right } : { type: "pair", left });
        }
    };

    for (const rawField of fields) {
        const field = prepareField(rawField);
        if (isCompactField(pdf, field)) {
            compactQueue.push(field);
            continue;
        }

        flushCompactQueue();
        rows.push({ type: "full", field });
    }

    flushCompactQueue();
    return rows;
}

function fullRowHeight(pdf: PdfCursor["pdf"], field: PreparedField): number {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.1);
    const valueWidth = PDF_CONTENT_WIDTH - FULL_LABEL_WIDTH - 9;
    const lines = splitText(pdf, field.value, valueWidth);
    return Math.max(7.4, lines.length * 4.1 + 3.4);
}

function rowHeight(pdf: PdfCursor["pdf"], row: PreparedRow): number {
    return row.type === "pair" ? COMPACT_ROW_HEIGHT : fullRowHeight(pdf, row.field);
}

function renderSectionHeader(cursor: PdfCursor, title: string, continued = false) {
    const { pdf } = cursor;

    setFillColor(pdf, PDF_COLORS.brandBlueSoft);
    setDrawColor(pdf, PDF_COLORS.border);
    pdf.setLineWidth(0.25);
    pdf.rect(PDF.margin, cursor.y, PDF_CONTENT_WIDTH, SECTION_HEADER_HEIGHT, "FD");

    setFillColor(pdf, PDF_COLORS.brandBlue);
    pdf.rect(PDF.margin, cursor.y, 2, SECTION_HEADER_HEIGHT, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.9);
    setTextColor(pdf, PDF_COLORS.brandBlueDark);
    pdf.text(`${title}${continued ? " (continued)" : ""}`.toUpperCase(), PDF.margin + 4.2, cursor.y + 5.1);
    cursor.y += SECTION_HEADER_HEIGHT;
}

function renderCompactCell(
    cursor: PdfCursor,
    field: PreparedField,
    x: number,
    y: number,
    width: number,
) {
    const { pdf } = cursor;
    const label = clampText(pdf, field.label, COMPACT_LABEL_WIDTH - 1.5, 7.2);
    const valueWidth = width - COMPACT_LABEL_WIDTH - 6;
    const value = field.value === "—" ? "—" : clampText(pdf, field.value, valueWidth, 8.1);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    setTextColor(pdf, PDF_COLORS.slate500);
    pdf.text(label, x + 3, y + 4.35);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.1);
    setTextColor(pdf, field.value === "—" ? PDF_COLORS.slate400 : PDF_COLORS.slate900);
    pdf.text(value, x + COMPACT_LABEL_WIDTH + 4, y + 4.35);
}

function renderPairRow(cursor: PdfCursor, row: Extract<PreparedRow, { type: "pair" }>) {
    const { pdf } = cursor;
    const y = cursor.y;

    setFillColor(pdf, PDF_COLORS.white);
    setDrawColor(pdf, PDF_COLORS.borderLight);
    pdf.setLineWidth(0.2);
    pdf.rect(PDF.margin, y, PDF_CONTENT_WIDTH, COMPACT_ROW_HEIGHT, "S");

    renderCompactCell(cursor, row.left, PDF.margin, y, COLUMN_WIDTH);

    if (row.right) {
        const dividerX = PDF.margin + COLUMN_WIDTH + COLUMN_GAP / 2;
        pdf.line(dividerX, y, dividerX, y + COMPACT_ROW_HEIGHT);
        renderCompactCell(cursor, row.right, PDF.margin + COLUMN_WIDTH + COLUMN_GAP, y, COLUMN_WIDTH);
    }

    cursor.y += COMPACT_ROW_HEIGHT;
}

function renderFullRow(cursor: PdfCursor, field: PreparedField, continued = false) {
    const { pdf } = cursor;
    const valueX = PDF.margin + FULL_LABEL_WIDTH + 6;
    const valueWidth = PDF_CONTENT_WIDTH - FULL_LABEL_WIDTH - 9;
    const valueLines = splitText(pdf, field.value, valueWidth);
    let lineIndex = 0;

    while (lineIndex < valueLines.length) {
        if (PDF.bottomLimit - cursor.y < 11) addPdfPage(cursor);

        const availableHeight = PDF.bottomLimit - cursor.y;
        const lineCapacity = Math.max(1, Math.floor((availableHeight - 3.4) / 4.1));
        const linesForPage = valueLines.slice(lineIndex, lineIndex + lineCapacity);
        const height = Math.max(7.4, linesForPage.length * 4.1 + 3.4);
        const y = cursor.y;

        setFillColor(pdf, PDF_COLORS.white);
        setDrawColor(pdf, PDF_COLORS.borderLight);
        pdf.setLineWidth(0.2);
        pdf.rect(PDF.margin, y, PDF_CONTENT_WIDTH, height, "S");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.3);
        setTextColor(pdf, PDF_COLORS.slate500);
        const label = lineIndex > 0 || continued ? `${field.label} (continued)` : field.label;
        pdf.text(clampText(pdf, label, FULL_LABEL_WIDTH - 5, 7.3), PDF.margin + 3, y + 4.8);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.1);
        setTextColor(pdf, field.value === "—" ? PDF_COLORS.slate400 : PDF_COLORS.slate900);
        linesForPage.forEach((line, index) => {
            pdf.text(line, valueX, y + 4.8 + index * 4.1);
        });

        cursor.y += height;
        lineIndex += linesForPage.length;
    }
}

function renderRow(cursor: PdfCursor, row: PreparedRow) {
    if (row.type === "pair") {
        renderPairRow(cursor, row);
        return;
    }

    renderFullRow(cursor, row.field);
}

function ensureSectionStart(cursor: PdfCursor, rows: PreparedRow[]) {
    const firstRows = rows.slice(0, 2);
    const needed = SECTION_HEADER_HEIGHT + firstRows.reduce((sum, row) => sum + rowHeight(cursor.pdf, row), 0) + 2;
    ensureSpace(cursor, Math.max(needed, SECTION_HEADER_HEIGHT + COMPACT_ROW_HEIGHT + 2), 18);
}

function renderFormBlock(cursor: PdfCursor, block: FormPdfBlock) {
    const rows = prepareRows(cursor.pdf, block.fields);
    if (rows.length === 0) return;

    ensureSectionStart(cursor, rows);
    renderSectionHeader(cursor, block.title);

    for (const row of rows) {
        if (cursor.y + rowHeight(cursor.pdf, row) > PDF.bottomLimit) {
            addPdfPage(cursor);
            renderSectionHeader(cursor, block.title, true);
        }
        renderRow(cursor, row);
    }

    cursor.y += SECTION_GAP;
}

export async function exportFormPdf(input: FormPdfInput): Promise<void> {
    const { default: jsPDF } = await import("jspdf");
    const exportedAt = input.exportedAt ?? new Date();
    const title = input.title.trim() || "Formify Form";
    const logoDataUrl = await loadFormifyLogoDataUrl();
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const cursor: PdfCursor = {
        pdf,
        y: renderPdfHeader(pdf, {
            descriptor: "Voice-powered form filling",
            rightMeta: `Exported ${formatExportDate(exportedAt)}`,
            logoDataUrl,
        }),
    };

    const fieldCount = input.blocks.reduce((total, block) => total + block.fields.length, 0);

    renderCompactTitle(cursor, title, "Voice-filled form export");
    renderMetadataLine(
        cursor,
        `Sections: ${input.blocks.length} · Fields: ${fieldCount}`
    );

    for (const block of input.blocks) {
        renderFormBlock(cursor, block);
    }

    renderFooterWithPageNumbers(pdf);
    pdf.save(safePdfFilename(title, "formify-form", exportedAt));
}
