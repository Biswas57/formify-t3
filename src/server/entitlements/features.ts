/**
 * Feature keys for the entitlements system.
 * Add new features here as the app grows.
 */
export const FEATURES = {
    CUSTOM_BLOCKS_CREATE: "custom_blocks:create",
    CUSTOM_BLOCKS_DELETE: "custom_blocks:delete",
    TEMPLATES_UNLIMITED: "templates:unlimited",
    TRANSCRIPTION_UNLIMITED: "transcription:unlimited",
    // Gate for notes mode. Set to true once notes stability work is solid.
    // Flip NOTES_IS_PRO_ONLY=true in your .env to activate gating without a code deploy.
    NOTES_ACCESS: "notes:access",
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
        FEATURES.NOTES_ACCESS,
    ],
};

export const PLAN_LIMITS = {
    // Aligned with Stripe pricing table: Free plan shows "Up to 10 templates"
    FREE_TEMPLATES: 10,
    // Aligned with BillingCard copy: "3 transcription sessions per day"
    FREE_DAILY_TRANSCRIPTIONS: 3,
} as const;

/**
 * Pure helper — safe to import in client components.
 * Check if a features array includes a specific feature key.
 */
export function hasFeature(
    entitlements: { features: FeatureKey[] },
    featureKey: FeatureKey
): boolean {
    return entitlements.features.includes(featureKey);
}