import { type FieldType, type BlockSource } from "../../generated/prisma";

export interface SystemField {
    key: string;
    label: string;
    fieldType: FieldType;
    required: boolean;
    order: number;
}

export interface SystemBlock {
    id: string;
    name: string;
    sourceType: BlockSource;
    fields: SystemField[];
}

export const SYSTEM_BLOCKS: SystemBlock[] = [
    {
        id: "system-id-short",
        name: "ID Short",
        sourceType: "SYSTEM",
        fields: [
            { key: "name", label: "Name", fieldType: "TEXT", required: true, order: 0 },
            { key: "email", label: "Email", fieldType: "EMAIL", required: false, order: 1 },
            { key: "phone", label: "Phone", fieldType: "PHONE", required: false, order: 2 },
        ],
    },
    {
        id: "system-id-long",
        name: "ID Long",
        sourceType: "SYSTEM",
        fields: [
            { key: "name", label: "Name", fieldType: "TEXT", required: true, order: 0 },
            { key: "date_of_birth", label: "Date of Birth", fieldType: "DATE", required: false, order: 1 },
            { key: "place_of_birth", label: "Place of Birth", fieldType: "TEXT", required: false, order: 2 },
            { key: "phone", label: "Phone", fieldType: "PHONE", required: false, order: 3 },
            { key: "email", label: "Email", fieldType: "EMAIL", required: false, order: 4 },
            { key: "country_of_origin", label: "Country of Origin", fieldType: "TEXT", required: false, order: 5 },
            { key: "address", label: "Address", fieldType: "TEXT", required: false, order: 6 },
        ],
    },
    {
        id: "system-medical",
        name: "Medical History",
        sourceType: "SYSTEM",
        fields: [
            { key: "illnesses", label: "Illnesses", fieldType: "TEXTAREA", required: false, order: 0 },
            { key: "allergies", label: "Allergies", fieldType: "TEXT", required: false, order: 1 },
            { key: "medications", label: "Medications", fieldType: "TEXT", required: false, order: 2 },
            { key: "current_symptoms", label: "Current Symptoms", fieldType: "TEXTAREA", required: false, order: 3 },
            { key: "previous_surgeries", label: "Previous Surgeries", fieldType: "TEXTAREA", required: false, order: 4 },
        ],
    },
    {
        id: "system-financial",
        name: "Financial",
        sourceType: "SYSTEM",
        fields: [
            { key: "income", label: "Income", fieldType: "TEXT", required: false, order: 0 },
            { key: "expenses", label: "Expenses", fieldType: "TEXT", required: false, order: 1 },
            { key: "debts", label: "Debts", fieldType: "TEXT", required: false, order: 2 },
            { key: "assets", label: "Assets", fieldType: "TEXT", required: false, order: 3 },
            { key: "employment_status", label: "Employment Status", fieldType: "TEXT", required: false, order: 4 },
        ],
    },
    {
        id: "system-social",
        name: "Social History",
        sourceType: "SYSTEM",
        fields: [
            { key: "occupation", label: "Occupation", fieldType: "TEXT", required: false, order: 0 },
            { key: "living_situation", label: "Living Situation", fieldType: "TEXT", required: false, order: 1 },
            { key: "marital_status", label: "Marital Status", fieldType: "TEXT", required: false, order: 2 },
            { key: "dependents", label: "Dependents", fieldType: "TEXT", required: false, order: 3 },
            { key: "emergency_contact", label: "Emergency Contact", fieldType: "TEXT", required: false, order: 4 },
        ],
    },
];

export const EXAMPLE_TEMPLATES = [
    {
        id: "example-medical-intake",
        name: "Medical Intake Form",
        blockIds: ["system-id-long", "system-medical", "system-social"],
    },
    {
        id: "example-financial-assessment",
        name: "Financial Assessment",
        blockIds: ["system-id-short", "system-financial"],
    },
    {
        id: "example-client-intake",
        name: "Client Intake",
        blockIds: ["system-id-long", "system-social"],
    },
];