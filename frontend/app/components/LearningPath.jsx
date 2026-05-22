'use client';

import { useState } from 'react';
import { ArrowUpRight, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = 'http://localhost:8000/api';

const DEFAULT_LP_LIMITS = { papersPerEra: 10, models: 5, repos: 5 };

function readLpLimits() {
  try {
    const stored = localStorage.getItem('learning_path_limits');
    return stored ? { ...DEFAULT_LP_LIMITS, ...JSON.parse(stored) } : DEFAULT_LP_LIMITS;
  } catch { return DEFAULT_LP_LIMITS; }
}

const TYPE_COLORS = {
  paper: { bg: '#FFE8E0', fg: '#8B2E1B' },
  model: { bg: '#E0EEFF', fg: '#1B3E8B' },
  repo:  { bg: '#E0F5E0', fg: '#1B7A2E' },
};

const ANALYSIS_COLORS = {
  problem:      '#C84B31',
  solution:     '#1B7A2E',
  significance: '#1B3E8B',
  limitations:  '#7A5C1B',
};

// =============================================================================
// Paper / Model / Repo card
// =============================================================================
function EraCard({ item, type, lang, tl }) {
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
      ? new Date(item.published_date).toLocaleDateString(
          lang === 'ko' ? 'ko-KR' : 'en-US',
          { month: 'short', year: 'numeric' }
        )
      : '';
    meta = [authors, d].filter(Boolean).join(' · ');
  } else if (type === 'model') {
    const dl = item.downloads ? `↓ ${(item.downloads / 1000).toFixed(0)}K` : '';
    meta = [item.pipeline_tag, dl].filter(Boolean).join(' · ');
  } else {
    const stars = item.stars ? `★ ${item.stars}` : '';
    meta = [item.language, stars].filter(Boolean).join(' · ');
  }

  const analysisFields = [
    { key: 'problem',      label: tl.problem },
    { key: 'solution',     label: tl.solution },
    { key: 'significance', label: tl.significance },
    { key: 'limitations',  label: tl.limitations },
  ];
  const hasAnalysis = type === 'paper' && analysisFields.some(f => item[f.key]);

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
          background: colors.bg, color: colors.fg,
          padding: '2px 7px', borderRadius: 2,
          fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
          fontFamily: "'Geist', sans-serif",
        }}>
          {typeLabel}
        </span>
        <ArrowUpRight size={13} style={{ color: '#6B6358' }} />
      </div>
      <div style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 15, fontWeight: 500,
        color: '#1A1611', lineHeight: 1.3,
        marginBottom: meta ? 6 : 0,
      }}>
        {title}
      </div>
      {meta && (
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358' }}>
          {meta}
        </span>
      )}

      {hasAnalysis && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid #F0EAD9',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {analysisFields.map(({ key, label }) =>
            item[key] ? (
              <div key={key}>
                <span style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 9, fontWeight: 700,
                  color: ANALYSIS_COLORS[key],
                  letterSpacing: '0.1em',
                }}>
                  {label}
                </span>
                <p style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12, color: '#3A342B',
                  margin: '3px 0 0', lineHeight: 1.55,
                }}>
                  {item[key]}
                </p>
              </div>
            ) : null
          )}
        </div>
      )}
    </a>
  );
}

function SectionLabel({ text }) {
  return (
    <div style={{
      fontFamily: "'Geist', sans-serif",
      fontSize: 10, color: '#6B6358',
      letterSpacing: '0.15em', marginBottom: 10,
    }}>
      {text}
    </div>
  );
}

function InlineNotice({ text, isError }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 12px',
      background: isError ? '#FFF0ED' : '#FAF7F2',
      border: `1px solid ${isError ? '#F5C9BE' : '#E8E2D5'}`,
      borderRadius: 4, marginBottom: 12,
    }}>
      {isError && <AlertCircle size={13} style={{ color: '#C84B31', flexShrink: 0 }} />}
      <span style={{
        fontFamily: "'Geist', sans-serif", fontSize: 11,
        color: isError ? '#8B2E1B' : '#6B6358', lineHeight: 1.4,
      }}>
        {text}
      </span>
    </div>
  );
}

