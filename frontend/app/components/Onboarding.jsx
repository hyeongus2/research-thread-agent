'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Heart } from 'lucide-react';
import { CATEGORIES, SUGGESTED_KEYWORDS, MOCK_PAPERS } from '../data';
import FakeFigure from './FakeFigure';
import { useLanguage } from '../context/LanguageContext';

// =============================================================================
// Step 1: Category selection
// =============================================================================
export function OnboardingCategories({ selected, onToggle, onNext, onBack }) {
  const { t } = useLanguage();
  const tc = t.onboarding.categories;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 28px 28px' }}>
      <ProgressHeader step={1} onBack={onBack} />

      <h2 style={titleStyle}>
        {tc.titlePre} <span style={{ fontStyle: 'italic' }}>{tc.titleItalic}</span> {tc.titlePost}
      </h2>
      <p style={subtitleStyle}>{tc.subtitle}</p>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        alignContent: 'start',
      }}>
        {CATEGORIES.map(cat => {
          const isSelected = selected.includes(cat.key);
          return (
            <button
              key={cat.key}
              onClick={() => onToggle(cat.key)}
              style={{
                padding: '16px 14px',
                background: isSelected ? '#1A1611' : 'transparent',
                color: isSelected ? '#FAF7F2' : '#1A1611',
                border: `1px solid ${isSelected ? '#1A1611' : '#D8D0BE'}`,
                borderRadius: 4,
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 18 }}>{cat.emoji}</span>
              <span style={{ fontWeight: 500 }}>{cat.label}</span>
            </button>
          );
        })}
      </div>

      <NextButton label={tc.next} onClick={onNext} disabled={selected.length === 0} />
    </div>
  );
}

// =============================================================================
// Step 2: Keyword input
// =============================================================================
export function OnboardingKeywords({ keywords, onAdd, onRemove, onNext, onBack }) {
  const { t } = useLanguage();
  const tk = t.onboarding.keywords;
  const [input, setInput] = useState('');

  const handleAdd = (kw) => {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) onAdd(trimmed);
    setInput('');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 28px 28px' }}>
      <ProgressHeader step={2} onBack={onBack} />

      <h2 style={titleStyle}>
        {tk.titlePre} <span style={{ fontStyle: 'italic' }}>{tk.titleItalic}</span> {tk.titlePost}
      </h2>
      <p style={subtitleStyle}>{tk.subtitle}</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(input); }}
          placeholder={tk.placeholder}
          style={{
            flex: 1,
            padding: '12px 14px',
            background: 'transparent',
            border: '1px solid #D8D0BE',
            borderRadius: 4,
            fontFamily: "'Geist', sans-serif",
            fontSize: 14,
            color: '#1A1611',
          }}
        />
        <button
          onClick={() => handleAdd(input)}
          style={{
            padding: '12px 16px',
            background: '#1A1611',
            color: '#FAF7F2',
            border: 'none',
            borderRadius: 4,
            fontFamily: "'Geist', sans-serif",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {tk.add}
        </button>
      </div>

      {keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {keywords.map(kw => (
            <span key={kw} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: '#1A1611',
              color: '#FAF7F2',
              borderRadius: 100,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              fontWeight: 500,
            }}>
              {kw}
              <button
                onClick={() => onRemove(kw)}
                style={{ background: 'none', border: 'none', color: '#FAF7F2', padding: 0, display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{
        fontSize: 11,
        fontFamily: "'Geist', sans-serif",
        color: '#6B6358',
        letterSpacing: '0.1em',
        marginBottom: 10,
      }}>
        {tk.suggested}
      </div>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'start' }}>
        {SUGGESTED_KEYWORDS.filter(k => !keywords.includes(k)).map(kw => (
          <button
            key={kw}
            onClick={() => handleAdd(kw)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid #D8D0BE',
              borderRadius: 100,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              color: '#1A1611',
            }}
          >
            + {kw}
          </button>
        ))}
      </div>

      <NextButton label={tk.next} onClick={onNext} disabled={keywords.length === 0} />
    </div>
  );
}

