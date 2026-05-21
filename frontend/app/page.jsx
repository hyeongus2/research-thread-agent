'use client';

import { useState, useEffect } from 'react';
import Welcome from './components/Welcome';
import { OnboardingCategories, OnboardingKeywords } from './components/Onboarding';
import Feed from './components/Feed';
import PaperDetail from './components/PaperDetail';
import Settings from './components/Settings';
import { useLanguage } from './context/LanguageContext';

const API = 'http://localhost:8000/api';

function LangToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 1000,
      display: 'flex',
      gap: 2,
      fontFamily: "'Geist', sans-serif",
      fontSize: 11,
      letterSpacing: '0.08em',
      background: 'rgba(250,247,242,0.88)',
      backdropFilter: 'blur(4px)',
      borderRadius: 20,
      padding: '2px 4px',
      border: '1px solid #E8E2D5',
    }}>
      <button
        onClick={() => setLang('en')}
        style={{
          background: 'none', border: 'none', padding: '3px 8px',
          color: lang === 'en' ? '#1A1611' : '#6B6358',
          fontWeight: lang === 'en' ? 700 : 400,
          fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit',
          cursor: 'pointer',
        }}
      >EN</button>
      <span style={{ color: '#D8D0BE', lineHeight: '22px' }}>|</span>
      <button
        onClick={() => setLang('ko')}
        style={{
          background: 'none', border: 'none', padding: '3px 8px',
          color: lang === 'ko' ? '#1A1611' : '#6B6358',
          fontWeight: lang === 'ko' ? 700 : 400,
          fontFamily: 'inherit', fontSize: 'inherit',
          cursor: 'pointer',
        }}
      >한국어</button>
    </div>
  );
}

export default function Page() {
  const [screen, setScreen] = useState(null); // null = loading

  // Onboarding state
  const [categories, setCategories] = useState([]);
  const [keywords, setKeywords] = useState([]);

  // Feed state
  const [userId, setUserId] = useState(null);
  const [openPaper, setOpenPaper] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [saved, setSaved] = useState([]);

  // On mount: check if user has already completed onboarding
  useEffect(() => {
    const stored = localStorage.getItem('user_id');
    if (stored) {
      setUserId(Number(stored));
      setScreen('feed');
    } else {
      setScreen('welcome');
    }
  }, []);

  const toggleCategory = (k) =>
    setCategories(c => c.includes(k) ? c.filter(x => x !== k) : [...c, k]);

  const toggleSave = (id) =>
    setSaved(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleOnboardingDone = async () => {
    try {
      const res = await fetch(`${API}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories, keywords }),
      });
      const data = await res.json();
      localStorage.setItem('user_id', String(data.user_id));
      setUserId(data.user_id);
    } catch (err) {
      // If backend is unreachable during development, still proceed
      console.warn('Onboarding API unavailable, continuing offline:', err);
      localStorage.setItem('user_id', '1');
      setUserId(1);
    }
    setScreen('feed');
  };

  if (screen === null) return null;

  return (
    <div
      className="screen-enter"
      style={{
        minHeight: '100dvh',
        background: '#FAF7F2',
        position: 'relative',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <LangToggle />
      {screen === 'welcome' && (
        <div style={{ height: '100dvh' }}>
          <Welcome onStart={() => setScreen('cat')} />
        </div>
      )}

      {screen === 'cat' && (
        <div style={{ height: '100dvh' }}>
          <OnboardingCategories
            selected={categories}
            onToggle={toggleCategory}
            onNext={() => setScreen('kw')}
            onBack={() => setScreen('welcome')}
          />
        </div>
      )}

      {screen === 'kw' && (
        <div style={{ height: '100dvh' }}>
          <OnboardingKeywords
            keywords={keywords}
            onAdd={(k) => setKeywords(prev => [...prev, k])}
            onRemove={(k) => setKeywords(prev => prev.filter(x => x !== k))}
            onNext={handleOnboardingDone}
            onBack={() => setScreen('cat')}
          />
        </div>
      )}

      {screen === 'feed' && (
        <div style={{ height: '100dvh' }}>
          <Feed
            onSettings={() => setShowSettings(true)}
            onPaperTap={setOpenPaper}
            saved={saved}
            onToggleSave={toggleSave}
            userId={userId}
          />
        </div>
      )}

      {openPaper && (
        <PaperDetail paper={openPaper} onClose={() => setOpenPaper(null)} />
      )}
      {showSettings && (
        <Settings userId={userId} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
