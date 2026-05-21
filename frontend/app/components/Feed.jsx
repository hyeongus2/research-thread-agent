'use client';

import { useState, useRef } from 'react';
import { Settings, Bell, ArrowUpRight, Search, X, BookOpen, ChevronUp, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import LearningPath from './LearningPath';

const API = 'http://localhost:8000/api';

const TYPE_COLORS = {
  paper: { bg: '#FFE8E0', fg: '#8B2E1B' },
  model: { bg: '#E0EEFF', fg: '#1B3E8B' },
  repo:  { bg: '#E0F5E0', fg: '#1B7A2E' },
};

const TAB_KEYS = { paper: 'papers', model: 'models', repo: 'repos' };

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
  if (period === 'week')             start.setDate(start.getDate() - 7);
  else if (period === 'month')       start.setDate(start.getDate() - 30);
  else if (period === 'threeMonths') start.setDate(start.getDate() - 90);
  else if (period === 'lastNMonths') start.setMonth(start.getMonth() - nMonths);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// =============================================================================
// Pagination helper
// =============================================================================
function getPageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const result = [];
  const delta = 1;
  const left = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);

  result.push(1);
  if (left > 2) result.push('…');
  for (let i = left; i <= right; i++) result.push(i);
  if (right < totalPages - 1) result.push('…');
  result.push(totalPages);
  return result;
}