// =============================================================================
// Step 3: Calibration
// =============================================================================
export function OnboardingCalibration({ onDecision, onDone, onBack }) {
  const { t } = useLanguage();
  const tca = t.onboarding.calibration;
  const [idx, setIdx] = useState(0);
  const calibPapers = MOCK_PAPERS.slice(0, 4);
  const current = calibPapers[idx];

  const handleDecision = (liked) => {
    onDecision(current.id, liked);
    if (idx + 1 >= calibPapers.length) {
      setTimeout(onDone, 200);
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 28px 28px' }}>
      <ProgressHeader step={3} onBack={onBack} />

      <h2 style={{ ...titleStyle, fontSize: 26 }}>
        {tca.titleLine1}<br />
        <span style={{ fontStyle: 'italic' }}>{tca.titleLine2}</span>
      </h2>
      <p style={subtitleStyle}>
        {idx + 1} / {calibPapers.length} · {tca.subtitle}
      </p>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {current && (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E8E2D5',
            padding: '22px 20px',
            borderRadius: 4,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              fontSize: 11,
              fontFamily: "'Geist', sans-serif",
              color: '#6B6358',
              letterSpacing: '0.05em',
            }}>
              <span style={{
                background: '#FFE8E0',
                color: '#8B2E1B',
                padding: '3px 8px',
                borderRadius: 2,
                fontSize: 10,
                fontWeight: 600,
              }}>
                {current.category}
              </span>
              <span>▲ {current.upvotes}</span>
            </div>
            <h3 style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 22,
              lineHeight: 1.2,
              fontWeight: 500,
              color: '#1A1611',
              margin: 0,
              marginBottom: 14,
              letterSpacing: '-0.01em',
            }}>
              {current.headline}
            </h3>
            <div style={{ height: 80, marginBottom: 14 }}>
              <FakeFigure type={current.figure} />
            </div>
            <p style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 13,
              lineHeight: 1.55,
              color: '#3A342B',
              margin: 0,
            }}>
              {current.tldr}
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          onClick={() => handleDecision(false)}
          style={{
            flex: 1,
            padding: '16px',
            background: 'transparent',
            border: '1px solid #D8D0BE',
            color: '#1A1611',
            borderRadius: 4,
            fontFamily: "'Geist', sans-serif",
            fontSize: 14,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <X size={16} /> {tca.notMyThing}
        </button>
        <button
          onClick={() => handleDecision(true)}
          style={{
            flex: 1,
            padding: '16px',
            background: '#1A1611',
            color: '#FAF7F2',
            border: 'none',
            borderRadius: 4,
            fontFamily: "'Geist', sans-serif",
            fontSize: 14,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Heart size={16} /> {tca.loveIt}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Shared helpers
// =============================================================================
function ProgressHeader({ step, onBack }) {
  const progress = (step / 3) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, color: '#1A1611' }}>
        <ChevronLeft size={20} />
      </button>
      <div style={{ flex: 1, height: 2, background: '#E8E2D5', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#1A1611', transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "'Geist', sans-serif", color: '#6B6358', letterSpacing: '0.1em' }}>
        {step}/3
      </span>
    </div>
  );
}

function NextButton({ label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '18px',
        background: disabled ? '#D8D0BE' : '#1A1611',
        color: '#FAF7F2',
        border: 'none',
        borderRadius: 0,
        fontSize: 15,
        fontWeight: 500,
        fontFamily: "'Geist', sans-serif",
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {label} <ChevronRight size={18} />
    </button>
  );
}

const titleStyle = {
  fontFamily: "'Fraunces', serif",
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 400,
  color: '#1A1611',
  margin: 0,
  letterSpacing: '-0.01em',
};

const subtitleStyle = {
  fontFamily: "'Geist', sans-serif",
  fontSize: 13,
  color: '#6B6358',
  marginTop: 10,
  marginBottom: 24,
  lineHeight: 1.5,
};
