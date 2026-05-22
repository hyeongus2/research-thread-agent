'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = 'http://localhost:8000/api';

const DEFAULT_LIMITS = { papers: 50, models: 25, repos: 25 };
const DEFAULT_LP_LIMITS = { papersPerEra: 10, models: 5, repos: 5 };

function readLimits() {
  try {
    const stored = localStorage.getItem('search_limits');
    return stored ? { ...DEFAULT_LIMITS, ...JSON.parse(stored) } : DEFAULT_LIMITS;
  } catch { return DEFAULT_LIMITS; }
}

function readLpLimits() {
  try {
    const stored = localStorage.getItem('learning_path_limits');
    return stored ? { ...DEFAULT_LP_LIMITS, ...JSON.parse(stored) } : DEFAULT_LP_LIMITS;
  } catch { return DEFAULT_LP_LIMITS; }
}

const ALL_CATEGORIES = [
  'NLP/LLM', 'Computer Vision', 'Generative AI', 'AI Agents',
  'Reinforcement Learning', 'Multimodal', 'Speech/Audio',
  'Robotics', 'ML Theory', 'Systems/Efficiency',
];

export default function Settings({ onClose, userId, onInterestsSaved }) {
  const { t, lang, setLang } = useLanguage();
  const ts = t.settings;

  const [digestOn, setDigestOn] = useState(false);
  const [breakthroughOn, setBreakthroughOn] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);
  const [limits, setLimits] = useState(readLimits);
  const [lpLimits, setLpLimits] = useState(readLpLimits);

  // Interests state
  const [selCategories, setSelCategories] = useState([]);
  const [selKeywords, setSelKeywords] = useState([]);
  const [kwInput, setKwInput] = useState('');
  const [interestsSaved, setInterestsSaved] = useState(false);
  const [interestsSaving, setInterestsSaving] = useState(false);
  const kwRef = useRef(null);

  // Load current preferences and notification settings on mount
  useEffect(() => {
    const uid = userId || 1;
    fetch(`${API}/me?user_id=${uid}`)
      .then(r => r.json())
      .then(d => {
        const prefs = d.preferences || {};
        setSelCategories(prefs.categories || []);
        setSelKeywords(prefs.keywords || []);
      })
      .catch(() => {});
    fetch(`${API}/notifications/settings?user_id=${uid}`)
      .then(r => r.json())
      .then(d => {
        setDigestOn(d.email_enabled ?? true);
        setBreakthroughOn(d.breakthrough_enabled ?? false);
      })
      .catch(() => {});
  }, [userId]);

  const handleDigestToggle = async () => {
    const next = !digestOn;
    setDigestOn(next);
    try {
      await fetch(`${API}/notifications/settings?user_id=${userId || 1}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_enabled: next }),
      });
    } catch (_) {}
  };

  const handleBreakthroughToggle = async () => {
    const next = !breakthroughOn;
    setBreakthroughOn(next);
    try {
      await fetch(`${API}/notifications/settings?user_id=${userId || 1}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breakthrough_enabled: next }),
      });
    } catch (_) {}
  };

  const toggleCategory = (cat) => {
    setSelCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !selKeywords.includes(kw)) {
      setSelKeywords(prev => [...prev, kw]);
    }
    setKwInput('');
  };

  const removeKeyword = (kw) => setSelKeywords(prev => prev.filter(k => k !== kw));

  const handleKwKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addKeyword(); }
  };

  const handleSaveInterests = async () => {
    setInterestsSaving(true);
    try {
      await fetch(`${API}/me/preferences?user_id=${userId || 1}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: selCategories, keywords: selKeywords }),
      });
      if (onInterestsSaved) onInterestsSaved();
      setInterestsSaved(true);
      setTimeout(() => setInterestsSaved(false), 3000);
    } catch (_) {}
    setInterestsSaving(false);
  };

  const updateLimit = (key, raw) => {
    const val = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
    const next = { ...limits, [key]: val };
    setLimits(next);
    localStorage.setItem('search_limits', JSON.stringify(next));
  };

  const resetLimits = () => {
    setLimits(DEFAULT_LIMITS);
    localStorage.setItem('search_limits', JSON.stringify(DEFAULT_LIMITS));
  };

  const LP_BOUNDS = { papersPerEra: [3, 20], models: [0, 20], repos: [0, 20] };

  const updateLpLimit = (key, raw) => {
    const [min, max] = LP_BOUNDS[key];
    const val = Math.max(min, Math.min(max, parseInt(raw, 10) || min));
    const next = { ...lpLimits, [key]: val };
    setLpLimits(next);
    localStorage.setItem('learning_path_limits', JSON.stringify(next));
  };

  const resetLpLimits = () => {
    setLpLimits(DEFAULT_LP_LIMITS);
    localStorage.setItem('learning_path_limits', JSON.stringify(DEFAULT_LP_LIMITS));
  };

  const handleClearHistory = async () => {
    try {
      await fetch(`${API}/admin/clear-search-history`, { method: 'POST' });
    } catch { /* best-effort */ }
    setHistoryCleared(true);
    setTimeout(() => setHistoryCleared(false), 2500);
  };

  const handleReset = async () => {
    try {
      await fetch(`${API}/admin/reset-db`, { method: 'POST' });
    } catch {
      // best-effort; backend may not expose this in all environments
    }
    localStorage.removeItem('user_id');
    localStorage.removeItem('search_limits');
    localStorage.removeItem('learning_path_limits');
    localStorage.removeItem('lang');
    setResetDone(true);
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#FAF7F2',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10,
    }}>
      <div style={{
        padding: '52px 24px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #E8E2D5',
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#1A1611',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: "'Geist', sans-serif",
            fontSize: 13,
          }}
        >
          <ChevronLeft size={18} /> {ts.close}
        </button>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#1A1611', fontStyle: 'italic' }}>
          {ts.title}
        </span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* Language */}
        <div style={sectionLabel}>{ts.language}</div>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D5',
          borderRadius: 4,
          marginBottom: 28,
          padding: '4px',
          display: 'flex',
          gap: 4,
        }}>
          {[{ code: 'en', label: 'English' }, { code: 'ko', label: '한국어' }].map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              style={{
                flex: 1,
                padding: '10px',
                background: lang === code ? '#1A1611' : 'transparent',
                color: lang === code ? '#FAF7F2' : '#6B6358',
                border: 'none',
                borderRadius: 2,
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                fontWeight: lang === code ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <div style={sectionLabel}>{ts.notifications}</div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, marginBottom: 28 }}>
          <SettingRow
            title={ts.dailyDigest}
            description={ts.dailyDigestDesc}
            on={digestOn}
            onToggle={handleDigestToggle}
          />
          <SettingRow
            title={ts.breakthroughAlerts}
            description={ts.breakthroughDesc}
            on={breakthroughOn}
            onToggle={handleBreakthroughToggle}
            noBorder
          />
        </div>

        {/* MCP */}
        <div style={sectionLabel}>{ts.forDev}</div>
        <div style={{
          background: '#1A1611',
          borderRadius: 4,
          padding: '20px',
          color: '#FAF7F2',
          marginBottom: 28,
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#C84B31', letterSpacing: '0.1em', marginBottom: 8 }}>
            {ts.mcpBeta}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontStyle: 'italic', marginBottom: 8 }}>
            {ts.mcpTitle}
          </div>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#D8D0BE', lineHeight: 1.5, marginBottom: 14 }}>
            {ts.mcpDesc}
          </div>
          <div style={{
            background: '#0F0D09',
            padding: '10px 12px',
            borderRadius: 3,
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#C84B31',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}>
            npx @research-thread/mcp init
          </div>
        </div>

        {/* Search limits */}
        <div style={sectionLabel}>{ts.searchLimits}</div>
        <div style={{
          background: '#FFFFFF', border: '1px solid #E8E2D5',
          borderRadius: 4, padding: '16px', marginBottom: 28,
        }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', lineHeight: 1.5, marginBottom: 16 }}>
            {ts.searchLimitsDesc}
          </div>
          {[
            { key: 'papers', label: ts.papersLimit },
            { key: 'models', label: ts.modelsLimit },
            { key: 'repos',  label: ts.reposLimit  },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611' }}>{label}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={limits[key]}
                onChange={e => updateLimit(key, e.target.value)}
                style={{
                  width: 64, padding: '5px 8px',
                  border: '1px solid #D8D0BE', borderRadius: 4,
                  fontFamily: "'Geist Mono', monospace", fontSize: 13,
                  color: '#1A1611', background: '#FAF7F2',
                  outline: 'none', textAlign: 'center',
                }}
              />
            </div>
          ))}
          <button
            onClick={resetLimits}
            style={{
              marginTop: 4,
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid #D8D0BE',
              borderRadius: 4,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              color: '#6B6358',
              cursor: 'pointer',
            }}
          >
            {ts.resetLimits}
          </button>
        </div>

        {/* Learning Path limits */}
        <div style={sectionLabel}>{ts.lpLimits}</div>
        <div style={{
          background: '#FFFFFF', border: '1px solid #E8E2D5',
          borderRadius: 4, padding: '16px', marginBottom: 28,
        }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', lineHeight: 1.5, marginBottom: 16 }}>
            {ts.lpLimitsDesc}
          </div>
          {[
            { key: 'papersPerEra', label: ts.lpPapersPerEra, min: 3, max: 20 },
            { key: 'models', label: ts.lpModels, min: 0, max: 20 },
            { key: 'repos', label: ts.lpRepos, min: 0, max: 20 },
          ].map(({ key, label, min, max }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611' }}>{label}</span>
              <input
                type="number"
                min={min}
                max={max}
                value={lpLimits[key]}
                onChange={e => updateLpLimit(key, e.target.value)}
                style={{
                  width: 64, padding: '5px 8px',
                  border: '1px solid #D8D0BE', borderRadius: 4,
                  fontFamily: "'Geist Mono', monospace", fontSize: 13,
                  color: '#1A1611', background: '#FAF7F2',
                  outline: 'none', textAlign: 'center',
                }}
              />
            </div>
          ))}
          <button
            onClick={resetLpLimits}
            style={{
              marginTop: 4,
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid #D8D0BE',
              borderRadius: 4,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              color: '#6B6358',
              cursor: 'pointer',
            }}
          >
            {ts.resetLpLimits}
          </button>
        </div>

        {/* Interests */}
        <div style={sectionLabel}>{ts.interests}</div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: '16px', marginBottom: 28 }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', lineHeight: 1.5, marginBottom: 16 }}>
            {ts.interestsDesc}
          </div>

          {/* Categories */}
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9E9485', letterSpacing: '0.1em', marginBottom: 10 }}>
            {ts.interestsCategories}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: '1px solid',
                  borderColor: selCategories.includes(cat) ? '#1A1611' : '#D8D0BE',
                  background: selCategories.includes(cat) ? '#1A1611' : 'transparent',
                  color: selCategories.includes(cat) ? '#FAF7F2' : '#6B6358',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Keywords */}
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9E9485', letterSpacing: '0.1em', marginBottom: 10 }}>
            {ts.interestsKeywords}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {selKeywords.map(kw => (
              <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F0EBE0', padding: '4px 10px', borderRadius: 12, fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#1A1611' }}>
                {kw}
                <button onClick={() => removeKeyword(kw)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, color: '#6B6358' }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              ref={kwRef}
              value={kwInput}
              onChange={e => setKwInput(e.target.value)}
              onKeyDown={handleKwKeyDown}
              placeholder={ts.interestsKwPlaceholder}
              style={{
                flex: 1, padding: '8px 10px',
                border: '1px solid #D8D0BE', borderRadius: 4,
                fontFamily: "'Geist', sans-serif", fontSize: 13,
                color: '#1A1611', background: '#FAF7F2', outline: 'none',
              }}
            />
            <button
              onClick={addKeyword}
              style={{ padding: '8px 14px', background: '#1A1611', color: '#FAF7F2', border: 'none', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 13, cursor: 'pointer' }}
            >
              +
            </button>
          </div>

          {interestsSaved ? (
            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611' }}>
              {ts.interestsSaved}
            </div>
          ) : (
            <button
              onClick={handleSaveInterests}
              disabled={interestsSaving}
              style={{
                padding: '10px 18px',
                background: interestsSaving ? '#D8D0BE' : '#C84B31',
                color: '#FAF7F2',
                border: 'none', borderRadius: 4,
                fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500,
                cursor: interestsSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {ts.interestsSaveBtn}
            </button>
          )}
        </div>

        {/* Data management */}
        <div style={sectionLabel}>{ts.data}</div>

        {/* Clear search history */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: '16px', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', fontWeight: 500, marginBottom: 4 }}>
            {ts.clearHistoryTitle}
          </div>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', lineHeight: 1.5, marginBottom: 14 }}>
            {ts.clearHistoryDesc}
          </div>
          {historyCleared ? (
            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611' }}>
              {ts.clearHistoryDone}
            </div>
          ) : (
            <button
              onClick={handleClearHistory}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                border: '1px solid #D8D0BE',
                borderRadius: 4,
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                color: '#1A1611',
                cursor: 'pointer',
              }}
            >
              {ts.clearHistoryBtn}
            </button>
          )}
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: '16px' }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', fontWeight: 500, marginBottom: 4 }}>
            {ts.resetTitle}
          </div>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', lineHeight: 1.5, marginBottom: 14 }}>
            {ts.resetDesc}
          </div>

          {resetDone ? (
            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#C84B31' }}>
              {ts.resetting}
            </div>
          ) : !confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                border: '1px solid #D8D0BE',
                borderRadius: 4,
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                color: '#1A1611',
              }}
            >
              {ts.resetBtn}
            </button>
          ) : (
            <div>
              <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#C84B31', marginBottom: 12 }}>
                {ts.confirmMsg}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '10px 18px',
                    background: '#1A1611',
                    color: '#FAF7F2',
                    border: 'none',
                    borderRadius: 4,
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {ts.yesReset}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  style={{
                    padding: '10px 18px',
                    background: 'transparent',
                    border: '1px solid #D8D0BE',
                    borderRadius: 4,
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 13,
                    color: '#1A1611',
                  }}
                >
                  {ts.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ title, description, on, onToggle, noBorder }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: noBorder ? 'none' : '1px solid #F0EAD9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', fontWeight: 500 }}>
          {title}
        </div>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', marginTop: 2 }}>
          {description}
        </div>
      </div>
      <button
        onClick={onToggle}
        style={{
          width: 36,
          height: 20,
          background: on ? '#1A1611' : '#D8D0BE',
          borderRadius: 10,
          border: 'none',
          padding: 0,
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 16,
          height: 16,
          background: '#FAF7F2',
          borderRadius: 8,
          position: 'absolute',
          top: 2,
          [on ? 'right' : 'left']: 2,
          transition: 'all 0.2s',
        }} />
      </button>
    </div>
  );
}

const sectionLabel = {
  fontFamily: "'Geist', sans-serif",
  fontSize: 11,
  color: '#6B6358',
  letterSpacing: '0.15em',
  marginBottom: 12,
};
