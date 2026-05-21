'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Bell, ArrowUpRight, Search, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = 'http://localhost:8000/api';

const TYPE_COLORS = {
  paper: { bg: '#FFE8E0', fg: '#8B2E1B' },
  model: { bg: '#E0EEFF', fg: '#1B3E8B' },
  repo:  { bg: '#E0F5E0', fg: '#1B7A2E' },
};

function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastDayOfMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).toISOString().split('T')[0];
}

function getPeriodDates(period, nMonths, customFrom, customTo) {
  if (period === 'all') return { start: null, end: null };
  if (period === 'custom') {
    return {
      start: customFrom ? `${customFrom}-01` : null,
      end: customTo ? lastDayOfMonth(customTo) : null,
    };
  }
  const end = new Date();
  const start = new Date();
  if (period === 'week')            start.setDate(start.getDate() - 7);
  else if (period === 'month')      start.setDate(start.getDate() - 30);
  else if (period === 'threeMonths') start.setDate(start.getDate() - 90);
  else if (period === 'lastNMonths') start.setMonth(start.getMonth() - nMonths);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// =============================================================================
// Search result card (real API data)
// =============================================================================
function ResultCard({ item, type, hasAi }) {
  const { t, lang } = useLanguage();
  const ts = t.search;
  const colors = TYPE_COLORS[type];
  const typeLabel = { paper: 'PAPER', model: 'MODEL', repo: 'REPO' }[type];
  const relevance = Math.round((item.relevance_score || 0) * 100);

  const title = item.title || item.name || '';
  // item.summary === null means API key not set; '' means Claude failed; string means real summary
  const aiSummary = item.summary;
  const fallbackText = item.abstract?.slice(0, 200) || item.description || '';
  const url = item.url || item.pdf_url || '#';

  let meta = '';
  if (type === 'paper') {
    const authors = Array.isArray(item.authors)
      ? item.authors.slice(0, 2).join(', ')
      : item.authors || '';
    const d = item.published_date
      ? new Date(item.published_date).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', year: 'numeric' })
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
        marginBottom: 14,
        padding: '18px 20px',
        borderRadius: 4,
        textDecoration: 'none',
        color: '#1A1611',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: colors.bg,
            color: colors.fg,
            padding: '3px 8px',
            borderRadius: 2,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.05em',
            fontFamily: "'Geist', sans-serif",
          }}>
            {typeLabel}
          </span>
          <span style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 11,
            color: relevance >= 80 ? '#1B7A2E' : '#6B6358',
            fontWeight: 500,
          }}>
            {relevance}% {ts.relevance}
          </span>
        </div>
        <ArrowUpRight size={14} style={{ color: '#6B6358', flexShrink: 0 }} />
      </div>

      <h3 style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 18,
        lineHeight: 1.2,
        fontWeight: 500,
        color: '#1A1611',
        margin: 0,
        marginBottom: 10,
      }}>
        {title}
      </h3>

      {/* AI summary or fallback.
          summary===null means Claude not available (no key OR invalid key);
          summary===string means real AI output. */}
      {typeof aiSummary === 'string' && aiSummary ? (
        <p style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
          lineHeight: 1.5,
          color: '#3A342B',
          margin: 0,
          marginBottom: meta ? 10 : 0,
        }}>
          {aiSummary}
        </p>
      ) : aiSummary === null ? (
        <p style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 12,
          lineHeight: 1.5,
          color: '#6B6358',
          margin: 0,
          marginBottom: meta ? 10 : 0,
          fontStyle: 'italic',
        }}>
          {ts.noApiKey}
        </p>
      ) : fallbackText ? (
        <p style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
          lineHeight: 1.5,
          color: '#3A342B',
          margin: 0,
          marginBottom: meta ? 10 : 0,
        }}>
          {fallbackText}
        </p>
      ) : null}

      {meta && (
        <span style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 11,
          color: '#6B6358',
        }}>
          {meta}
        </span>
      )}
    </a>
  );
}

// Error kind → human label
const ERROR_LABELS = {
  en: {
    rate_limit: (min) => min > 0 ? `Rate limited — retry in ${min}m` : 'Rate limited',
    auth_error: () => 'Invalid token — check .env',
    timeout:    () => 'Timed out',
    error:      () => 'Failed',
  },
  ko: {
    rate_limit: (min) => min > 0 ? `횟수 초과 — ${min}분 후 재시도` : '횟수 초과',
    auth_error: () => '토큰 오류 — .env 확인',
    timeout:    () => '시간 초과',
    error:      () => '오류',
  },
};

