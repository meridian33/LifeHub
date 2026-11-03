"use client";

import {useEffect, useRef, useState} from "react";

export type ThemePreference = "light" | "dark" | "system" | "warm";
export type AccentPreference = "blue"|"green"|"violet"|"graphite";
export type DensityPreference = "compact"|"comfortable"|"spacious";
export type FontPreference = "system"|"inter"|"montserrat"|"manrope"|"plus-jakarta-sans"|"georgia";

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState("light");
  const [accent,setAccent]=useState<AccentPreference>('blue');
  const [density,setDensity]=useState<DensityPreference>('comfortable');
  const [font,setFont]=useState<FontPreference>('system');
  const currentPreference = useRef<ThemePreference>("system");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const read = (): ThemePreference => {
      try {
        const value = localStorage.getItem("lifehub-theme");
        return value === "light" || value === "dark" || value === "warm" ? value : "system";
      } catch { return "system"; }
    };
    const apply = (value = currentPreference.current) => {
      currentPreference.current = value;
      const resolved = value === "system" ? (media.matches ? "dark" : "light") : value;
      setPreference(value);
      setTheme(resolved);
      document.documentElement.dataset.theme = resolved;
    };
    const onSystemChange = () => apply();
    const readPersonalization = () => {
      try {
        const savedAccent=localStorage.getItem('lifehub-accent');
        const nextAccent:AccentPreference=savedAccent==='green'||savedAccent==='violet'||savedAccent==='graphite'?savedAccent:'blue';
        setAccent(nextAccent);document.documentElement.dataset.accent=nextAccent;
        const savedDensity=localStorage.getItem('lifehub-density');
        const nextDensity:DensityPreference=savedDensity==='compact'||savedDensity==='spacious'?savedDensity:'comfortable';
        setDensity(nextDensity);document.documentElement.dataset.density=nextDensity;
        const savedFont=localStorage.getItem('lifehub-font');
        const nextFont:FontPreference=savedFont==='inter'||savedFont==='montserrat'||savedFont==='manrope'||savedFont==='plus-jakarta-sans'||savedFont==='georgia'?savedFont:'system';
        setFont(nextFont);document.documentElement.dataset.font=nextFont;
      } catch { /* Keep the current appearance when storage is unavailable. */ }
    };
    const onStorageChange = () => {apply(read());readPersonalization();};
    apply(read());
    readPersonalization();
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, []);

  const selectTheme = (value: ThemePreference) => {
    currentPreference.current = value;
    const resolved = value === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value;
    setPreference(value);
    setTheme(resolved);
    document.documentElement.dataset.theme = resolved;
    try { localStorage.setItem("lifehub-theme", value); } catch { /* Theme still works when storage is unavailable. */ }
  };

  const selectAccent=(value:AccentPreference)=>{setAccent(value);document.documentElement.dataset.accent=value;try{localStorage.setItem('lifehub-accent',value);}catch{}};
  const selectDensity=(value:DensityPreference)=>{setDensity(value);document.documentElement.dataset.density=value;try{localStorage.setItem('lifehub-density',value);}catch{}};
  const selectFont=(value:FontPreference)=>{setFont(value);document.documentElement.dataset.font=value;try{localStorage.setItem('lifehub-font',value);}catch{}};
  return {theme, preference, selectTheme, accent,selectAccent,density,selectDensity,font,selectFont,changeTheme: () => selectTheme(theme === "dark" ? "light" : "dark")};
}
