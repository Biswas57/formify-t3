/**
 * Converts a snake_case or camelCase field key into a human-readable Title Case label.
 * 
 * Examples:
 * - "date_of_birth" → "Date of Birth"
 * - "place_of_birth" → "Place of Birth"
 * - "phone_number" → "Phone Number"
 * - "ssn" → "SSN"
 * - "dob" → "DOB"
 * - "id" → "ID"
 * - "email_address" → "Email Address"
 * 
 * @param key The field key (snake_case, camelCase, or plain)
 * @returns A human-friendly Title Case label
 */
export function formatFieldLabel(key: string): string {
    if (!key) return "";
    
    // Common acronyms that should stay uppercase
    const acronyms = new Set([
        "id", "ssn", "dob", "doi", "dod", "url", "uri", "api", "ui", "ux",
        "ceo", "cto", "cfo", "vp", "hr", "it", "ip", "gps", "usa", "uk",
        "fda", "fbi", "cia", "nhs", "gdpr", "hipaa", "ehr", "emr"
    ]);
    
    // Split on underscores or camelCase boundaries
    const words = key
        .replace(/([a-z])([A-Z])/g, "$1_$2") // camelCase to snake_case
        .split(/[_\s-]+/) // split on underscores, spaces, or hyphens
        .filter(Boolean)
        .map(word => word.toLowerCase());
    
    // Title case each word, keeping acronyms uppercase
    const formatted = words.map((word, index) => {
        // Check if word is a known acronym
        if (acronyms.has(word)) {
            return word.toUpperCase();
        }
        
        // Special case: "of", "the", "and", "in", "on", "at" should be lowercase unless first word
        const lowerCaseWords = new Set(["of", "the", "and", "in", "on", "at", "for", "to", "with"]);
        if (index > 0 && lowerCaseWords.has(word)) {
            return word;
        }
        
        // Default: capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1);
    });
    
    return formatted.join(" ");
}
