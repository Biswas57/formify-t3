import type { jsPDF as JsPDF } from "jspdf";
import { PDF_COLORS } from "./constants";

const FORMIFY_LOGO_PATH = "/favicon.svg";

let logoDataUrlPromise: Promise<string | null> | null = null;

function canvasIsAvailable(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load Formify logo"));
        image.src = src;
    });
}

export function loadFormifyLogoDataUrl(): Promise<string | null> {
    if (!canvasIsAvailable()) return Promise.resolve(null);

    logoDataUrlPromise ??= (async () => {
        try {
            const response = await fetch(FORMIFY_LOGO_PATH);
            if (!response.ok) return null;

            const svg = await response.text();
            const blob = new Blob([svg], { type: "image/svg+xml" });
            const objectUrl = URL.createObjectURL(blob);

            try {
                const image = await loadImage(objectUrl);
                const canvas = document.createElement("canvas");
                canvas.width = 128;
                canvas.height = 128;
                const context = canvas.getContext("2d");
                if (!context) return null;

                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL("image/png");
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        } catch {
            return null;
        }
    })();

    return logoDataUrlPromise;
}

function renderFallbackLogoMark(pdf: JsPDF, x: number, y: number, size: number) {
    pdf.setFillColor(PDF_COLORS.brandBlue[0], PDF_COLORS.brandBlue[1], PDF_COLORS.brandBlue[2]);
    pdf.roundedRect(x, y, size, size, 2.5, 2.5, "F");

    pdf.setTextColor(PDF_COLORS.white[0], PDF_COLORS.white[1], PDF_COLORS.white[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(size * 0.72);
    pdf.text("F", x + size * 0.35, y + size * 0.73);
}

export function renderFormifyBrand(
    pdf: JsPDF,
    {
        x,
        y,
        logoDataUrl,
        markSize = 9,
    }: {
        x: number;
        y: number;
        logoDataUrl: string | null;
        markSize?: number;
    }
) {
    if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", x, y, markSize, markSize, "formify-logo", "FAST");
    } else {
        renderFallbackLogoMark(pdf, x, y, markSize);
    }

    pdf.setTextColor(PDF_COLORS.slate900[0], PDF_COLORS.slate900[1], PDF_COLORS.slate900[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Formify", x + markSize + 3.5, y + 6.6);
}
