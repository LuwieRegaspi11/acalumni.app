import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router';

interface DarkModeCtx { dark: boolean; toggle: () => void; }
const Ctx = createContext<DarkModeCtx>({ dark: false, toggle: () => {} });

// These routes must always render in light mode (landing page, sign in,
// sign up) even if the user previously turned dark mode on from a
// dashboard. Their saved preference is kept, just not applied here.
const FORCE_LIGHT_ROUTES = ['/', '/login', '/register'];

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const location = useLocation();

  const forceLight = FORCE_LIGHT_ROUTES.includes(location.pathname);
  const effectiveDark = dark && !forceLight;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', effectiveDark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark, effectiveDark]);

  return (
    <Ctx.Provider value={{ dark: effectiveDark, toggle: () => setDark(d => !d) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useDarkMode = () => useContext(Ctx);
