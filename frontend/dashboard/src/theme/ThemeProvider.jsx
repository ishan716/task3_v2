import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(undefined);
const STORAGE_KEY = "darkMode";

function getStoredPreference() {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "true";
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => getStoredPreference());

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const body = document.body;
    if (isDark) {
      root.classList.add("dark");
      body?.classList.add("dark");
    } else {
      root.classList.remove("dark");
      body?.classList.remove("dark");
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(isDark));
    }
  }, [isDark]);

  const value = useMemo(
    () => ({
      isDark,
      setTheme: setIsDark,
      toggleTheme: () => setIsDark((prev) => !prev),
    }),
    [isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
