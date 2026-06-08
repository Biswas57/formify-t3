type SafePerfValue = string | number | boolean | null | undefined;

type FieldContainer = {
    fields?: unknown[] | null;
    fieldCount?: number | null;
};

type BlockContainer = {
    blocks?: FieldContainer[] | null;
    blockCount?: number | null;
    fieldCount?: number | null;
};

type SubmittedBlockContainer = {
    blocks?: {
        fields?: unknown[] | null;
    }[] | null;
};

export function safeJsonChars(value: unknown): number {
    try {
        return JSON.stringify(value)?.length ?? 0;
    } catch {
        return 0;
    }
}

export function countTemplateBlocks(template: BlockContainer | null | undefined): number {
    if (!template) return 0;
    if (typeof template.blockCount === "number" && Number.isFinite(template.blockCount)) {
        return template.blockCount;
    }
    return Array.isArray(template.blocks) ? template.blocks.length : 0;
}

export function countTemplateFields(template: BlockContainer | null | undefined): number {
    if (!template) return 0;
    if (typeof template.fieldCount === "number" && Number.isFinite(template.fieldCount)) {
        return template.fieldCount;
    }
    if (!Array.isArray(template.blocks)) return 0;
    return template.blocks.reduce((total, block) => {
        if (typeof block.fieldCount === "number" && Number.isFinite(block.fieldCount)) {
            return total + block.fieldCount;
        }
        return total + (Array.isArray(block.fields) ? block.fields.length : 0);
    }, 0);
}

export function countSubmittedBlocks(input: SubmittedBlockContainer): number {
    return Array.isArray(input.blocks) ? input.blocks.length : 0;
}

export function countSubmittedFields(input: SubmittedBlockContainer): number {
    if (!Array.isArray(input.blocks)) return 0;
    return input.blocks.reduce(
        (total, block) => total + (Array.isArray(block.fields) ? block.fields.length : 0),
        0
    );
}

export function countWords(value: string): number {
    return value.trim().split(/\s+/).filter(Boolean).length;
}

export function logPerf(label: string, metadata: Record<string, SafePerfValue>): void {
    const parts = Object.entries(metadata)
        .filter((entry): entry is [string, Exclude<SafePerfValue, undefined>] => entry[1] !== undefined)
        .map(([key, value]) => `${key}=${value === null ? "null" : String(value)}`);

    console.info(`[perf][${label}] ${parts.join(" ")}`);
}
