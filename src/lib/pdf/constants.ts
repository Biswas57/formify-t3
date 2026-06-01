export type Rgb = [number, number, number];

export const PDF = {
    pageWidth: 210,
    pageHeight: 297,
    margin: 14,
    footerTop: 283,
    footerTextY: 290,
    bottomLimit: 275,
    topStripeHeight: 1.6,
};

export const PDF_CONTENT_WIDTH = PDF.pageWidth - PDF.margin * 2;

export const PDF_COLORS = {
    brandBlue: [33, 73, 161] as Rgb,
    brandBlueDark: [26, 58, 135] as Rgb,
    brandBlueSoft: [232, 238, 249] as Rgb,
    brandPurple: [147, 51, 234] as Rgb,
    headerBg: [245, 247, 252] as Rgb,
    panelBg: [248, 250, 252] as Rgb,
    white: [255, 255, 255] as Rgb,
    slate50: [248, 250, 252] as Rgb,
    slate100: [241, 245, 249] as Rgb,
    slate900: [15, 23, 42] as Rgb,
    slate700: [51, 65, 85] as Rgb,
    slate600: [71, 85, 105] as Rgb,
    slate500: [100, 116, 139] as Rgb,
    slate400: [148, 163, 184] as Rgb,
    border: [220, 224, 232] as Rgb,
    borderLight: [231, 235, 242] as Rgb,
};

export const PDF_FONTS = {
    body: "helvetica",
};
