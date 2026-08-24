"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("krids-theme") as Theme | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme = saved || (prefersDark ? "dark" : "light");
    setThemeState(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    document.documentElement.style.colorScheme = initial;
    setMounted(true);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("krids-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
  };

  const toggle = () => setTheme(theme === "light" ? "dark" : "light");

  // SSR 방지: mounted 전에는 light로 렌더링, 깜빡임 최소화 위해 suppressHydration
  return (
    <ThemeContext.Provider value={{ theme: theme, toggle, setTheme }}>
      {children}
      {/* 전역 테마 토글 버튼 - 페이지 전체에 영향, 한글 라벨 */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
        <button
          onClick={toggle}
          aria-label="테마 변경"
          className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-lg hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:border-zinc-700 dark:hover:bg-zinc-800 transition"
          title={theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}
        >
          <span className="text-base">{theme === "light" ? "🌙" : "☀️"}</span>
          <span>{theme === "light" ? "다크 모드" : "라이트 모드"}</span>
        </button>
        <span className="hidden md:inline text-xs text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-2 py-1 rounded-full border dark:border-zinc-700">
          테마는 페이지 전체에 적용됩니다
        </span>
      </div>
    </ThemeContext.Provider>
  );
}
