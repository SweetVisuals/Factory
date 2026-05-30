import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
    simpleModeStorageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    simpleMode: boolean;
    setSimpleMode: (simpleMode: boolean) => void;
};

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
    simpleMode: false,
    setSimpleMode: () => null,
};

const ThemeContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
    simpleModeStorageKey = "vite-ui-simple-mode",
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );
    const [simpleMode, setSimpleMode] = useState<boolean>(
        () => localStorage.getItem(simpleModeStorageKey) === "true"
    );

    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove("light", "dark");

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light";

            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    useEffect(() => {
        const root = window.document.documentElement;
        if (simpleMode) {
            root.classList.add("simple-mode");
        } else {
            root.classList.remove("simple-mode");
        }
    }, [simpleMode]);

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme);
            setTheme(theme);
        },
        simpleMode,
        setSimpleMode: (simpleMode: boolean) => {
            localStorage.setItem(simpleModeStorageKey, String(simpleMode));
            setSimpleMode(simpleMode);
        },
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeContext);

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");

    return context;
};