// =============================================================================
// Source error banner — shown below "Back to feed" after search completes
// =============================================================================
function SourceErrorBanner({ sourceErrors, lang }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasCountdown = Object.values(sourceErrors).some(e => e.kind === 'rate_limit' && e.retryAt);
    if (!hasCountdown) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [sourceErrors]);

  const labels = ERROR_LABELS[lang] || ERROR_LABELS.en;
  const entries = Object.entries(sourceErrors);
  if (entries.length === 0) return null;

  return (
    <div style={{
      margin: '4px 0 8px',
      padding: '10px 14px',
      background: '#FFF8F5',
      border: '1px solid #F0C8B8',
      borderRadius: 4,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 16px',
    }}>
      {entries.map(([src, info]) => {
        const srcLabel = { papers: 'arXiv', models: 'Hugging Face', repos: 'GitHub' }[src] || src;
        const minLeft = info.retryAt ? Math.max(0, Math.ceil((info.retryAt - Date.now()) / 60000)) : 0;
        const msgFn = labels[info.kind] || labels.error;
        return (
          <span key={src} style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 11,
            color: '#8B3A1B',
          }}>
            <span style={{ fontWeight: 600 }}>{srcLabel}</span>
            {' · '}
            {msgFn(minLeft)}
          </span>
        );
      })}
    </div>
  );
}

// Stage code → translated message
const STAGE_MESSAGES = {
  en: {
    fetching_sources: 'Searching arXiv · Hugging Face · GitHub simultaneously…',
    scoring:          'Running AI relevance scoring…',
    overview:         'Generating topic overview…',
    saving:           'Finishing up…',
  },
  ko: {
    fetching_sources: 'arXiv · Hugging Face · GitHub 동시 검색 중…',
    scoring:          'AI 관련도 분석 중…',
    overview:         '주제 개요 생성 중…',
    saving:           '마무리 중…',
  },
};

const STAGE_ORDER = ['fetching_sources', 'scoring', 'overview', 'saving'];

const SOURCE_META = [
  { key: 'papers', label: 'arXiv' },
  { key: 'models', label: 'Hugging Face' },
  { key: 'repos',  label: 'GitHub' },
];

// =============================================================================
// Loading progress indicator (driven by real SSE events)
// =============================================================================
function SearchProgress({ lang, currentStage, elapsed, sourceStatus }) {
  const msgs = STAGE_MESSAGES[lang] || STAGE_MESSAGES.en;
  const activeIdx = Math.max(0, STAGE_ORDER.indexOf(currentStage));

  return (
    <div style={{ padding: '40px 8px 0' }}>
      <div style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 20,
        color: '#1A1611',
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: 24,
      }}>
        {lang === 'ko' ? '검색 중…' : 'Searching…'}
      </div>

      {/* Per-source completion badges */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 28 }}>
        {SOURCE_META.map(({ key, label }) => {
          const raw = sourceStatus[key];           // undefined=pending, -1=failed, N=count
          const isPending = raw === undefined;
          const isFailed  = raw === -1;
          const isDone    = !isPending && !isFailed;
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                border: `2px solid ${isPending ? '#D8D0BE' : isFailed ? '#C84B31' : '#1B7A2E'}`,
                background: isPending ? '#FAF7F2' : isFailed ? '#FDF0EE' : '#EEF7EE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, transition: 'all 0.35s',
              }}>
                {isPending
                  ? <span style={{ color: '#C8C0B0', fontSize: 18, lineHeight: 1 }}>·</span>
                  : isFailed
                  ? <span style={{ color: '#C84B31' }}>✕</span>
                  : <span style={{ color: '#1B7A2E' }}>✓</span>}
              </div>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358' }}>{label}</span>
              {isDone && (
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: '#9B9185' }}>
                  {raw > 0 ? raw : '0'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340, margin: '0 auto' }}>
        {STAGE_ORDER.map((stage, i) => {
          const isDone    = i < activeIdx;
          const isCurrent = i === activeIdx;
          return (
            <div key={stage} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              opacity: i > activeIdx ? 0.3 : 1,
              transition: 'opacity 0.4s',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: isDone ? '#1B7A2E' : isCurrent ? '#1A1611' : '#D8D0BE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#FAF7F2', fontWeight: 700,
                transition: 'background 0.4s',
              }}>
                {isDone ? '✓' : i + 1}
              </div>
              <span style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                color: isCurrent ? '#1A1611' : isDone ? '#3A342B' : '#6B6358',
                lineHeight: 1.5,
                fontWeight: isCurrent ? 500 : 400,
              }}>
                {msgs[stage]}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        textAlign: 'center',
        fontFamily: "'Geist Mono', monospace",
        fontSize: 11,
        color: '#6B6358',
        marginTop: 24,
      }}>
        {elapsed}s
      </div>
    </div>
  );
}

