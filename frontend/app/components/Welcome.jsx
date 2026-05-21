'use client';

import { ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Welcome({ onStart }) {
  const { t, lang, setLang } = useLanguage();

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '60px 28px 32px',
      justifyContent: 'space-between',
      position: 'relative',
    }}>
      {/* Language toggle */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 24,
        display: 'flex',
        gap: 4,
        fontFamily: "'Geist', sans-serif",
        fontSize: 11,
        letterSpacing: '0.08em',
      }}>
        <button
          onClick={() => setLang('en')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 8px',
            color: lang === 'en' ? '#1A1611' : '#6B6358',
            fontWeight: lang === 'en' ? 700 : 400,
            fontFamily: 'inherit',
            fontSize: 'inherit',
            letterSpacing: 'inherit',
          }}
        >
          EN
        </button>
        <span style={{ color: '#D8D0BE', lineHeight: '24px' }}>|</span>
        <button
          onClick={() => setLang('ko')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 8px',
            color: lang === 'ko' ? '#1A1611' : '#6B6358',
            fontWeight: lang === 'ko' ? 700 : 400,
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        >
          한국어
        </button>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 52,
          lineHeight: 0.95,
          fontWeight: 400,
          color: '#1A1611',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          {t.welcome.line1}<br />
          <span style={{ fontStyle: 'italic', fontWeight: 300 }}>{t.welcome.line2}</span><br />
          {t.welcome.line3}
        </h1>
        <div style={{
          marginTop: 32,
          fontFamily: "'Geist', sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          color: '#6B6358',
          maxWidth: 280,
        }}>
          {t.welcome.subtitle}
        </div>
        <div style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: "'Geist', sans-serif",
          fontSize: 12,
          color: '#1A1611',
        }}>
          <div style={{ width: 28, height: 1, background: '#1A1611' }} />
          <span style={{ fontStyle: 'italic', fontFamily: "'Fraunces', serif", fontSize: 14 }}>
            {t.welcome.tagline}
          </span>
        </div>
      </div>
      <button
        onClick={onStart}
        style={{
          width: '100%',
          padding: '18px',
          background: '#1A1611',
          color: '#FAF7F2',
          border: 'none',
          borderRadius: 0,
          fontSize: 15,
          fontWeight: 500,
          fontFamily: "'Geist', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          letterSpacing: '0.02em',
        }}
      >
        {t.welcome.cta} <ChevronRight size={18} />
      </button>
    </div>
  );
}
