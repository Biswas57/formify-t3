import { formatFieldLabel } from "@/lib/format-field-label";
import { PDF, PDF_COLORS, PDF_CONTENT_WIDTH } from "./constants";
import { formatExportDate, safePdfFilename } from "./filename";
import {
    ensureSpace,
    renderDocumentTitle,
    renderFooterWithPageNumbers,
    renderMetadataPanel,
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

function renderSectionHeader(cursor: PdfCursor, title: string, continued = false) {
    const { pdf } = cursor;
    ensureSpace(cursor, 21);

    setFillColor(pdf, PDF_COLORS.brandBlueSoft);
    setDrawColor(pdf, PDF_COLORS.border);
    pdf.roundedRect(PDF.margin, cursor.y, PDF_CONTENT_WIDTH, 10, 2.5, 2.5, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    setTextColor(pdf, PDF_COLORS.brandBlue);
    pdf.text(`${title}${continued ? " (continued)" : ""}`.toUpperCase(), PDF.margin + 4, cursor.y + 6.4);
    cursor.y += 12;
}

function renderFieldRow(cursor: PdfCursor, field: FormPdfField) {
    const { pdf } = cursor;
    const labelWidth = 44;
    const valueX = PDF.margin + labelWidth + 8;
    const valueWidth = PDF_CONTENT_WIDTH - labelWidth - 13;
    const value = textOrFallback(field.value, "—");
    const label = textOrFallback(field.label, formatFieldLabel(field.key));

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const valueLines = splitText(pdf, value, valueWidth);
    let lineIndex = 0;

    while (lineIndex < valueLines.length) {
        if (PDF.bottomLimit - cursor.y < 14) {
            pdf.addPage();
            cursor.y = 18;
        }

        const availableHeight = PDF.bottomLimit - cursor.y;
        const lineCapacity = Math.max(1, Math.floor((availableHeight - 7) / 4.5));
        const linesForPage = valueLines.slice(lineIndex, lineIndex + lineCapacity);
        const rowHeight = Math.max(11, linesForPage.length * 4.5 + 7);
        const isContinued = lineIndex > 0;

        setFillColor(pdf, PDF_COLORS.white);
        setDrawColor(pdf, PDF_COLORS.borderLight);
        pdf.roundedRect(PDF.margin, cursor.y, PDF_CONTENT_WIDTH, rowHeight, 1.5, 1.5, "FD");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        setTextColor(pdf, PDF_COLORS.slate500);
        pdf.text(isContinued ? `${label} (continued)` : label, PDF.margin + 4, cursor.y + 7);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        setTextColor(pdf, value === "—" ? PDF_COLORS.slate400 : PDF_COLORS.slate900);
        linesForPage.forEach((line, index) => {
            pdf.text(line, valueX, cursor.y + 7 + index * 4.5);
        });

        cursor.y += rowHeight + 1.5;
        lineIndex += linesForPage.length;
    }
}

function renderFormBlock(cursor: PdfCursor, block: FormPdfBlock) {
    renderSectionHeader(cursor, block.title);

    for (const field of block.fields) {
        if (cursor.y > PDF.bottomLimit - 12) {
            cursor.pdf.addPage();
            cursor.y = 18;
            renderSectionHeader(cursor, block.title, true);
        }
        renderFieldRow(cursor, field);
    }

    cursor.y += 6;
}

export async function exportFormPdf(input: FormPdfInput): Promise<void> {
    const { default: jsPDF } = await import("jspdf");
    const exportedAt = input.exportedAt ?? new Date();
    const title = input.title.trim() || "Formify Form";
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const cursor: PdfCursor = {
        pdf,
        y: renderPdfHeader(pdf, {
            title,
            descriptor: "Voice-powered form filling",
            rightMeta: formatExportDate(exportedAt),
        }),
    };

    const fieldCount = input.blocks.reduce((total, block) => total + block.fields.length, 0);

    renderDocumentTitle(cursor, title, "Filled form export");
    renderMetadataPanel(cursor, [
        { label: "Exported", value: formatExportDate(exportedAt) },
        { label: "Template", value: title },
        { label: "Sections", value: String(input.blocks.length) },
        { label: "Fields", value: String(fieldCount) },
    ]);

    for (const block of input.blocks) {
        renderFormBlock(cursor, block);
    }

    renderFooterWithPageNumbers(pdf);
    pdf.save(safePdfFilename(title, "formify-form", exportedAt));
}
