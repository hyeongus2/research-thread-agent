'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = 'http://localhost:8000/api';

const TYPE_COLORS = {
  paper: { bg: '#FFE8E0', fg: '#8B2E1B' },
  model: { bg: '#E0EEFF', fg: '#1B3E8B' },
  repo:  { bg: '#E0F5E0', fg: '#1B7A2E' },
};

// =============================================================================
// Single result card (paper / model / repo)
// =============================================================================
function EraCard({ item, type, lang }) {
  const colors = TYPE_COLORS[type];
  const typeLabel = { paper: 'PAPER', model: 'MODEL', repo: 'REPO' }[type];
  const title = item.title || item.name || '';
  const url = item.url || '#';

  let meta = '';
  if (type === 'paper') {
    const authors = Array.isArray(item.authors)
      ? item.authors.slice(0, 2).join(', ')
      : item.authors || '';
    const d = item.published_date
      ? new Date(item.published_date).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
          month: 'short',
          year: 'numeric',
        })
      : '';
    meta = [authors, d].filter(Boolean).join(' · ');
  } else if (type === 'model') {
    const dl = item.downloads ? `↓ ${(item.downloads / 1000).toFixed(0)}K` : '';
    meta = [item.pipeline_tag, dl].filter(Boolean).join(' · ');
  } else {
    const stars = item.stars ? `★ ${item.stars}` : '';
    meta = [item.language, stars].filter(Boolean).join(' · ');
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'block',
        background: '#FFFFFF',
        border: '1px solid #E8E2D5',
        marginBottom: 12,
        padding: '14px 16px',
        borderRadius: 4,
        textDecoration: 'none',
        color: '#1A1611',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          background: colors.bg,
          color: colors.fg,
          padding: '2px 7px',
          borderRadius: 2,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          fontFamily: "'Geist', sans-serif",
        }}>
          {typeLabel}
        </span>
        <ArrowUpRight size={13} style={{ color: '#6B6358' }} />
      </div>
      <div style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 15,
        fontWeight: 500,
        color: '#1A1611',
        lineHeight: 1.3,
        marginBottom: meta ? 8 : 0,
      }}>
        {title}
      </div>
      {meta && (
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358' }}>
          {meta}
        </span>
      )}
    </a>
  );
}

function SectionLabel({ text }) {
  return (
    <div style={{
      fontFamily: "'Geist', sans-serif",
      fontSize: 10,
      color: '#6B6358',
      letterSpacing: '0.15em',
      marginBottom: 10,
    }}>
      {text}
    </div>
  );
}

