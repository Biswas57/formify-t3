"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import { APPEARANCE_STORAGE_KEY, type Appearance } from "./theme";

type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
    appearance: Appearance;
    resolvedTheme: ResolvedTheme;
    setAppearance: (appearance: Appearance) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isAppearance(value: string | null): value is Appearance {
    return value === "system" || value === "light" || value === "dark";
}

function readStoredAppearance(): Appearance {
    if (typeof window === "undefined") return "system";

    try {
        const value = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
        return isAppearance(value) ? value : "system";
    } catch {
        return "system";
    }
}

function getSystemTheme(): ResolvedTheme {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveAppearance(appearance: Appearance): ResolvedTheme {
    if (appearance === "dark") return "dark";
    if (appearance === "light") return "light";
    return getSystemTheme();
}

function applyThemeClass(resolvedTheme: ResolvedTheme) {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [appearance, setAppearanceState] = useState<Appearance>("system");
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
    const [ready, setReady] = useState(false);

    const applyAppearance = useCallback((nextAppearance: Appearance) => {
        const nextResolvedTheme = resolveAppearance(nextAppearance);
        applyThemeClass(nextResolvedTheme);
        setResolvedTheme(nextResolvedTheme);
    }, []);

    useEffect(() => {
        const storedAppearance = readStoredAppearance();
        setAppearanceState(storedAppearance);
        applyAppearance(storedAppearance);
        setReady(true);
    }, [applyAppearance]);

    useEffect(() => {
        if (!ready) return;

        applyAppearance(appearance);

        if (appearance !== "system") return;

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemChange = () => applyAppearance("system");

        media.addEventListener("change", handleSystemChange);
        return () => media.removeEventListener("change", handleSystemChange);
    }, [appearance, applyAppearance, ready]);

    const setAppearance = useCallback((nextAppearance: Appearance) => {
        setAppearanceState(nextAppearance);
        try {
            window.localStorage.setItem(APPEARANCE_STORAGE_KEY, nextAppearance);
        } catch {
            // Ignore storage failures; the in-memory preference still updates this session.
        }
    }, []);

    const value = useMemo(
        () => ({ appearance, resolvedTheme, setAppearance }),
        [appearance, resolvedTheme, setAppearance],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const value = useContext(ThemeContext);
    if (!value) {
        throw new Error("useTheme must be used inside ThemeProvider");
    }
    return value;
}
