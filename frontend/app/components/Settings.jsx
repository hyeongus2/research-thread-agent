'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = 'http://localhost:8000/api';

export default function Settings({ onClose, userId }) {
  const { t, lang, setLang } = useLanguage();
  const ts = t.settings;

  const [digestOn, setDigestOn] = useState(true);
  const [breakthroughOn, setBreakthroughOn] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleReset = async () => {
    try {
      await fetch(`${API}/admin/reset-db`, { method: 'POST' });
    } catch {
      // best-effort; backend may not expose this in all environments
    }
    localStorage.removeItem('user_id');
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
            onToggle={() => setDigestOn(v => !v)}
          />
          <SettingRow
            title={ts.breakthroughAlerts}
            description={ts.breakthroughDesc}
            on={breakthroughOn}
            onToggle={() => setBreakthroughOn(v => !v)}
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

        {/* Data management */}
        <div style={sectionLabel}>{ts.data}</div>
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