// =============================================================================
// Empty state — shown before any search
// =============================================================================
function EmptyFeed({ onSuggestionClick }) {
  const { t } = useLanguage();
  const tf = t.feed;
  const suggestions = ['reasoning', 'multimodal agent', 'LoRA', 'RAG', 'MoE', 'RLHF'];

  return (
    <div style={{ padding: '48px 8px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 20 }}>🔍</div>
      <h3 style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 22,
        fontWeight: 500,
        fontStyle: 'italic',
        color: '#1A1611',
        margin: '0 0 12px',
      }}>
        {tf.emptyTitle}
      </h3>
      <p style={{
        fontFamily: "'Geist', sans-serif",
        fontSize: 13,
        lineHeight: 1.6,
        color: '#6B6358',
        margin: '0 0 28px',
        maxWidth: 280,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        {tf.emptyDesc}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {suggestions.map(kw => (
          <button
            key={kw}
            onClick={() => onSuggestionClick(kw)}
            style={{
              padding: '7px 14px',
              background: '#FFFFFF',
              border: '1px solid #D8D0BE',
              borderRadius: 20,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              color: '#3A342B',
              cursor: 'pointer',
            }}
          >
            {kw}
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Feed main
// =============================================================================
export default function Feed({ onSettings, onPaperTap, saved, onToggleSave, userId }) {
  const { t, lang } = useLanguage();
  const tf = t.feed;
  const ts = t.search;

  const today = new Date();
  const dateLabel = today.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });

  // Search state
  const [query, setQuery] = useState('');
  const [keywords, setKeywords] = useState([]); // confirmed keyword chips
  const [period, setPeriod] = useState('month');
  const [nMonths, setNMonths] = useState(6);
  const [customFrom, setCustomFrom] = useState(() => toYearMonth(new Date(new Date().setMonth(new Date().getMonth() - 6))));
  const [customTo, setCustomTo] = useState(() => toYearMonth(new Date()));
  const [typeFilters, setTypeFilters] = useState(['paper', 'model', 'repo']);
  const [searchState, setSearchState] = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [searchResults, setSearchResults] = useState(null);
  const [currentStage, setCurrentStage] = useState('fetching_sources');
  const [elapsed, setElapsed] = useState(0);
  const [sourceStatus, setSourceStatus] = useState({});
  const [sourceErrors, setSourceErrors] = useState({});
  const elapsedRef = useRef(null);

  const toggleType = (type) =>
    setTypeFilters(prev =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter(t => t !== type) : prev) : [...prev, type]
    );

  // Add current input as a keyword chip
  const commitKeyword = () => {
    const kw = query.trim().replace(/,$/, '');
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (query.trim()) commitKeyword();
      else runSearch(keywords);
    } else if (e.key === ',') {
      e.preventDefault();
      commitKeyword();
    } else if (e.key === 'Backspace' && !query && keywords.length > 0) {
      setKeywords(prev => prev.slice(0, -1));
    }
  };

  const runSearch = async (kws, singleKw) => {
    const allKws = singleKw ? [singleKw] : [...kws, ...(query.trim() ? [query.trim()] : [])];
    if (allKws.length === 0) return;
    const combined = allKws.join(' OR ');

    setSearchState('loading');
    setCurrentStage('fetching_sources');
    setElapsed(0);
    setSourceStatus({});
    setSourceErrors({});
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    const startedAt = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    const { start, end } = getPeriodDates(period, nMonths, customFrom, customTo);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(`${API}/search/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: combined,
          start_date: start,
          end_date: end,
          info_types: ['paper', 'model', 'repo'], // always fetch all; filter client-side
          user_id: userId || 1,
        }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }
          if (event.stage === 'done') {
            clearTimeout(timeout);
            clearInterval(elapsedRef.current);
            setSearchResults(event.result);
            setSearchState('done');
            return;
          } else if (event.stage === 'error') {
            clearTimeout(timeout);
            clearInterval(elapsedRef.current);
            setSearchState('error');
            return;
          } else if (event.stage === 'source_done') {
            // msg format: "papers:8" (ok) or "papers:-1:rate_limit:600" (error)
            const parts = (event.msg || '').split(':');
            const src = parts[0];
            const count = parseInt(parts[1], 10);
            const errorKind = parts[2] || null;
            const retrySecs = parseInt(parts[3], 10) || 0;
            setSourceStatus(prev => ({ ...prev, [src]: isNaN(count) ? -1 : count }));
            if (errorKind && count === -1) {
              const retryAt = retrySecs > 0 ? Date.now() + retrySecs * 1000 : null;
              setSourceErrors(prev => ({ ...prev, [src]: { kind: errorKind, retryAt } }));
            }
          } else {
            setCurrentStage(event.stage);
          }
        }
      }
    } catch {
      clearTimeout(timeout);
      clearInterval(elapsedRef.current);
      setSearchState('error');
    }
  };

  const handleSearchClick = () => {
    if (query.trim()) commitKeyword();
    runSearch(keywords, query.trim() || undefined);
  };

  // Called from EmptyFeed suggestion chips
  const handleSuggestion = (kw) => {
    setKeywords([]);
    setQuery('');
    runSearch([], kw);
  };

  const handleClear = () => {
    setQuery('');
    setKeywords([]);
    setSearchState('idle');
    setSearchResults(null);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
  };

  // Merge, filter by active type toggles, and sort by relevance — recalculated on typeFilters change
  const allResults = searchState === 'done' && searchResults
    ? [
        ...(typeFilters.includes('paper') ? (searchResults.papers || []).map(p => ({ ...p, _type: 'paper' })) : []),
        ...(typeFilters.includes('model') ? (searchResults.models || []).map(m => ({ ...m, _type: 'model' })) : []),
        ...(typeFilters.includes('repo')  ? (searchResults.repos  || []).map(r => ({ ...r, _type: 'repo'  })) : []),
      ].sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
    : [];

  const inSearchMode = searchState !== 'idle';

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
            {tf.todayLabel} · {dateLabel}
          </div>
          <div style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 28,
            fontWeight: 500,
            color: '#1A1611',
            letterSpacing: '-0.02em',
          }}>
            Research<span style={{ color: '#C84B31', fontStyle: 'italic' }}>.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ background: 'none', border: 'none', padding: 8, color: '#1A1611' }}>
            <Bell size={18} />
          </button>
          <button onClick={onSettings} style={{ background: 'none', border: 'none', padding: 8, color: '#1A1611' }}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '14px 16px 0', background: '#FAF7F2' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
            background: '#FFFFFF',
            border: '1px solid #D8D0BE',
            borderRadius: 4,
            padding: '6px 10px',
            minHeight: 40,
          }}>
            <Search size={14} style={{ color: '#6B6358', flexShrink: 0 }} />
            {/* Keyword chips */}
            {keywords.map(kw => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#1A1611', color: '#FAF7F2',
                padding: '2px 8px', borderRadius: 12,
                fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 500,
              }}>
                {kw}
                <button
                  onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#FAF7F2', cursor: 'pointer', lineHeight: 0 }}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={keywords.length === 0 ? ts.placeholder : '+ add keyword...'}
              style={{
                flex: 1, minWidth: 80,
                border: 'none', outline: 'none', background: 'transparent',
                fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611',
                padding: '2px 0',
              }}
            />
            {(query || keywords.length > 0) && (
              <button onClick={handleClear} style={{ background: 'none', border: 'none', padding: 2, color: '#6B6358', lineHeight: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={handleSearchClick}
            disabled={(!query.trim() && keywords.length === 0) || searchState === 'loading'}
            style={{
              padding: '0 16px',
              background: (query.trim() || keywords.length > 0) ? '#1A1611' : '#D8D0BE',
              color: '#FAF7F2',
              border: 'none',
              borderRadius: 4,
              fontFamily: "'Geist', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: (query.trim() || keywords.length > 0) ? 'pointer' : 'default',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {ts.searchBtn}
          </button>
        </div>

        {/* Period pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {['week', 'month', 'threeMonths', 'lastNMonths', 'custom', 'all'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 10px',
                background: period === p ? '#1A1611' : 'transparent',
                color: period === p ? '#FAF7F2' : '#6B6358',
                border: '1px solid ' + (period === p ? '#1A1611' : '#D8D0BE'),
                borderRadius: 20,
                fontFamily: "'Geist', sans-serif",
                fontSize: 11,
                fontWeight: period === p ? 600 : 400,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {ts.periods[p]}
            </button>
          ))}
        </div>

        {/* Last N months sub-panel */}
        {period === 'lastNMonths' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>
              {ts.fromLabel.toLowerCase()}
            </span>
            <input
              type="number"
              min={1}
              max={60}
              value={nMonths}
              onChange={e => setNMonths(Math.max(1, Math.min(60, Number(e.target.value))))}
              style={{
                width: 56,
                padding: '5px 8px',
                border: '1px solid #D8D0BE',
                borderRadius: 4,
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                color: '#1A1611',
                background: '#FFFFFF',
                outline: 'none',
                textAlign: 'center',
              }}
            />
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>
              {ts.nMonthsLabel}
            </span>
          </div>
        )}

        {/* Custom range sub-panel */}
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>{ts.fromLabel}</span>
            <input
              type="month"
              value={customFrom}
              max={customTo}
              onChange={e => setCustomFrom(e.target.value)}
              style={monthInputStyle}
            />
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>–</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>{ts.toLabel}</span>
            <input
              type="month"
              value={customTo}
              min={customFrom}
              onChange={e => setCustomTo(e.target.value)}
              style={monthInputStyle}
            />
          </div>
        )}

        {/* Type toggles */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {['paper', 'model', 'repo'].map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              style={{
                padding: '5px 10px',
                background: typeFilters.includes(type) ? TYPE_COLORS[type].bg : 'transparent',
                color: typeFilters.includes(type) ? TYPE_COLORS[type].fg : '#6B6358',
                border: '1px solid ' + (typeFilters.includes(type) ? TYPE_COLORS[type].fg + '44' : '#D8D0BE'),
                borderRadius: 20,
                fontFamily: "'Geist', sans-serif",
                fontSize: 11,
                fontWeight: typeFilters.includes(type) ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {ts.types[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 80px', background: '#FAF7F2' }}>

        {/* ── Empty state (no search yet) ── */}
        {!inSearchMode && (
          <EmptyFeed onSuggestionClick={handleSuggestion} />
        )}

        {/* ── Loading ── */}
        {searchState === 'loading' && (
          <SearchProgress lang={lang} currentStage={currentStage} elapsed={elapsed} sourceStatus={sourceStatus} />
        )}

        {/* ── Search results ── */}
        {searchState === 'done' && (
          <>
            {/* Back to feed link */}
            <button
              onClick={handleClear}
              style={{
                background: 'none', border: 'none', padding: '8px 4px 4px',
                fontFamily: "'Geist', sans-serif", fontSize: 12,
                color: '#6B6358', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 4,
              }}
            >
              ← {ts.backToFeed}
            </button>

            {/* Source error banner */}
            <SourceErrorBanner sourceErrors={sourceErrors} lang={lang} />

            {/* Overview */}
            <div style={{
              margin: '4px 0 16px',
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
                {ts.overview}
              </div>
              {searchResults?.overview ? (
                <p style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  color: '#1A1611',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {searchResults.overview}
                </p>
              ) : (
                <p style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  color: '#6B6358',
                  lineHeight: 1.6,
                  margin: 0,
                  fontStyle: 'italic',
                }}>
                  {ts.noApiKeyOverview}
                </p>
              )}
            </div>

            {/* Result count */}
            <div style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 11,
              color: '#6B6358',
              letterSpacing: '0.08em',
              marginBottom: 12,
              padding: '0 4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
            }}>
              <span>{ts.resultsFor(allResults.length, searchResults?.keyword || query)}</span>
              {typeFilters.length < 3 && (
                <span style={{ fontStyle: 'italic', color: '#9B9185' }}>
                  {lang === 'ko' ? '필터 적용됨' : 'filtered'}
                </span>
              )}
            </div>

            {/* Cards */}
            {allResults.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#1A1611', fontStyle: 'italic' }}>
                  {ts.noResults(query)}
                </div>
              </div>
            ) : (
              allResults.map((item, i) => (
                <ResultCard
                  key={`${item._type}-${i}`}
                  item={item}
                  type={item._type}
                  hasAi={searchResults?.has_ai !== false}
                />
              ))
            )}
          </>
        )}

        {/* ── Error ── */}
        {searchState === 'error' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#C84B31', fontStyle: 'italic', marginBottom: 12 }}>
              {ts.searchError}
            </div>
            <button
              onClick={handleClear}
              style={{
                background: 'none', border: '1px solid #D8D0BE', padding: '8px 16px',
                fontFamily: "'Geist', sans-serif", fontSize: 12,
                color: '#6B6358', cursor: 'pointer', borderRadius: 4,
              }}
            >
              ← {ts.backToFeed}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const monthInputStyle = {
  padding: '5px 8px',
  border: '1px solid #D8D0BE',
  borderRadius: 4,
  fontFamily: "'Geist', sans-serif",
  fontSize: 12,
  color: '#1A1611',
  background: '#FFFFFF',
  outline: 'none',
};