// =============================================================================
// Real-time progress display during build
// =============================================================================
function BuildProgress({ progress, tl }) {
  const { papersTotal, papersSource, modelsCount, modelsError, reposCount, reposError, eras, currentEra } = progress;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 0' }}>
      <div style={{
        fontFamily: "'Fraunces', serif", fontSize: 20,
        color: '#1A1611', fontStyle: 'italic', textAlign: 'center', marginBottom: 28,
      }}>
        {tl.building}
      </div>

      {/* Source badges */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
        {[
          {
            label: papersTotal !== null ? tl.papersFound(papersTotal, papersSource) : (papersSource || 'Semantic Scholar'),
            done: papersTotal !== null, error: false,
          },
          {
            label: modelsError ? tl.modelsError : modelsCount !== null ? tl.modelsFound(modelsCount) : 'Hugging Face',
            done: modelsCount !== null, error: modelsError,
          },
          {
            label: reposError ? tl.reposError : reposCount !== null ? tl.reposFound(reposCount) : 'GitHub',
            done: reposCount !== null, error: reposError,
          },
        ].map((src, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: `2px solid ${src.error ? '#C84B31' : src.done ? '#1B7A2E' : '#D8D0BE'}`,
              background: src.error ? '#FDF0EE' : src.done ? '#EEF7EE' : '#FAF7F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>
              {src.error
                ? <span style={{ color: '#C84B31' }}>✕</span>
                : src.done
                ? <span style={{ color: '#1B7A2E' }}>✓</span>
                : <span style={{ color: '#C8C0B0', fontSize: 20 }}>·</span>}
            </div>
            <span style={{
              fontFamily: "'Geist', sans-serif", fontSize: 10,
              color: '#6B6358', textAlign: 'center', maxWidth: 120,
            }}>
              {src.label}
            </span>
          </div>
        ))}
      </div>

      {/* Era list */}
      {eras.length > 0 && (
        <div style={{
          width: '100%', maxWidth: 320,
          background: '#FFFFFF', border: '1px solid #E8E2D5',
          borderRadius: 4, padding: '12px 14px',
        }}>
          {eras.map(era => (
            <div key={era.label} style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 0',
              borderBottom: '1px solid #F5F0E8',
              fontFamily: "'Geist', sans-serif", fontSize: 12,
            }}>
              <span style={{ color: '#1A1611' }}>
                {tl.eraFound(era.label, era.count)}
              </span>
              <span style={{
                color: era.status === 'done' ? '#1B7A2E'
                  : era.status === 'analyzing' ? '#C84B31'
                  : '#C8C0B0',
                fontSize: 11, fontWeight: era.status === 'analyzing' ? 600 : 400,
              }}>
                {era.status === 'done' ? tl.eraAnalyzed
                  : era.status === 'analyzing' ? tl.analyzingEra(era.label)
                  : tl.eraPending}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LearningPath main
// =============================================================================
const INIT_PROGRESS = {
  papersTotal: null,
  papersSource: 'Semantic Scholar',
  modelsCount: null,
  modelsError: false,
  reposCount: null,
  reposError: false,
  eras: [],
  currentEra: null,
};

export default function LearningPath({ userId, onBack }) {
  const { t, lang } = useLanguage();
  const tl = t.learningPath;

  const [topic, setTopic] = useState('');
  const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [result, setResult] = useState(null);
  const [activeEra, setActiveEra] = useState(0);
  const [progress, setProgress] = useState(INIT_PROGRESS);
  // currentEra used only for SSE tracking, not rendered directly

  const build = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setState('loading');
    setProgress(INIT_PROGRESS);

    try {
      const lpLimits = readLpLimits();
      const res = await fetch(`${API}/learning-path/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: trimmed, user_id: userId || 1, lang,
          papers_per_era: lpLimits.papersPerEra,
          models_count: lpLimits.models,
          repos_count: lpLimits.repos,
        }),
      });
      if (!res.ok) throw new Error('API error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === 'done') {
            setResult(event.result);
            setActiveEra(0);
            setState('done');
            return;
          } else if (event.type === 'error') {
            setState('error');
            return;
          } else if (event.type === 'papers_done') {
            setProgress(p => ({
              ...p,
              papersTotal: event.total,
              papersSource: event.source || 'Semantic Scholar',
            }));
          } else if (event.type === 'era_found') {
            setProgress(p => ({
              ...p,
              eras: [...p.eras, { label: event.label, count: event.count, status: 'pending' }],
            }));
          } else if (event.type === 'models_done') {
            setProgress(p => ({ ...p, modelsCount: event.count }));
          } else if (event.type === 'models_error') {
            setProgress(p => ({ ...p, modelsError: true }));
          } else if (event.type === 'repos_done') {
            setProgress(p => ({ ...p, reposCount: event.count }));
          } else if (event.type === 'repos_error') {
            setProgress(p => ({ ...p, reposError: true }));
          } else if (event.type === 'analyzing_era') {
            setProgress(p => ({
              ...p,
              currentEra: event.label,
              eras: p.eras.map(e => e.label === event.label ? { ...e, status: 'analyzing' } : e),
            }));
          } else if (event.type === 'era_analyzed') {
            setProgress(p => ({
              ...p,
              eras: p.eras.map(e => e.label === event.label ? { ...e, status: 'done' } : e),
            }));
          }
        }
      }
    } catch {
      setState('error');
    }
  };

  const era = result?.eras?.[activeEra];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF7F2' }}>

      {/* Header */}
      <div style={{
        padding: '52px 24px 16px', background: '#FAF7F2',
        borderBottom: '1px solid #E8E2D5',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: "'Geist', sans-serif", fontSize: 10,
            color: '#6B6358', letterSpacing: '0.15em', marginBottom: 2,
          }}>
            {tl.label}
          </div>
          <div style={{
            fontFamily: "'Fraunces', serif", fontSize: 28,
            fontWeight: 500, color: '#1A1611', letterSpacing: '-0.02em',
          }}>
            Learning<span style={{ color: '#C84B31', fontStyle: 'italic' }}>.</span>
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: '1px solid #D8D0BE',
            padding: '7px 14px', borderRadius: 4,
            fontFamily: "'Geist', sans-serif", fontSize: 12,
            color: '#6B6358', cursor: 'pointer',
          }}
        >
          ← {tl.backBtn}
        </button>
      </div>

      {/* Topic input */}
      {(state === 'idle' || state === 'error') && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && build()}
              placeholder={tl.placeholder}
              style={{
                flex: 1, padding: '10px 12px',
                border: '1px solid #D8D0BE', borderRadius: 4,
                fontFamily: "'Geist', sans-serif", fontSize: 13,
                color: '#1A1611', background: '#FFFFFF', outline: 'none',
              }}
            />
            <button
              onClick={build}
              disabled={!topic.trim()}
              style={{
                padding: '0 18px',
                background: topic.trim() ? '#1A1611' : '#D8D0BE',
                color: '#FAF7F2', border: 'none', borderRadius: 4,
                fontFamily: "'Geist', sans-serif", fontSize: 13,
                fontWeight: 500, cursor: topic.trim() ? 'pointer' : 'default',
                whiteSpace: 'nowrap', transition: 'background 0.15s',
              }}
            >
              {tl.buildBtn}
            </button>
          </div>
          {state === 'error' && (
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#C84B31', margin: '10px 0 0' }}>
              {tl.error}
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {state === 'loading' && <BuildProgress progress={progress} tl={tl} />}

      {/* Results */}
      {state === 'done' && result && (
        <>
          {/* Topic overview */}
          {result.description && (
            <div style={{
              margin: '14px 16px 0', padding: '14px 16px',
              background: '#FFFFFF', borderLeft: '3px solid #C84B31',
              borderRadius: '0 4px 4px 0',
            }}>
              <div style={{
                fontFamily: "'Geist', sans-serif", fontSize: 10,
                color: '#6B6358', letterSpacing: '0.15em', marginBottom: 6,
              }}>
                OVERVIEW
              </div>
              <p style={{
                fontFamily: "'Geist', sans-serif", fontSize: 13,
                color: '#1A1611', lineHeight: 1.6, margin: 0,
              }}>
                {result.description}
              </p>
            </div>
          )}

          {/* Era tab strip */}
          <div style={{
            display: 'flex', gap: 6,
            padding: '14px 16px 0', overflowX: 'auto',
            flexShrink: 0, paddingBottom: 2,
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
                  fontFamily: "'Geist', sans-serif", fontSize: 12,
                  fontWeight: activeEra === i ? 600 : 400,
                  whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {e.label}
              </button>
            ))}
          </div>

          {/* Active era */}
          {era && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 80px' }}>
              {/* AI status */}
              {era.ai_status === 'no_key' ? (
                <InlineNotice text={tl.noApiKey} isError={false} />
              ) : era.ai_status === 'error' ? (
                <InlineNotice text={tl.aiError} isError={true} />
              ) : era.summary ? (
                <p style={{
                  fontFamily: "'Geist', sans-serif", fontSize: 13,
                  color: '#3A342B', lineHeight: 1.6, margin: '0 0 16px',
                }}>
                  {era.summary}
                </p>
              ) : null}

              {/* Papers */}
              {era.papers?.length > 0 && (
                <>
                  <SectionLabel text={tl.papers} />
                  {era.papers.map((p, i) => (
                    <EraCard key={i} item={p} type="paper" lang={lang} tl={tl} />
                  ))}
                </>
              )}

              {/* Models */}
              <div style={{ marginTop: era.papers?.length ? 16 : 0 }}>
                <SectionLabel text={tl.models} />
                {result.models_error ? (
                  <InlineNotice text={tl.modelsError} isError={true} />
                ) : era.models?.length > 0 ? (
                  era.models.map((m, i) => (
                    <EraCard key={i} item={m} type="model" lang={lang} tl={tl} />
                  ))
                ) : (
                  <InlineNotice text={tl.noContent} isError={false} />
                )}
              </div>

              {/* Repos */}
              <div style={{ marginTop: 16 }}>
                <SectionLabel text={tl.repos} />
                {result.repos_error ? (
                  <InlineNotice text={tl.reposError} isError={true} />
                ) : era.repos?.length > 0 ? (
                  era.repos.map((r, i) => (
                    <EraCard key={i} item={r} type="repo" lang={lang} tl={tl} />
                  ))
                ) : (
                  <InlineNotice text={tl.noContent} isError={false} />
                )}
              </div>

              <button
                onClick={() => { setState('idle'); setResult(null); setTopic(''); setProgress(INIT_PROGRESS); }}
                style={{
                  marginTop: 24, background: 'none',
                  border: '1px solid #D8D0BE', padding: '8px 16px',
                  borderRadius: 4, fontFamily: "'Geist', sans-serif",
                  fontSize: 12, color: '#6B6358', cursor: 'pointer', width: '100%',
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
