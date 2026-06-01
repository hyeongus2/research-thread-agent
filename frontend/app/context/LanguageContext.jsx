'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import en from '../i18n/en';
import ko from '../i18n/ko';

const translations = { en, ko };

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: en });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'ko') setLangState(saved);
  }, []);

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('lang', l);
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