// =============================================================================
// LearningPath main
// =============================================================================
export default function LearningPath({ userId, onBack }) {
  const { t, lang } = useLanguage();
  const tl = t.learningPath;

  const [topic, setTopic] = useState('');
  const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [result, setResult] = useState(null);
  const [activeEra, setActiveEra] = useState(0);

  const build = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setState('loading');
    try {
      const res = await fetch(`${API}/learning-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmed, user_id: userId || 1 }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setResult(data);
      setActiveEra(0);
      setState('done');
    } catch {
      setState('error');
    }
  };

  const era = result?.eras?.[activeEra];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF7F2' }}>

      {/* Header */}
      <div style={{
        padding: '52px 24px 16px',
        background: '#FAF7F2',
        borderBottom: '1px solid #E8E2D5',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 10,
            color: '#6B6358',
            letterSpacing: '0.15em',
            marginBottom: 2,
          }}>
            {tl.label}
          </div>
          <div style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 28,
            fontWeight: 500,
            color: '#1A1611',
            letterSpacing: '-0.02em',
          }}>
            Learning<span style={{ color: '#C84B31', fontStyle: 'italic' }}>.</span>
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid #D8D0BE',
            padding: '7px 14px',
            borderRadius: 4,
            fontFamily: "'Geist', sans-serif",
            fontSize: 12,
            color: '#6B6358',
            cursor: 'pointer',
          }}
        >
          ← {tl.backBtn}
        </button>
      </div>

      {/* Topic input — shown in idle and error states */}
      {(state === 'idle' || state === 'error') && (
        <div style={{ padding: '20px 16px 0', background: '#FAF7F2' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && build()}
              placeholder={tl.placeholder}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #D8D0BE',
                borderRadius: 4,
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                color: '#1A1611',
                background: '#FFFFFF',
                outline: 'none',
              }}
            />
            <button
              onClick={build}
              disabled={!topic.trim()}
              style={{
                padding: '0 18px',
                background: topic.trim() ? '#1A1611' : '#D8D0BE',
                color: '#FAF7F2',
                border: 'none',
                borderRadius: 4,
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                cursor: topic.trim() ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
            >
              {tl.buildBtn}
            </button>
          </div>
          {state === 'error' && (
            <p style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              color: '#C84B31',
              margin: '10px 0 0',
            }}>
              {tl.error}
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}>
          <div style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 20,
            color: '#1A1611',
            fontStyle: 'italic',
            textAlign: 'center',
            marginBottom: 16,
          }}>
            {tl.building}
          </div>
          <p style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 12,
            color: '#6B6358',
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 1.6,
            margin: 0,
          }}>
            {tl.buildHint}
          </p>
        </div>
      )}

      {/* Results */}
      {state === 'done' && result && (
        <>
          {/* Topic description */}
          {result.description && (
            <div style={{
              margin: '14px 16px 0',
              padding: '14px 16px',
              background: '#FFFFFF',
              borderLeft: '3px solid #C84B31',
              borderRadius: '0 4px 4px 0',
            }}>
              <div style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 10,
                color: '#6B6358',
                letterSpacing: '0.15em',
                marginBottom: 6,
              }}>
                OVERVIEW
              </div>
              <p style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                color: '#1A1611',
                lineHeight: 1.6,
                margin: 0,
              }}>
                {result.description}
              </p>
            </div>
          )}

          {/* Era tab strip */}
          <div style={{
            display: 'flex',
            gap: 6,
            padding: '14px 16px 0',
            overflowX: 'auto',
            flexShrink: 0,
            paddingBottom: 2,
          }}>
            {result.eras.map((e, i) => (
              <button
                key={e.label}
                onClick={() => setActiveEra(i)}
                style={{
                  padding: '6px 14px',
                  background: activeEra === i ? '#1A1611' : 'transparent',
                  color: activeEra === i ? '#FAF7F2' : '#6B6358',
                  border: '1px solid ' + (activeEra === i ? '#1A1611' : '#D8D0BE'),
                  borderRadius: 20,
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  fontWeight: activeEra === i ? 600 : 400,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {e.label}
              </button>
            ))}
          </div>

          {/* Active era content */}
          {era && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 80px' }}>
              {/* Era summary */}
              {era.summary ? (
                <p style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  color: '#3A342B',
                  lineHeight: 1.6,
                  margin: '0 0 16px',
                }}>
                  {era.summary}
                </p>
              ) : (
                <p style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  color: '#6B6358',
                  fontStyle: 'italic',
                  margin: '0 0 16px',
                }}>
                  {tl.noApiKey}
                </p>
              )}

              {/* Papers */}
              {era.papers?.length > 0 && (
                <>
                  <SectionLabel text={tl.papers} />
                  {era.papers.map((p, i) => (
                    <EraCard key={i} item={p} type="paper" lang={lang} />
                  ))}
                </>
              )}

              {/* Models */}
              {era.models?.length > 0 && (
                <div style={{ marginTop: era.papers?.length ? 16 : 0 }}>
                  <SectionLabel text={tl.models} />
                  {era.models.map((m, i) => (
                    <EraCard key={i} item={m} type="model" lang={lang} />
                  ))}
                </div>
              )}

              {/* Repos */}
              {era.repos?.length > 0 && (
                <div style={{ marginTop: (era.papers?.length || era.models?.length) ? 16 : 0 }}>
                  <SectionLabel text={tl.repos} />
                  {era.repos.map((r, i) => (
                    <EraCard key={i} item={r} type="repo" lang={lang} />
                  ))}
                </div>
              )}

              {!era.papers?.length && !era.models?.length && !era.repos?.length && (
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358' }}>
                  {tl.noContent}
                </p>
              )}

              {/* Search again */}
              <button
                onClick={() => { setState('idle'); setResult(null); setTopic(''); }}
                style={{
                  marginTop: 24,
                  background: 'none',
                  border: '1px solid #D8D0BE',
                  padding: '8px 16px',
                  borderRadius: 4,
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  color: '#6B6358',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                ← {tl.searchAgain}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
