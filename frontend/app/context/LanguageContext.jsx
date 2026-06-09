'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import en from '../i18n/en';
import ko from '../i18n/ko';

const translations = { en, ko };

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: en });

function getApiBase() {
  const port = process.env.NEXT_PUBLIC_API_PORT || '8000';
  if (typeof window === 'undefined') return `http://localhost:${port}/api`;
  return `${window.location.protocol}//${window.location.hostname}:${port}/api`;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'ko') {
      setLangState(saved);
      return;
    }
    // localStorage cleared — try DB fallback
    fetch(`${getApiBase()}/me?user_id=1`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const dbLang = data?.preferences?.lang;
        if (dbLang === 'en' || dbLang === 'ko') {
          setLangState(dbLang);
          localStorage.setItem('lang', dbLang);
        }
      })
      .catch(() => {});
  }, []);

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('lang', l);
    // Persist to DB so it survives localStorage clear
    fetch(`${getApiBase()}/me/lang?user_id=1&lang=${l}`, { method: 'PATCH' }).catch(() => {});
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