// =============================================================================
// Result card (paper / model / repo)
// =============================================================================
function ResultCard({ item, type, onSummarize, summary, summaryLoading }) {
  const { t } = useLanguage();
  const ts = t.search;
  const colors = TYPE_COLORS[type];
  const typeLabel = { paper: 'PAPER', model: 'MODEL', repo: 'REPO' }[type];
  const [expanded, setExpanded] = useState(false);

  const title = item.title || item.name || '';
  const url = item.url || item.pdf_url || '#';
  const abstract = item.abstract || '';

  let meta = '';
  let badge = null;

  if (type === 'paper') {
    const authors = Array.isArray(item.authors)
      ? item.authors.slice(0, 2).join(', ')
      : item.authors || '';
    const year = item.published_date ? item.published_date.slice(0, 4) : '';
    meta = [authors, year].filter(Boolean).join(' · ');
    if (item.venue) meta = item.venue + (meta ? ' · ' + meta : '');
    if (item.citation_count > 0) {
      badge = ts.citations(item.citation_count);
    }
  } else if (type === 'model') {
    const dl = item.downloads ? `↓ ${(item.downloads / 1000).toFixed(0)}K` : '';
    meta = [item.pipeline_tag, dl].filter(Boolean).join(' · ');
  } else {
    const stars = item.stars ? `★ ${item.stars.toLocaleString()}` : '';
    meta = [item.language, stars].filter(Boolean).join(' · ');
  }

  const ABSTRACT_THRESHOLD = 200;
  const needsToggle = type === 'paper' && abstract.length > ABSTRACT_THRESHOLD;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E8E2D5',
      marginBottom: 14,
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      {/* Clickable card body */}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'block', padding: '18px 20px 14px', textDecoration: 'none', color: '#1A1611' }}
      >
        {/* Top row: type badge + citation badge + arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: colors.bg, color: colors.fg,
              padding: '3px 8px', borderRadius: 2,
              fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
              fontFamily: "'Geist', sans-serif",
            }}>
              {typeLabel}
            </span>
            {badge && (
              <span style={{
                fontFamily: "'Geist', sans-serif", fontSize: 11,
                color: '#6B6358', fontWeight: 500,
              }}>
                {badge}
              </span>
            )}
          </div>
          <ArrowUpRight size={14} style={{ color: '#6B6358', flexShrink: 0 }} />
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 17, lineHeight: 1.25, fontWeight: 500,
          color: '#1A1611', margin: '0 0 10px',
        }}>
          {title}
        </h3>

        {/* Abstract (papers only) */}
        {type === 'paper' && abstract && (
          <p style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 12, lineHeight: 1.6, color: '#3A342B',
            margin: '0 0 8px',
            display: '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 3,
            WebkitBoxOrient: 'vertical',
            overflow: expanded ? 'visible' : 'hidden',
          }}>
            {abstract}
          </p>
        )}

        {/* Model / repo description */}
        {type !== 'paper' && (item.description) && (
          <p style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 12, lineHeight: 1.5, color: '#3A342B',
            margin: '0 0 8px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {item.description}
          </p>
        )}

        {/* Meta */}
        {meta && (
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358' }}>
            {meta}
          </span>
        )}
      </a>

      {/* Card footer: expand toggle + AI summary button */}
      {(needsToggle || type === 'paper') && (
        <div style={{
          borderTop: '1px solid #F0EBE2',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          {/* Abstract toggle */}
          {needsToggle ? (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontFamily: "'Geist', sans-serif", fontSize: 11,
                color: '#6B6358', cursor: 'pointer',
              }}
            >
              {expanded ? ts.hideAbstract : ts.showAbstract}
            </button>
          ) : <span />}

          {/* AI 요약 button */}
          {type === 'paper' && abstract && (
            summary ? (
              <p style={{
                fontFamily: "'Geist', sans-serif", fontSize: 12,
                color: '#1A1611', margin: 0, lineHeight: 1.5, flex: 1,
                textAlign: 'right',
              }}>
                {summary}
              </p>
            ) : summaryLoading ? (
              <span style={{
                fontFamily: "'Geist', sans-serif", fontSize: 11,
                color: '#6B6358', fontStyle: 'italic',
              }}>
                {ts.aiLoading}
              </span>
            ) : (
              <button
                onClick={onSummarize}
                style={{
                  background: 'none',
                  border: '1px solid #D8D0BE',
                  borderRadius: 3,
                  padding: '3px 10px',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 11,
                  color: '#6B6358',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {ts.aiSummarizeBtn}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tab bar
// =============================================================================
function TabBar({ activeTab, counts, onTab, perPage, onPerPage, ts }) {
  const tabs = ['paper', 'model', 'repo'];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 8,
      flexWrap: 'wrap',
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {tabs.map(tab => {
          const active = activeTab === tab;
          const count = counts[tab] ?? 0;
          return (
            <button
              key={tab}
              onClick={() => onTab(tab)}
              style={{
                padding: '6px 12px',
                background: active ? '#1A1611' : 'transparent',
                color: active ? '#FAF7F2' : '#6B6358',
                border: '1px solid ' + (active ? '#1A1611' : '#D8D0BE'),
                borderRadius: 4,
                fontFamily: "'Geist', sans-serif",
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {ts.tabs[tab]}
              {count > 0 && (
                <span style={{
                  marginLeft: 5,
                  background: active ? 'rgba(255,255,255,0.2)' : '#E8E2D5',
                  color: active ? '#FAF7F2' : '#6B6358',
                  borderRadius: 10,
                  padding: '0 5px',
                  fontSize: 10,
                  fontWeight: 600,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Per-page selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[10, 25, 50].map(n => (
          <button
            key={n}
            onClick={() => onPerPage(n)}
            style={{
              padding: '4px 8px',
              background: perPage === n ? '#1A1611' : 'transparent',
              color: perPage === n ? '#FAF7F2' : '#6B6358',
              border: '1px solid ' + (perPage === n ? '#1A1611' : '#D8D0BE'),
              borderRadius: 3,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {n}
          </button>
        ))}
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185' }}>
          {ts.perPage}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Pagination
// =============================================================================
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const pages = getPageNumbers(page, totalPages);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: '16px 0 8px',
    }}>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        style={pageBtn(false, page === 1)}
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`dot-${i}`} style={{
            padding: '0 6px',
            fontFamily: "'Geist', sans-serif",
            fontSize: 12, color: '#9B9185',
          }}>
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            style={pageBtn(p === page, false)}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        style={pageBtn(false, page === totalPages)}
      >
        ›
      </button>
    </div>
  );
}

function pageBtn(active, disabled) {
  return {
    minWidth: 32, height: 32,
    padding: '0 8px',
    background: active ? '#1A1611' : 'transparent',
    color: disabled ? '#C8C0B0' : active ? '#FAF7F2' : '#6B6358',
    border: '1px solid ' + (active ? '#1A1611' : disabled ? '#E8E2D5' : '#D8D0BE'),
    borderRadius: 4,
    fontFamily: "'Geist', sans-serif",
    fontSize: 12,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'all 0.15s',
  };
}

// =============================================================================
// Source error banner
// =============================================================================
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

function SourceErrorBanner({ sourceErrors, lang }) {
  const labels = ERROR_LABELS[lang] || ERROR_LABELS.en;
  const entries = Object.entries(sourceErrors);
  if (entries.length === 0) return null;
  return (
    <div style={{
      margin: '4px 0 8px', padding: '10px 14px',
      background: '#FFF8F5', border: '1px solid #F0C8B8',
      borderRadius: 4, display: 'flex', flexWrap: 'wrap', gap: '6px 16px',
    }}>
      {entries.map(([src, info]) => {
        const srcLabel = { papers: 'Semantic Scholar', models: 'Hugging Face', repos: 'GitHub' }[src] || src;
        const minLeft = info.retryAt ? Math.max(0, Math.ceil((info.retryAt - Date.now()) / 60000)) : 0;
        const msgFn = labels[info.kind] || labels.error;
        return (
          <span key={src} style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#8B3A1B' }}>
            <span style={{ fontWeight: 600 }}>{srcLabel}</span>{' · '}{msgFn(minLeft)}
          </span>
        );
      })}
    </div>
  );
}

// =============================================================================
// Loading progress (simplified: source badges + elapsed)
// =============================================================================
const SOURCE_META = [
  { key: 'papers', label: 'Semantic Scholar' },
  { key: 'models', label: 'Hugging Face' },
  { key: 'repos',  label: 'GitHub' },
];

function SearchProgress({ lang, elapsed, sourceStatus }) {
  return (
    <div style={{ padding: '40px 8px 0' }}>
      <div style={{
        fontFamily: "'Fraunces', serif", fontSize: 20,
        color: '#1A1611', fontStyle: 'italic',
        textAlign: 'center', marginBottom: 28,
      }}>
        {lang === 'ko' ? '검색 중…' : 'Searching…'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
        {SOURCE_META.map(({ key, label }) => {
          const raw = sourceStatus[key];
          const isPending = raw === undefined;
          const isFailed  = raw === -1;
          const isDone    = !isPending && !isFailed;
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: `2px solid ${isPending ? '#D8D0BE' : isFailed ? '#C84B31' : '#1B7A2E'}`,
                background: isPending ? '#FAF7F2' : isFailed ? '#FDF0EE' : '#EEF7EE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, transition: 'all 0.35s',
              }}>
                {isPending
                  ? <span style={{ color: '#C8C0B0', fontSize: 20 }}>·</span>
                  : isFailed
                  ? <span style={{ color: '#C84B31' }}>✕</span>
                  : <span style={{ color: '#1B7A2E' }}>✓</span>}
              </div>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', textAlign: 'center', maxWidth: 80 }}>
                {label}
              </span>
              {isDone && raw > 0 && (
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: '#9B9185' }}>
                  {raw}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{
        textAlign: 'center', fontFamily: "'Geist Mono', monospace",
        fontSize: 11, color: '#6B6358',
      }}>
        {elapsed}s
      </div>
    </div>
  );
}

// =============================================================================
// Empty state
// =============================================================================
function EmptyFeed({ onSuggestionClick }) {
  const { t } = useLanguage();
  const tf = t.feed;
  const suggestions = ['reasoning', 'multimodal agent', 'LoRA', 'RAG', 'MoE', 'RLHF'];
  return (
    <div style={{ padding: '48px 8px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 20 }}>🔍</div>
      <h3 style={{
        fontFamily: "'Fraunces', serif", fontSize: 22,
        fontWeight: 500, fontStyle: 'italic', color: '#1A1611', margin: '0 0 12px',
      }}>
        {tf.emptyTitle}
      </h3>
      <p style={{
        fontFamily: "'Geist', sans-serif", fontSize: 13,
        lineHeight: 1.6, color: '#6B6358', margin: '0 0 28px',
        maxWidth: 280, marginLeft: 'auto', marginRight: 'auto',
      }}>
        {tf.emptyDesc}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {suggestions.map(kw => (
          <button
            key={kw}
            onClick={() => onSuggestionClick(kw)}
            style={{
              padding: '7px 14px', background: '#FFFFFF',
              border: '1px solid #D8D0BE', borderRadius: 20,
              fontFamily: "'Geist', sans-serif", fontSize: 12,
              color: '#3A342B', cursor: 'pointer',
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
export default function Feed({ onSettings, userId }) {
  const { t, lang } = useLanguage();
  const tf = t.feed;
  const ts = t.search;
  const tl = t.learningPath;

  const [mode, setMode] = useState('search');

  const today = new Date();
  const dateLabel = today.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });

  // Search bar
  const [query, setQuery] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [period, setPeriod] = useState('month');
  const [nMonths, setNMonths] = useState(6);
  const [customFrom, setCustomFrom] = useState(() => toYearMonth(new Date(new Date().setMonth(new Date().getMonth() - 6))));
  const [customTo, setCustomTo] = useState(() => toYearMonth(new Date()));

  // Search state
  const [searchState, setSearchState] = useState('idle');
  const [searchResults, setSearchResults] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [sourceStatus, setSourceStatus] = useState({});
  const [sourceErrors, setSourceErrors] = useState({});
  const elapsedRef = useRef(null);

  // Tab / pagination
  const [activeTab, setActiveTab] = useState('paper');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // AI overview
  const [overviewText, setOverviewText] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewNoKey, setOverviewNoKey] = useState(false);

  // Per-paper AI summary
  const [paperSummaries, setPaperSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});

  // Scroll ref
  const scrollRef = useRef(null);

  // ── Keyword chip helpers ───────────────────────────────────────────────────
  const commitKeyword = () => {
    const kw = query.trim().replace(/,$/, '');
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw]);
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

  // ── Search ────────────────────────────────────────────────────────────────
  const runSearch = async (kws, singleKw) => {
    const allKws = singleKw ? [singleKw] : [...kws, ...(query.trim() ? [query.trim()] : [])];
    if (allKws.length === 0) return;
    const combined = allKws.join(' OR ');

    setSearchState('loading');
    setElapsed(0);
    setSourceStatus({});
    setSourceErrors({});
    setActiveTab('paper');
    setPage(1);
    setOverviewText(null);
    setOverviewLoading(false);
    setOverviewNoKey(false);
    setPaperSummaries({});
    setSummaryLoading({});
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
        buffer = lines.pop();
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

  // ── Tab / pagination ──────────────────────────────────────────────────────
  const handleTab = (tab) => { setActiveTab(tab); setPage(1); };
  const handlePerPage = (n) => { setPerPage(n); setPage(1); };

  const tabKey = TAB_KEYS[activeTab];
  const tabItems = searchResults?.[tabKey] || [];
  const totalPages = Math.ceil(tabItems.length / perPage);
  const pageStart = (page - 1) * perPage;
  const pageItems = tabItems.slice(pageStart, pageStart + perPage);

  const tabCounts = {
    paper: searchResults?.papers?.length ?? 0,
    model: searchResults?.models?.length ?? 0,
    repo:  searchResults?.repos?.length ?? 0,
  };

  // ── AI overview ───────────────────────────────────────────────────────────
  const fetchOverview = async () => {
    if (overviewLoading || overviewText) return;
    setOverviewLoading(true);
    try {
      const titles = (searchResults?.papers || []).slice(0, 10).map(p => p.title);
      const res = await fetch(`${API}/summarize/overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchResults?.keyword || '', paper_titles: titles }),
      });
      const data = await res.json();
      if (data.no_api_key) {
        setOverviewNoKey(true);
      } else {
        setOverviewText(data.overview || null);
      }
    } catch {}
    setOverviewLoading(false);
  };

  // ── Per-paper summary ─────────────────────────────────────────────────────
  const fetchPaperSummary = async (title, abstract) => {
    if (!abstract || paperSummaries[title] !== undefined || summaryLoading[title]) return;
    setSummaryLoading(prev => ({ ...prev, [title]: true }));
    try {
      const res = await fetch(`${API}/summarize/paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abstract }),
      });
      const data = await res.json();
      setPaperSummaries(prev => ({
        ...prev,
        [title]: data.no_api_key ? ts.noApiKey : (data.summary || ''),
      }));
    } catch {}
    setSummaryLoading(prev => ({ ...prev, [title]: false }));
  };

  // ── Scroll helpers ─────────────────────────────────────────────────────────
  const scrollToTop    = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });

  if (mode === 'learning') {
    return <LearningPath userId={userId} onBack={() => setMode('search')} />;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF7F2' }}>

      {/* Header */}
      <div style={{
        padding: '52px 24px 16px', background: '#FAF7F2',
        borderBottom: '1px solid #E8E2D5',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 2 }}>
            {tf.todayLabel} · {dateLabel}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, color: '#1A1611', letterSpacing: '-0.02em' }}>
            Research<span style={{ color: '#C84B31', fontStyle: 'italic' }}>.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('learning')} title={tl.tabBtn}
            style={{ background: 'none', border: 'none', padding: 8, color: '#1A1611', cursor: 'pointer' }}>
            <BookOpen size={18} />
          </button>
          <button style={{ background: 'none', border: 'none', padding: 8, color: '#1A1611' }}>
            <Bell size={18} />
          </button>
          <button onClick={onSettings} style={{ background: 'none', border: 'none', padding: 8, color: '#1A1611', cursor: 'pointer' }}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '14px 16px 0', background: '#FAF7F2' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
            background: '#FFFFFF', border: '1px solid #D8D0BE', borderRadius: 4,
            padding: '6px 10px', minHeight: 40,
          }}>
            <Search size={14} style={{ color: '#6B6358', flexShrink: 0 }} />
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
                flex: 1, minWidth: 80, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', padding: '2px 0',
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
              color: '#FAF7F2', border: 'none', borderRadius: 4,
              fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500,
              cursor: (query.trim() || keywords.length > 0) ? 'pointer' : 'default',
              transition: 'background 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {ts.searchBtn}
          </button>
        </div>

        {/* Period pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {['week', 'month', 'threeMonths', 'lastNMonths', 'custom', 'all'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '5px 10px',
              background: period === p ? '#1A1611' : 'transparent',
              color: period === p ? '#FAF7F2' : '#6B6358',
              border: '1px solid ' + (period === p ? '#1A1611' : '#D8D0BE'),
              borderRadius: 20, fontFamily: "'Geist', sans-serif", fontSize: 11,
              fontWeight: period === p ? 600 : 400, whiteSpace: 'nowrap',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {ts.periods[p]}
            </button>
          ))}
        </div>

        {period === 'lastNMonths' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>
              {ts.fromLabel.toLowerCase()}
            </span>
            <input
              type="number" min={1} max={60} value={nMonths}
              onChange={e => setNMonths(Math.max(1, Math.min(60, Number(e.target.value))))}
              style={nMonthsInputStyle}
            />
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>
              {ts.nMonthsLabel}
            </span>
          </div>
        )}

        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>{ts.fromLabel}</span>
            <input type="month" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} style={monthInputStyle} />
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>–</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>{ts.toLabel}</span>
            <input type="month" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} style={monthInputStyle} />
          </div>
        )}
      </div>

      {/* Content area with scroll buttons */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', padding: '0 16px 80px', background: '#FAF7F2' }}
        >
          {/* ── Empty state ── */}
          {searchState === 'idle' && <EmptyFeed onSuggestionClick={handleSuggestion} />}

          {/* ── Loading ── */}
          {searchState === 'loading' && (
            <SearchProgress lang={lang} elapsed={elapsed} sourceStatus={sourceStatus} />
          )}

          {/* ── Results ── */}
          {searchState === 'done' && (
            <>
              {/* Back to feed */}
              <button onClick={handleClear} style={{
                background: 'none', border: 'none', padding: '8px 4px 4px',
                fontFamily: "'Geist', sans-serif", fontSize: 12,
                color: '#6B6358', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                ← {ts.backToFeed}
              </button>

              <SourceErrorBanner sourceErrors={sourceErrors} lang={lang} />

              {/* AI Overview section */}
              <div style={{
                margin: '4px 0 16px',
                padding: '12px 16px',
                background: '#FFFFFF',
                borderLeft: '3px solid #C84B31',
                borderRadius: '0 4px 4px 0',
              }}>
                <div style={{
                  fontFamily: "'Geist', sans-serif", fontSize: 10,
                  color: '#6B6358', letterSpacing: '0.15em', marginBottom: 8,
                }}>
                  OVERVIEW
                </div>
                {overviewText ? (
                  <p style={{
                    fontFamily: "'Geist', sans-serif", fontSize: 13,
                    color: '#1A1611', lineHeight: 1.6, margin: 0,
                  }}>
                    {overviewText}
                  </p>
                ) : overviewNoKey ? (
                  <p style={{
                    fontFamily: "'Geist', sans-serif", fontSize: 12,
                    color: '#6B6358', lineHeight: 1.6, margin: 0, fontStyle: 'italic',
                  }}>
                    {ts.noApiKeyOverview}
                  </p>
                ) : overviewLoading ? (
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', fontStyle: 'italic', margin: 0 }}>
                    {ts.aiLoading}
                  </p>
                ) : (
                  <button
                    onClick={fetchOverview}
                    style={{
                      background: 'none',
                      border: '1px solid #D8D0BE',
                      borderRadius: 3,
                      padding: '5px 12px',
                      fontFamily: "'Geist', sans-serif",
                      fontSize: 12, color: '#6B6358', cursor: 'pointer',
                    }}
                  >
                    {ts.aiOverviewBtn}
                  </button>
                )}
              </div>

              {/* Tab bar + per-page selector */}
              <TabBar
                activeTab={activeTab}
                counts={tabCounts}
                onTab={handleTab}
                perPage={perPage}
                onPerPage={handlePerPage}
                ts={ts}
              />

              {/* Result count for current tab */}
              <div style={{
                fontFamily: "'Geist', sans-serif", fontSize: 11,
                color: '#9B9185', marginBottom: 10, padding: '0 2px',
              }}>
                {ts.resultsFor(tabItems.length, searchResults?.keyword || '')}
              </div>

              {/* Cards */}
              {pageItems.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#1A1611', fontStyle: 'italic' }}>
                    {ts.noResults(searchResults?.keyword || '')}
                  </div>
                </div>
              ) : (
                pageItems.map((item, i) => {
                  const title = item.title || item.name || '';
                  return (
                    <ResultCard
                      key={`${activeTab}-${pageStart + i}`}
                      item={item}
                      type={activeTab}
                      summary={paperSummaries[title]}
                      summaryLoading={!!summaryLoading[title]}
                      onSummarize={() => fetchPaperSummary(title, item.abstract)}
                    />
                  );
                })
              )}

              {/* Pagination */}
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )}

          {/* ── Error ── */}
          {searchState === 'error' && (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#C84B31', fontStyle: 'italic', marginBottom: 12 }}>
                {ts.searchError}
              </div>
              <button onClick={handleClear} style={{
                background: 'none', border: '1px solid #D8D0BE', padding: '8px 16px',
                fontFamily: "'Geist', sans-serif", fontSize: 12,
                color: '#6B6358', cursor: 'pointer', borderRadius: 4,
              }}>
                ← {ts.backToFeed}
              </button>
            </div>
          )}
        </div>

        {/* Scroll navigation buttons */}
        {(searchState === 'done' || searchState === 'idle') && (
          <div style={{
            position: 'absolute',
            bottom: 90,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 10,
          }}>
            <button
              onClick={scrollToTop}
              title={ts.scrollTop}
              style={scrollBtnStyle}
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={scrollToBottom}
              title={ts.scrollBottom}
              style={scrollBtnStyle}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const monthInputStyle = {
  padding: '5px 8px', border: '1px solid #D8D0BE', borderRadius: 4,
  fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#1A1611',
  background: '#FFFFFF', outline: 'none',
};

const nMonthsInputStyle = {
  width: 56, padding: '5px 8px', border: '1px solid #D8D0BE', borderRadius: 4,
  fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611',
  background: '#FFFFFF', outline: 'none', textAlign: 'center',
};

const scrollBtnStyle = {
  width: 32, height: 32,
  background: '#FFFFFF',
  border: '1px solid #D8D0BE',
  borderRadius: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  color: '#6B6358',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};
