/**
 * Feature keys for the entitlements system.
 * Add new features here as the app grows.
 */
export const FEATURES = {
    CUSTOM_BLOCKS_CREATE: "custom_blocks:create",
    CUSTOM_BLOCKS_DELETE: "custom_blocks:delete",
    TEMPLATES_UNLIMITED: "templates:unlimited",
    TRANSCRIPTION_UNLIMITED: "transcription:unlimited",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Feature definitions for each plan.
 * Returns which features are enabled for a given plan slug.
 */
export const PLAN_FEATURES: Record<string, FeatureKey[]> = {
    free: [
        // Free users get basic features only
    ],
    pro: [
        // Pro users get all features
        FEATURES.CUSTOM_BLOCKS_CREATE,
        FEATURES.CUSTOM_BLOCKS_DELETE,
        FEATURES.TEMPLATES_UNLIMITED,
        FEATURES.TRANSCRIPTION_UNLIMITED,
    ],
};

export const PLAN_LIMITS = {
    FREE_TEMPLATES: 5,
    FREE_DAILY_TRANSCRIPTIONS: 3,
} as const;
