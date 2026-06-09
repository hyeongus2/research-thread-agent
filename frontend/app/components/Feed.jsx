'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Bell, ArrowUpRight, Search, X, ChevronUp, ChevronDown, Home, Newspaper, BookOpen, Library, GitBranch, Network, Film } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import LearningPath from './LearningPath';
import CitationGraph from './CitationGraph';
import ResearcherNetwork from './ResearcherNetwork';
import PaperCard, { TYPE_COLORS } from './PaperCard';
import ReelsView from './ReelsView';

const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '8000';
const API = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api` : `http://localhost:${API_PORT}/api`;

const DEFAULT_LIMITS = { papers: 100, models: 25, repos: 25 };

function getSearchLimits() {
  try {
    const stored = localStorage.getItem('search_limits');
    return stored ? { ...DEFAULT_LIMITS, ...JSON.parse(stored) } : DEFAULT_LIMITS;
  } catch { return DEFAULT_LIMITS; }
}

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
// Tab bar
// =============================================================================
function TabBar({ activeTab, counts, onTab, perPage, onPerPage, ts, authorOnly = false }) {
  const tabs = authorOnly ? ['paper'] : ['paper', 'model', 'repo'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {tabs.map(tab => {
          const active = activeTab === tab;
          const count = counts[tab] ?? 0;
          const colors = TYPE_COLORS[tab];
          return (
            <button key={tab} onClick={() => onTab(tab)} style={{ padding: '6px 12px', background: active ? colors.fg : 'transparent', color: active ? '#FAF7F2' : '#6B6358', border: '1px solid ' + (active ? colors.fg : '#D8D0BE'), borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {ts.tabs[tab]}
              {count > 0 && <span style={{ marginLeft: 5, background: active ? 'rgba(255,255,255,0.25)' : '#E8E2D5', color: active ? '#FAF7F2' : '#6B6358', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 600 }}>{count}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[10, 25, 50].map(n => (
          <button key={n} onClick={() => onPerPage(n)} style={{ padding: '4px 8px', background: perPage === n ? '#1A1611' : 'transparent', color: perPage === n ? '#FAF7F2' : '#6B6358', border: '1px solid ' + (perPage === n ? '#1A1611' : '#D8D0BE'), borderRadius: 3, fontFamily: "'Geist Mono', monospace", fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}>
            {n}
          </button>
        ))}
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185' }}>{ts.perPage}</span>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '16px 0 8px' }}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1} style={pageBtn(false, page === 1)}>‹</button>
      {pages.map((p, i) =>
        p === '…' ? <span key={`dot-${i}`} style={{ padding: '0 6px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#9B9185' }}>…</span>
          : <button key={p} onClick={() => onPage(p)} style={pageBtn(p === page, false)}>{p}</button>
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages} style={pageBtn(false, page === totalPages)}>›</button>
    </div>
  );
}

function pageBtn(active, disabled) {
  return { minWidth: 32, height: 32, padding: '0 8px', background: active ? '#1A1611' : 'transparent', color: disabled ? '#C8C0B0' : active ? '#FAF7F2' : '#6B6358', border: '1px solid ' + (active ? '#1A1611' : disabled ? '#E8E2D5' : '#D8D0BE'), borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: disabled ? 'default' : 'pointer', transition: 'all 0.15s' };
}

// =============================================================================
// Source error banner
// =============================================================================
const ERROR_LABELS = {
  en: { rate_limit: (m) => m > 0 ? `Rate limited — retry in ${m}m` : 'Rate limited', auth_error: () => 'Invalid token — check .env', timeout: () => 'Timed out', error: () => 'Failed' },
  ko: { rate_limit: (m) => m > 0 ? `횟수 초과 — ${m}분 후 재시도` : '횟수 초과', auth_error: () => '토큰 오류 — .env 확인', timeout: () => '시간 초과', error: () => '오류' },
};

function SourceErrorBanner({ sourceErrors, lang }) {
  const labels = ERROR_LABELS[lang] || ERROR_LABELS.en;
  const entries = Object.entries(sourceErrors);
  if (entries.length === 0) return null;
  return (
    <div style={{ margin: '4px 0 8px', padding: '10px 14px', background: '#FFF8F5', border: '1px solid #F0C8B8', borderRadius: 4, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {entries.map(([src, info]) => {
        const srcLabel = { papers: 'Semantic Scholar', models: 'Hugging Face', repos: 'GitHub' }[src] || src;
        const minLeft = info.retryAt ? Math.max(0, Math.ceil((info.retryAt - Date.now()) / 60000)) : 0;
        const msgFn = labels[info.kind] || labels.error;
        return <span key={src} style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#8B3A1B' }}><span style={{ fontWeight: 600 }}>{srcLabel}</span>{' · '}{msgFn(minLeft)}</span>;
      })}
    </div>
  );
}

// =============================================================================
// Loading progress
// =============================================================================
function SearchProgress({ lang, elapsed, sourceStatus, papersSourceLabel }) {
  const SOURCE_META = [
    { key: 'papers', label: papersSourceLabel || 'Semantic Scholar' },
    { key: 'models', label: 'Hugging Face' },
    { key: 'repos',  label: 'GitHub' },
  ];
  return (
    <div style={{ padding: '40px 8px 0' }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#1A1611', fontStyle: 'italic', textAlign: 'center', marginBottom: 28 }}>
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
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${isPending ? '#D8D0BE' : isFailed ? '#C84B31' : '#1B7A2E'}`, background: isPending ? '#FAF7F2' : isFailed ? '#FDF0EE' : '#EEF7EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all 0.35s' }}>
                {isPending ? <span style={{ color: '#C8C0B0', fontSize: 20 }}>·</span> : isFailed ? <span style={{ color: '#C84B31' }}>✕</span> : <span style={{ color: '#1B7A2E' }}>✓</span>}
              </div>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', textAlign: 'center', maxWidth: 80 }}>{label}</span>
              {isDone && raw > 0 && <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: '#9B9185' }}>{raw}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 11, color: '#6B6358' }}>{elapsed}s</div>
    </div>
  );
}

// =============================================================================
// Trending card (single paper in HF feed)
// =============================================================================
function TrendingCard({ p, onQuickSearch, onSummarize, aiSummary, summaryLoading, summaryNoKey }) {
  const { t, lang } = useLanguage();
  const tf = t.feed;
  const ts = t.search;
  const [expanded, setExpanded] = useState(false);
  const authors = (p.authors || []).slice(0, 2).join(', ');
  const THRESHOLD = 200;
  const needsToggle = p.summary && p.summary.length > THRESHOLD;

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
      <a href={p.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '16px 20px 8px', textDecoration: 'none', color: '#1A1611' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: TYPE_COLORS.paper.bg, color: TYPE_COLORS.paper.fg, padding: '3px 8px', borderRadius: 2, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', fontFamily: "'Geist', sans-serif" }}>
              PAPER
            </span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: '#C84B31', fontWeight: 600 }}>
              {tf.upvotes(p.upvotes)}
            </span>
          </div>
          <ArrowUpRight size={14} style={{ color: '#6B6358' }} />
        </div>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: '#1A1611', margin: '0 0 8px' }}>
          {p.title}
        </h3>
        {authors && <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358' }}>{authors}</span>}
      </a>
      {p.summary && (
        <div style={{ padding: '4px 20px 8px' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, lineHeight: 1.6, color: '#3A342B', margin: 0, display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden' }}>
            {p.summary}
          </p>
        </div>
      )}
      <div style={{ borderTop: '1px solid #F0EBE2', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {needsToggle ? (
          <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', padding: 0, fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', cursor: 'pointer' }}>
            {expanded ? ts.hideAbstract : ts.showAbstract}
          </button>
        ) : <span />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onSummarize && !aiSummary && (
            summaryNoKey ? (
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', fontStyle: 'italic' }}>{ts.noApiKey}</span>
            ) : summaryLoading ? (
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', fontStyle: 'italic' }}>{ts.aiLoading}</span>
            ) : (
              <button onClick={onSummarize} style={{ background: 'none', border: '1px solid #D8D0BE', borderRadius: 3, padding: '3px 10px', fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {ts.aiSummarizeBtn}
              </button>
            )
          )}
          <button
            onClick={() => onQuickSearch(p.title.split(':')[0].trim())}
            style={{ background: 'none', border: 'none', padding: 0, fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {lang === 'ko' ? '관련 논문 검색 →' : 'Search related →'}
          </button>
        </div>
      </div>
      {aiSummary && (
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', margin: 0, lineHeight: 1.6, padding: '0 20px 12px' }}>
          {aiSummary}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Trending feed (HF Daily Papers)
// =============================================================================
function TrendingFeed({ onQuickSearch, onComplete }) {
  const { t, lang } = useLanguage();
  const tf = t.feed;
  const ts = t.search;
  const [period, setPeriod] = useState('daily');
  const [papers, setPapers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fallbackDays, setFallbackDays] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const [paperSummaries, setPaperSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [paperNoKey, setPaperNoKey] = useState({});
  const isInitialLoadRef = useRef(true);

  const fetchPaperSummary = async (title, abstract) => {
    if (!abstract || paperSummaries[title] !== undefined || paperNoKey[title] || summaryLoading[title]) return;
    setSummaryLoading(s => ({ ...s, [title]: true }));
    try {
      const r = await fetch(`${API}/summarize/paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abstract, lang }),
      });
      const d = await r.json();
      if (d.no_api_key) setPaperNoKey(s => ({ ...s, [title]: true }));
      else if (d.summary) setPaperSummaries(s => ({ ...s, [title]: d.summary }));
    } finally {
      setSummaryLoading(s => ({ ...s, [title]: false }));
    }
  };

  useEffect(() => {
    const wasInitial = isInitialLoadRef.current;
    isInitialLoadRef.current = false;
    setPapers(null);
    setLoading(true);
    setError(false);
    setFallbackDays(0);
    (async () => {
      try {
        const res = await fetch(`${API}/feed/trending?period=${period}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        setPapers(data.papers || []);
        setFallbackDays(data.fallback_days || 0);
        setIsCached(data.cached || false);
        if (!wasInitial && onComplete) onComplete();
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [period]);

  const today = new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' });

  return (
    <div style={{ padding: '20px 0 16px' }}>
      <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 4 }}>
        {tf.trendingHeader}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCached ? 4 : 16 }}>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#9B9185' }}>
          {tf.trendingSubtitle} · {today}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'daily',   label: tf.trendingPeriodDaily },
            { key: 'weekly',  label: tf.trendingPeriodWeekly },
            { key: 'monthly', label: tf.trendingPeriodMonthly },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)} style={{
              padding: '4px 10px',
              background: period === key ? '#1A1611' : 'transparent',
              color: period === key ? '#FAF7F2' : '#6B6358',
              border: '1px solid ' + (period === key ? '#1A1611' : '#D8D0BE'),
              borderRadius: 20, fontFamily: "'Geist', sans-serif", fontSize: 11,
              fontWeight: period === key ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isCached && !loading && (
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '0 0 12px', textAlign: 'right' }}>
          ⚡ cached result
        </p>
      )}

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358', fontStyle: 'italic' }}>
          {tf.trendingLoading}
        </div>
      )}

      {error && (
        <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#C84B31' }}>
          {tf.trendingError}
        </div>
      )}

      {papers && papers.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358', fontStyle: 'italic' }}>
          {tf.trendingEmpty}
        </div>
      )}

      {papers && papers.length > 0 && period === 'daily' && fallbackDays > 0 && (
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#9B9185', padding: '0 0 12px', textAlign: 'center', fontStyle: 'italic' }}>
          {tf.trendingWeekendNote(fallbackDays)}
        </div>
      )}

      <div className="card-grid">
        {papers && papers.map((p, i) => (
          <TrendingCard
            key={i}
            p={p}
            onQuickSearch={onQuickSearch}
            onSummarize={() => fetchPaperSummary(p.title, p.summary)}
            aiSummary={paperSummaries[p.title]}
            summaryLoading={!!summaryLoading[p.title]}
            summaryNoKey={!!paperNoKey[p.title]}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// My Feed
// =============================================================================
// Persists across remounts so SSE doesn't re-run on every tab visit
let _lastCheckedRefreshKey = -1;

function MyFeedView({ userId, refreshKey = 0, papersRefreshKey = 0, onCheckDone, onComplete }) {
  const { t, lang } = useLanguage();
  const tf = t.feed;
  const ts = t.search;
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState([]); // [{label, status, newCount}]
  const [isCached, setIsCached] = useState(false);
  const checkStartedRef = useRef(false);
  const esRef = useRef(null);
  const [paperSummaries, setPaperSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [paperNoKey, setPaperNoKey] = useState({});

  const fetchPaperSummary = async (title, abstract) => {
    if (!abstract || paperSummaries[title] !== undefined || paperNoKey[title] || summaryLoading[title]) return;
    setSummaryLoading(s => ({ ...s, [title]: true }));
    try {
      const r = await fetch(`${API}/summarize/paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abstract, lang }),
      });
      const d = await r.json();
      if (d.no_api_key) setPaperNoKey(s => ({ ...s, [title]: true }));
      else if (d.summary) setPaperSummaries(s => ({ ...s, [title]: d.summary }));
    } finally {
      setSummaryLoading(s => ({ ...s, [title]: false }));
    }
  };

  const loadPapers = useCallback(() => {
    setLoading(true);
    fetch(`${API}/feed/my-feed?user_id=${userId || 1}`)
      .then(r => r.json())
      .then(d => {
        const items = d.papers || [];
        setPapers(items);
        // Auto-mark all as read when My Feed is viewed
        if (items.some(p => !p.is_read)) {
          fetch(`${API}/notifications/read-all?user_id=${userId || 1}`, { method: 'POST' })
            .then(() => {
              setPapers(prev => prev.map(p => ({ ...p, is_read: true })));
              if (onCheckDone) onCheckDone();
            })
            .catch(() => {});
        }
      })
      .catch(() => setPapers([]))
      .finally(() => setLoading(false));
  }, [userId, onCheckDone]);

  // Reset and reload when refreshKey or userId changes
  useEffect(() => {
    checkStartedRef.current = false;
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setChecking(false);
    setCheckProgress([]);
    loadPapers();
  }, [userId, refreshKey, loadPapers]);

  // Reload papers (no SSE) when background scheduler adds new notifications
  useEffect(() => {
    if (papersRefreshKey > 0) loadPapers();
  }, [papersRefreshKey, loadPapers]);

  // Auto-start SSE check: only when papers are absent, or when refreshKey has newly increased
  useEffect(() => {
    if (!loading && !checking && userId && !checkStartedRef.current) {
      const needsCheck = papers.length === 0 || refreshKey > _lastCheckedRefreshKey;
      if (needsCheck) {
        _lastCheckedRefreshKey = refreshKey;
        checkStartedRef.current = true;
        startCheck();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, papers.length]);

  const startCheck = () => {
    if (esRef.current) esRef.current.close();
    setChecking(true);
    setCheckProgress([]);
    const es = new EventSource(`${API}/notifications/check/stream?user_id=${userId || 1}`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.stage === 'fetching') {
          setCheckProgress(prev => [...prev, { label: ev.label, status: 'loading' }]);
        } else if (ev.stage === 'fetched') {
          setCheckProgress(prev => {
            const next = [...prev];
            if (next.length > 0)
              next[next.length - 1] = { ...next[next.length - 1], status: ev.error ? 'error' : 'done', newCount: ev.new || 0 };
            return next;
          });
        } else if (ev.stage === 'done' || ev.stage === 'error') {
          es.close(); esRef.current = null;
          setChecking(false);
          if (ev.cached) setIsCached(true);
          loadPapers();
          if (onCheckDone) onCheckDone();
          if (ev.stage === 'done' && onComplete) onComplete();
        }
      } catch (_) {}
    };
    es.onerror = () => {
      es.close(); esRef.current = null;
      setChecking(false);
      loadPapers();
    };
  };

  // Progress view while SSE check is running
  if (checking) {
    return (
      <div style={{ padding: '24px 16px 80px' }}>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9E9485', letterSpacing: '0.08em', marginBottom: 16 }}>
          {tf.myFeedGenerating}
        </div>
        {checkProgress.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontFamily: "'Geist', sans-serif", fontSize: 12 }}>
            <span style={{ width: 14, color: item.status === 'done' ? '#1A1611' : item.status === 'error' ? '#9E9485' : '#C84B31' }}>
              {item.status === 'done' ? '✓' : item.status === 'error' ? '✕' : '…'}
            </span>
            <span style={{ color: item.status === 'loading' ? '#9E9485' : '#1A1611' }}>{item.label}</span>
            {item.status === 'done' && item.newCount > 0 && (
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#C84B31' }}>+{item.newCount}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#9E9485' }}>
        {tf.myFeedLoading}
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontStyle: 'italic', color: '#1A1611', marginBottom: 12 }}>
          {tf.navMyFeed}
        </div>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358', lineHeight: 1.6, margin: 0 }}>
          {tf.myFeedEmpty}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      {isCached && (
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '0 0 8px', textAlign: 'right' }}>
          ⚡ cached result
        </p>
      )}
      <div className="card-grid">
        {papers.map(p => (
          <PaperCard
            key={p.id}
            item={p}
            type="paper"
            showCite
            showTopicBadge
            showReadDot
            showTimestamp
            onSummarize={() => fetchPaperSummary(p.title, p.abstract)}
            summary={paperSummaries[p.title]}
            summaryLoading={!!summaryLoading[p.title]}
            summaryNoKey={!!paperNoKey[p.title]}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Notification dropdown
// =============================================================================
function NotificationDropdown({ userId, onClose, onAllRead, onRead, localNotifs = [], onLocalRead, onLocalAllRead, onNotifNavigate, onLocalDelete, onDbDelete }) {
  const { t, lang } = useLanguage();
  const tn = t.notifications;
  const [dbNotifs, setDbNotifs] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    fetch(`${API}/notifications?user_id=${userId || 1}`)
      .then(r => r.json())
      .then(setDbNotifs)
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const markDbRead = async (id) => {
    await fetch(`${API}/notifications/${id}/read?user_id=${userId || 1}`, { method: 'PATCH' });
    setDbNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (onRead) onRead();
  };

  const markAllRead = async () => {
    await fetch(`${API}/notifications/read-all?user_id=${userId || 1}`, { method: 'POST' });
    setDbNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    if (onAllRead) onAllRead();
    if (onLocalAllRead) onLocalAllRead();
  };

  const deleteDbNotif = async (id, e) => {
    e.stopPropagation();
    await fetch(`${API}/notifications/${id}?user_id=${userId || 1}`, { method: 'DELETE' });
    setDbNotifs(prev => prev.filter(n => n.id !== id));
    if (onDbDelete) onDbDelete(id);
  };

  const handleDbClick = (n) => {
    if (!n.is_read) markDbRead(n.id);
    if (n.source_url) window.open(n.source_url, '_blank');
  };

  const handleLocalClick = (n) => {
    if (!n.isRead && onLocalRead) onLocalRead(n.id);
    if (onNotifNavigate) onNotifNavigate(n.tab, n.mode);
  };

  const relTime = (ts) => {
    const diff = Date.now() - new Date(ts);
    const h = Math.floor(diff / 3600000);
    if (h < 1) return '< 1h ago';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const dbUnread = dbNotifs.filter(n => !n.is_read).length;
  const localUnread = localNotifs.filter(n => !n.isRead).length;
  const hasAnyUnread = dbUnread + localUnread > 0;
  const isEmpty = dbNotifs.length === 0 && localNotifs.length === 0;

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', right: 0, zIndex: 200,
      background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 8,
      width: 320, maxHeight: 440, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #E8E2D5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 600, color: '#1A1611', letterSpacing: '0.08em' }}>
          {tn.title}
        </span>
        {hasAnyUnread && (
          <button onClick={markAllRead} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#C84B31' }}>
            {tn.markAllRead}
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {isEmpty && (
          <div style={{ padding: '24px 14px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#9E9485', textAlign: 'center' }}>
            {tn.empty}
          </div>
        )}

        {/* Activity notifications (client-side) */}
        {localNotifs.length > 0 && (
          <>
            <div style={{ padding: '6px 14px 4px', fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.1em', background: '#FAFAFA', borderBottom: '1px solid #F0EBE0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{lang === 'ko' ? '최근 활동' : 'RECENT ACTIVITY'}</span>
              <button onClick={() => { if (onLocalDelete) localNotifs.forEach(n => onLocalDelete(n.id)); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#C84B31' }}>
                {lang === 'ko' ? '모두 삭제' : 'Delete all'}
              </button>
            </div>
            {localNotifs.map(n => (
              <div
                key={n.id}
                onClick={() => handleLocalClick(n)}
                style={{
                  padding: '10px 14px', borderBottom: '1px solid #F0EBE0', cursor: 'pointer',
                  background: n.isRead ? 'transparent' : '#FDF8F2',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.isRead ? 'transparent' : '#C84B31', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#1A1611', fontWeight: n.isRead ? 400 : 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title}
                  </div>
                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9E9485' }}>
                    {relTime(n.created_at)}
                  </div>
                </div>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#9B9185', flexShrink: 0, marginTop: 1 }}>→</span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (onLocalDelete) onLocalDelete(n.id); }}
                  style={{ background: 'none', border: 'none', padding: '0 0 0 4px', cursor: 'pointer', color: '#C4B8A8', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                >×</button>
              </div>
            ))}
          </>
        )}

        {/* DB paper alert notifications */}
        {dbNotifs.length > 0 && (
          <>
            <div style={{ padding: '6px 14px 4px', fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.1em', background: '#FAFAFA', borderBottom: '1px solid #F0EBE0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{lang === 'ko' ? '논문 알림' : 'PAPER ALERTS'}</span>
              <button onClick={async () => {
                await Promise.all(dbNotifs.map(n => fetch(`${API}/notifications/${n.id}?user_id=${userId || 1}`, { method: 'DELETE' })));
                setDbNotifs([]);
                if (onAllRead) onAllRead();
              }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#C84B31' }}>
                {lang === 'ko' ? '모두 삭제' : 'Delete all'}
              </button>
            </div>
            {dbNotifs.map(n => (
              <div
                key={n.id}
                onClick={() => handleDbClick(n)}
                style={{
                  padding: '10px 14px', borderBottom: '1px solid #F0EBE0', cursor: n.source_url ? 'pointer' : 'default',
                  background: n.is_read ? 'transparent' : '#FDF8F2',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? 'transparent' : '#C84B31', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#1A1611', fontWeight: n.is_read ? 400 : 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {n.topic && (
                      <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', background: '#F0EBE0', padding: '1px 6px', borderRadius: 10 }}>
                        {n.topic}
                      </span>
                    )}
                    <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9E9485' }}>
                      {relTime(n.created_at)}
                    </span>
                  </div>
                </div>
                {n.source_url && (
                  <ArrowUpRight size={12} style={{ color: '#9E9485', flexShrink: 0, marginTop: 3 }} />
                )}
                <button
                  onClick={(e) => deleteDbNotif(n.id, e)}
                  style={{ background: 'none', border: 'none', padding: '0 0 0 4px', cursor: 'pointer', color: '#C4B8A8', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                >×</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Search history dropdown
// =============================================================================
function SearchHistoryDropdown({ userId, onSelect, onClose }) {
  const { t } = useLanguage();
  const ts = t.search;
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/search/history?user_id=${userId || 1}`);
        const data = await res.json();
        // Deduplicate by keyword, keep most recent
        const seen = new Set();
        const deduped = [];
        for (const item of data) {
          if (!seen.has(item.keyword)) {
            seen.add(item.keyword);
            deduped.push(item);
          }
        }
        setHistory(deduped);
      } catch { setHistory([]); }
      setLoaded(true);
    })();
  }, [userId]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await fetch(`${API}/search/history/${id}`, { method: 'DELETE' });
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  if (!loaded) return null;

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0,
      background: '#FFFFFF', border: '1px solid #D8D0BE',
      borderRadius: '0 0 4px 4px', zIndex: 100,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      maxHeight: 280, overflowY: 'auto',
    }}>
      {history.length === 0 ? (
        <div style={{ padding: '16px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#9B9185', fontStyle: 'italic' }}>
          {ts.historyEmpty}
        </div>
      ) : (
        <>
          <div style={{ padding: '8px 12px 4px', fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.12em' }}>
            {ts.historyLabel}
          </div>
          {history.map(item => (
            <div key={item.id}
              style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderTop: '1px solid #F0EAD9' }}
              onClick={() => { onSelect(item.keyword); onClose(); }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAF7F2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Search size={12} style={{ color: '#9B9185', flexShrink: 0, marginRight: 8 }} />
              <span style={{ flex: 1, fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.keyword}
              </span>
              <button
                onClick={(e) => handleDelete(e, item.id)}
                style={{ background: 'none', border: 'none', padding: '2px 4px', color: '#9B9185', cursor: 'pointer', lineHeight: 0, flexShrink: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Venues view
// =============================================================================
const VENUE_FIELDS = {
  ML: { bg: '#E0EEFF', fg: '#1B3E8B' },
  Vision: { bg: '#E0F5E0', fg: '#1B7A2E' },
  AI: { bg: '#FFF0E0', fg: '#8B4A1B' },
  NLP: { bg: '#F0E0FF', fg: '#5B1B8B' },
};

function readVenueLimit() {
  try {
    const stored = localStorage.getItem('search_limits');
    return stored ? (JSON.parse(stored).venues ?? 50) : 50;
  } catch { return 50; }
}

function VenuesView({ onComplete }) {
  const { t, lang } = useLanguage();
  const tf = t.feed;
  const ts = t.search;
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [venueState, setVenueState] = useState('idle'); // idle | loading | done | error
  const [papers, setPapers] = useState([]);
  const [venueCached, setVenueCached] = useState(false);
  const [venues, setVenues] = useState([]);
  const [years, setYears] = useState([]);
  const [paperSummaries, setPaperSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [paperNoKey, setPaperNoKey] = useState({});

  useEffect(() => {
    fetch(`${API}/venues`)
      .then(r => r.json())
      .then(d => { setVenues(d.venues || []); setYears(d.years || []); })
      .catch(() => {});
  }, []);

  const fetchVenuePapers = async (venue, year) => {
    setSelectedVenue(venue);
    setSelectedYear(year);
    setVenueState('loading');
    setPapers([]);
    try {
      const limit = readVenueLimit();
      const r = await fetch(`${API}/venues/papers?venue=${encodeURIComponent(venue)}&year=${year}&limit=${limit}`);
      const d = await r.json();
      setPapers(d.papers || []);
      setVenueCached(d.cached || false);
      setVenueState('done');
      if (onComplete) onComplete(venue, year);
    } catch {
      setVenueState('error');
    }
  };

  const fetchPaperSummary = async (title, abstract) => {
    if (!abstract) return;
    setSummaryLoading(s => ({ ...s, [title]: true }));
    try {
      const r = await fetch(`${API}/summarize/paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abstract, lang }),
      });
      const d = await r.json();
      if (d.no_api_key) setPaperNoKey(s => ({ ...s, [title]: true }));
      else if (d.summary) setPaperSummaries(s => ({ ...s, [title]: d.summary }));
    } finally {
      setSummaryLoading(s => ({ ...s, [title]: false }));
    }
  };

  if (venueState === 'idle' || (!selectedYear && venueState !== 'loading')) {
    return (
      <div style={{ paddingTop: 24 }}>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.15em', marginBottom: 4 }}>
          {tf.venuesTitle}
        </div>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', marginBottom: 20 }}>
          {tf.venuesSubtitle}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {venues.map(v => {
            const colors = VENUE_FIELDS[v.field] || VENUE_FIELDS.ML;
            const active = selectedVenue === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setSelectedVenue(active ? null : v.key)}
                style={{ background: active ? colors.fg : '#FFFFFF', color: active ? '#FFFFFF' : colors.fg, border: `1px solid ${colors.fg}`, borderRadius: 6, padding: '14px 12px', fontFamily: "'Geist', sans-serif", fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
              >
                {v.label}
                <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>{v.field}</div>
              </button>
            );
          })}
        </div>
        {selectedVenue && (
          <>
            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', letterSpacing: '0.1em', marginBottom: 10 }}>
              {ts.venuesSelectYear}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => fetchVenuePapers(selectedVenue, y)}
                  style={{ padding: '8px 16px', background: '#FFFFFF', border: '1px solid #D8D0BE', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500, color: '#1A1611', cursor: 'pointer' }}
                >
                  {y}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 16 }}>
      <button
        onClick={() => { setVenueState('idle'); setSelectedYear(null); }}
        style={{ background: 'none', border: 'none', padding: '0 0 12px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer' }}
      >
        {tf.venuesBack}
      </button>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, color: '#1A1611', marginBottom: venueCached ? 4 : 16 }}>
        {tf.venuesPapersHeader(selectedVenue, selectedYear)}
      </div>
      {venueCached && venueState === 'done' && (
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '0 0 12px', textAlign: 'right' }}>
          ⚡ cached result
        </p>
      )}
      {venueState === 'loading' && (
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358', padding: '32px 0', textAlign: 'center' }}>
          {tf.venuesLoading}
        </div>
      )}
      {venueState === 'error' && (
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#C84B31', padding: '32px 0', textAlign: 'center' }}>
          {tf.venuesError}
        </div>
      )}
      {venueState === 'done' && papers.length === 0 && (
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#9B9185', padding: '32px 0', textAlign: 'center' }}>
          {tf.venuesEmpty}
        </div>
      )}
      {selectedYear >= new Date().getFullYear() && (
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#9B9185', padding: '8px 0 4px', textAlign: 'center' }}>
          {tf.venuesCurrentYearNote}
        </div>
      )}
      {venueState === 'done' && papers.length > 0 && papers.length < 10 && selectedYear < new Date().getFullYear() && (
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#9B9185', padding: '8px 0 4px', textAlign: 'center' }}>
          {tf.venuesSparseNote}
        </div>
      )}
      {venueState === 'done' && (
        <div className="card-grid">
          {papers.map((paper, i) => (
            <PaperCard
              key={i}
              item={paper}
              type="paper"
              showCite
              showCode
              summary={paperSummaries[paper.title]}
              summaryLoading={!!summaryLoading[paper.title]}
              summaryNoKey={!!paperNoKey[paper.title]}
              onSummarize={() => fetchPaperSummary(paper.title, paper.abstract)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Bottom navigation bar (4 tabs)
// =============================================================================
function BottomNav({ view, onView, t }) {
  const tf = t.feed;
  const tabs = [
    { key: 'reels',    label: tf.navReels || 'Reels', IconEl: Film },
    { key: 'trending', label: tf.navTrending, IconEl: Newspaper },
    { key: 'myFeed',   label: tf.navMyFeed,   IconEl: Home },
    { key: 'search',   label: tf.navSearch,   IconEl: Search },
    { key: 'venues',   label: tf.navVenues,   IconEl: Library },
  ];
  return (
    <div style={{ borderTop: '1px solid #E8E2D5', background: '#FAF7F2', display: 'flex', height: 56, flexShrink: 0 }}>
      {tabs.map(({ key, label, IconEl }) => {
        const active = view === key;
        return (
          <button key={key} onClick={() => onView(key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: active ? '#1A1611' : '#9B9185', transition: 'color 0.15s' }}>
            <IconEl size={18} />
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Search mode toggle (Quick Search | Learning Path)
// =============================================================================
function SearchModeToggle({ mode, onMode, t }) {
  const ts = t.search;
  return (
    <div style={{ display: 'flex', gap: 0, background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: 3, marginBottom: 14 }}>
      {[
        { key: 'quick', label: ts.modeQuick, Icon: Search },
        { key: 'learning', label: ts.modeLearning, Icon: BookOpen },
        { key: 'lineage', label: ts.modeLineage, Icon: GitBranch },
        { key: 'network', label: ts.modeNetwork, Icon: Network },
      ].map(({ key, label, Icon }) => {
        const active = mode === key;
        return (
          <button key={key} onClick={() => onMode(key)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', background: active ? '#1A1611' : 'transparent', color: active ? '#FAF7F2' : '#6B6358', border: 'none', borderRadius: 2, fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Feed main
// =============================================================================
export default function Feed({ onSettings, userId, myFeedRefreshKey = 0 }) {
  const { t, lang } = useLanguage();
  const tf = t.feed;
  const ts = t.search;

  const [view, setView] = useState('trending');      // 'trending' | 'myFeed' | 'search'
  const [searchMode, setSearchMode] = useState('quick'); // 'quick' | 'learning'

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
  const searchAbortRef = useRef(null);

  // Topic / Author toggle
  // authorStep: 'candidates' = showing candidate list, 'papers' = showing one author's papers
  const [queryType, setQueryType] = useState('topic');
  const [authorStep, setAuthorStep] = useState('candidates'); // 'candidates' | 'papers'
  const [authorCandidates, setAuthorCandidates] = useState([]);
  const [authorResults, setAuthorResults] = useState(null); // {author, papers} | null
  const [authorLoading, setAuthorLoading] = useState(false);
  const [isAuthorCached, setIsAuthorCached] = useState(false);
  const authorCandidatesCacheRef = useRef({}); // keyed by query keyword
  const authorPapersCacheRef = useRef({});     // keyed by author_id
  const searchResultsCacheRef = useRef({});    // keyed by "combined|period|nMonths|customFrom|customTo"
  const [isTopicCached, setIsTopicCached] = useState(false);

  const handleCancelSearch = () => {
    if (searchAbortRef.current) { searchAbortRef.current.abort(); searchAbortRef.current = null; }
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    setSearchState('idle');
  };

  // Tab / pagination
  const [activeTab, setActiveTab] = useState('paper');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // AI overview
  const [overviewText, setOverviewText] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewNoKey, setOverviewNoKey] = useState(false);
  const [overviewError, setOverviewError] = useState(false);

  // Per-paper AI summary
  const [paperSummaries, setPaperSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [paperNoKey, setPaperNoKey] = useState({});

  // Papers source label
  const [papersSourceLabel, setPapersSourceLabel] = useState('Semantic Scholar');

  // Notification dropdown
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myFeedPapersKey, setMyFeedPapersKey] = useState(0);
  const prevUnreadRef = useRef(null);
  const bellRef = useRef(null);

  // Client-side activity notifications (ephemeral, cleared on page reload)
  const [localNotifs, setLocalNotifs] = useState([]);
  const addLocalNotif = useCallback((title, tab, mode = null) => {
    setLocalNotifs(prev => [{
      id: Date.now(),
      title,
      tab,
      mode,
      isRead: false,
      created_at: new Date().toISOString(),
    }, ...prev.slice(0, 19)]);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notifications/count?user_id=${userId || 1}`);
      const d = await res.json();
      const newCount = d.unread || 0;
      if (prevUnreadRef.current !== null && newCount > prevUnreadRef.current) {
        setMyFeedPapersKey(k => k + 1);
      }
      prevUnreadRef.current = newCount;
      setUnreadCount(newCount);
    } catch (_) {}
  }, [userId]);

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  // Search history dropdown
  const [showHistory, setShowHistory] = useState(false);
  const inputWrapperRef = useRef(null);

  // Scroll ref
  const scrollRef = useRef(null);

  // Close history dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
  const runSearch = useCallback(async (kws, singleKw) => {
    const allKws = singleKw ? [singleKw] : [...kws, ...(query.trim() ? [query.trim()] : [])];
    if (allKws.length === 0) return;
    const combined = allKws.join(' ');

    setSearchMode('quick');
    setView('search');
    setQueryType('topic');
    setAuthorStep('candidates');
    setAuthorCandidates([]);
    setAuthorResults(null);
    setActiveTab('paper');
    setPage(1);
    setOverviewText(null);
    setOverviewLoading(false);
    setOverviewNoKey(false);
    setOverviewError(false);
    setPaperSummaries({});
    setSummaryLoading({});
    setPaperNoKey({});
    setIsTopicCached(false);

    const { start, end } = getPeriodDates(period, nMonths, customFrom, customTo);
    const cacheKey = `${combined}|${period}|${nMonths}|${customFrom}|${customTo}`;
    if (searchResultsCacheRef.current[cacheKey]) {
      setSearchResults(searchResultsCacheRef.current[cacheKey]);
      setSearchState('done');
      setSourceStatus({});
      setSourceErrors({});
      setIsTopicCached(true);
      setPapersSourceLabel('Semantic Scholar');
      return;
    }
    setSearchState('loading');
    setElapsed(0);
    setSourceStatus({});
    setSourceErrors({});
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    const startedAt = Date.now();
    elapsedRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);

    const searchLimits = getSearchLimits();
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(`${API}/search/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: combined, start_date: start, end_date: end, user_id: userId || 1, paper_limit: searchLimits.papers, model_limit: searchLimits.models, repo_limit: searchLimits.repos }),
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
            clearTimeout(timeout); clearInterval(elapsedRef.current);
            searchResultsCacheRef.current[cacheKey] = event.result;
            setSearchResults(event.result); setSearchState('done');
            setLocalNotifs(prev => [{
              id: Date.now(), tab: 'search', mode: 'quick', isRead: false,
              title: lang === 'ko' ? `빠른 검색: "${combined}" 완료` : `Quick Search: "${combined}" done`,
              created_at: new Date().toISOString(),
            }, ...prev.slice(0, 19)]);
            return;
          } else if (event.stage === 'error') {
            clearTimeout(timeout); clearInterval(elapsedRef.current);
            setSearchState('error'); return;
          } else if (event.stage === 'papers_source') {
            setPapersSourceLabel(event.msg || 'Semantic Scholar');
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
    } catch (err) {
      clearTimeout(timeout); clearInterval(elapsedRef.current);
      if (err?.name !== 'AbortError') setSearchState('error');
    } finally {
      searchAbortRef.current = null;
    }
  }, [query, period, nMonths, customFrom, customTo, userId, lang]);

  const handleSearchClick = () => {
    setShowHistory(false);
    if (query.trim()) commitKeyword();
    runSearch(keywords, query.trim() || undefined);
  };

  const handleHistorySelect = (keyword) => {
    setKeywords([]);
    setQuery('');
    runSearch([], keyword);
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

  const handleAuthorSwitch = async () => {
    setQueryType('author');
    setAuthorStep('candidates');
    setAuthorResults(null);
    const keyword = (searchResults?.keyword || '').trim();
    if (!keyword) return;
    const cacheKey = keyword.toLowerCase();
    if (authorCandidatesCacheRef.current[cacheKey]) {
      setAuthorCandidates(authorCandidatesCacheRef.current[cacheKey]);
      setIsAuthorCached(true);
      return;
    }
    setIsAuthorCached(false);
    setAuthorLoading(true);
    try {
      const res = await fetch(`${API}/search/author-candidates?name=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      const candidates = data.candidates || [];
      if (candidates.length > 0) {
        authorCandidatesCacheRef.current[cacheKey] = candidates;
      }
      setAuthorCandidates(candidates);
    } catch {
      setAuthorCandidates([]);
    }
    setAuthorLoading(false);
  };

  const handleSelectAuthor = async (author) => {
    setAuthorStep('papers');
    setAuthorResults(null);
    const cacheKey = author.id;
    if (authorPapersCacheRef.current[cacheKey]) {
      setAuthorResults(authorPapersCacheRef.current[cacheKey]);
      setIsAuthorCached(true);
      return;
    }
    setIsAuthorCached(false);
    setAuthorLoading(true);
    try {
      const limit = getSearchLimits().papers;
      const res = await fetch(`${API}/search/author-papers?author_id=${encodeURIComponent(author.id)}&author_name=${encodeURIComponent(author.name)}&limit=${limit}`);
      const data = await res.json();
      authorPapersCacheRef.current[cacheKey] = data;
      setAuthorResults(data);
    } catch {
      setAuthorResults({ author, papers: [] });
    }
    setAuthorLoading(false);
  };

  // Switching to search tab from trending
  const handleQuickSearch = (kw) => {
    setKeywords([]);
    setQuery('');
    runSearch([], kw);
  };

  // ── Tab / pagination ──────────────────────────────────────────────────────
  const handleTab = (tab) => { setActiveTab(tab); setPage(1); };
  const handlePerPage = (n) => { setPerPage(n); setPage(1); };

  const isAuthorMode = queryType === 'author';
  const tabKey = TAB_KEYS[activeTab];
  const tabItems = isAuthorMode
    ? (() => {
        const papers = authorResults?.papers || [];
        const { start, end } = getPeriodDates(period, nMonths, customFrom, customTo);
        if (!start && !end) return papers;
        const startYear = start ? parseInt(start.split('-')[0]) : null;
        const endYear = end ? parseInt(end.split('-')[0]) : null;
        return papers.filter(p => {
          const y = parseInt(p.published_date);
          if (isNaN(y)) return true;
          if (startYear && y < startYear) return false;
          if (endYear && y > endYear) return false;
          return true;
        });
      })()
    : (searchResults?.[tabKey] || []);
  const totalPages = Math.ceil(tabItems.length / perPage);
  const pageStart = (page - 1) * perPage;
  const pageItems = tabItems.slice(pageStart, pageStart + perPage);

  const tabCounts = isAuthorMode
    ? { paper: authorResults?.papers?.length ?? 0, model: 0, repo: 0 }
    : {
        paper: searchResults?.papers?.length ?? 0,
        model: searchResults?.models?.length ?? 0,
        repo:  searchResults?.repos?.length ?? 0,
      };

  // ── AI overview ───────────────────────────────────────────────────────────
  const fetchOverview = async () => {
    if (overviewLoading || overviewText || overviewError) return;
    setOverviewLoading(true);
    try {
      const papers = (searchResults?.papers || []).slice(0, 30).map(p => ({ title: p.title || '', abstract: p.abstract || '' }));
      const res = await fetch(`${API}/summarize/overview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: searchResults?.keyword || '', papers, lang }) });
      const data = await res.json();
      if (data.no_api_key) setOverviewNoKey(true);
      else if (data.overview) setOverviewText(data.overview);
      else setOverviewError(true);
    } catch { setOverviewError(true); }
    setOverviewLoading(false);
  };

  // ── Per-paper summary ─────────────────────────────────────────────────────
  const fetchPaperSummary = async (title, abstract) => {
    if (!abstract || paperSummaries[title] !== undefined || paperNoKey[title] || summaryLoading[title]) return;
    setSummaryLoading(prev => ({ ...prev, [title]: true }));
    try {
      const res = await fetch(`${API}/summarize/paper`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abstract, lang }) });
      const data = await res.json();
      if (data.no_api_key) {
        setPaperNoKey(prev => ({ ...prev, [title]: true }));
      } else if (data.summary) {
        setPaperSummaries(prev => ({ ...prev, [title]: data.summary }));
      }
      // If neither (unexpected response), allow retry by not setting anything
    } catch {}
    setSummaryLoading(prev => ({ ...prev, [title]: false }));
  };

  // ── Scroll helpers ─────────────────────────────────────────────────────────
  const scrollToTop    = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF7F2' }}>

      {/* Header */}
      <div style={{ padding: '52px 24px 16px', background: '#FAF7F2', borderBottom: '1px solid #E8E2D5', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 2 }}>
            {tf.todayLabel} · {dateLabel}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, color: '#1A1611', letterSpacing: '-0.02em' }}>
            Research<span style={{ color: '#C84B31', fontStyle: 'italic' }}>.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifs(p => !p)} style={{ background: 'none', border: 'none', padding: 8, color: '#1A1611', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} />
              {(unreadCount + localNotifs.filter(n => !n.isRead).length) > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#C84B31', border: '1.5px solid #FAF7F2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, color: '#FFF', fontFamily: "'Geist', sans-serif", fontWeight: 700,
                }} />
              )}
            </button>
            {showNotifs && (
              <NotificationDropdown
                userId={userId}
                onClose={() => setShowNotifs(false)}
                onAllRead={() => setUnreadCount(0)}
                onRead={() => setUnreadCount(prev => Math.max(0, prev - 1))}
                localNotifs={localNotifs}
                onLocalRead={(id) => setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))}
                onLocalAllRead={() => setLocalNotifs(prev => prev.map(n => ({ ...n, isRead: true })))}
                onLocalDelete={(id) => setLocalNotifs(prev => prev.filter(n => n.id !== id))}
                onDbDelete={(id) => setUnreadCount(prev => Math.max(0, prev - 1))}
                onNotifNavigate={(tab, mode) => { setView(tab); if (mode) setSearchMode(mode); setShowNotifs(false); }}
              />
            )}
          </div>
          <button onClick={onSettings} style={{ background: 'none', border: 'none', padding: 8, color: '#1A1611', cursor: 'pointer' }}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Search controls — only in search view */}
      <div style={{ display: view === 'search' ? 'block' : 'none', padding: '14px 16px 0', background: '#FAF7F2' }}>

          {/* Mode toggle */}
          <SearchModeToggle mode={searchMode} onMode={setSearchMode} t={t} />

          {/* Quick search bar */}
          {searchMode === 'quick' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, position: 'relative' }} ref={inputWrapperRef}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, background: '#FFFFFF', border: '1px solid #D8D0BE', borderRadius: showHistory ? '4px 4px 0 0' : 4, padding: '6px 10px', minHeight: 40, position: 'relative' }}>
                  <Search size={14} style={{ color: '#6B6358', flexShrink: 0 }} />
                  {keywords.map(kw => (
                    <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1A1611', color: '#FAF7F2', padding: '2px 8px', borderRadius: 12, fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 500 }}>
                      {kw}
                      <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))} style={{ background: 'none', border: 'none', padding: 0, color: '#FAF7F2', cursor: 'pointer', lineHeight: 0 }}><X size={10} /></button>
                    </span>
                  ))}
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowHistory(true)}
                    placeholder={keywords.length === 0 ? ts.placeholder : '+ add keyword...'}
                    style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', padding: '2px 0' }}
                  />
                  {(query || keywords.length > 0) && (
                    <button onClick={handleClear} style={{ background: 'none', border: 'none', padding: 2, color: '#6B6358', lineHeight: 0 }}><X size={14} /></button>
                  )}

                  {showHistory && keywords.length === 0 && !query && (
                    <SearchHistoryDropdown
                      userId={userId}
                      onSelect={handleHistorySelect}
                      onClose={() => setShowHistory(false)}
                    />
                  )}
                </div>
                <button
                  onClick={handleSearchClick}
                  disabled={(!query.trim() && keywords.length === 0) || searchState === 'loading'}
                  style={{ padding: '0 16px', background: (query.trim() || keywords.length > 0) ? '#1A1611' : '#D8D0BE', color: '#FAF7F2', border: 'none', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500, cursor: (query.trim() || keywords.length > 0) ? 'pointer' : 'default', transition: 'background 0.15s', whiteSpace: 'nowrap' }}>
                  {ts.searchBtn}
                </button>
              </div>

              {/* Period pills */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {['week', 'month', 'threeMonths', 'lastNMonths', 'custom', 'all'].map(p => (
                  <button key={p} onClick={() => { setPeriod(p); setPage(1); }} style={{ padding: '5px 10px', background: period === p ? '#1A1611' : 'transparent', color: period === p ? '#FAF7F2' : '#6B6358', border: '1px solid ' + (period === p ? '#1A1611' : '#D8D0BE'), borderRadius: 20, fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: period === p ? 600 : 400, whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {ts.periods[p]}
                  </button>
                ))}
              </div>

              {period === 'lastNMonths' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>{ts.fromLabel.toLowerCase()}</span>
                  <input type="number" min={1} max={60} value={nMonths} onChange={e => setNMonths(Math.max(1, Math.min(60, Number(e.target.value))))} style={nMonthsInputStyle} />
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358' }}>{ts.nMonthsLabel}</span>
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
            </>
          )}
        </div>

      {/* Content area */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Reels tab — full-height, kept mounted (display toggle) so state &
            scroll position survive switching tabs, like the other views. */}
        <div style={{ display: view === 'reels' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
          <ReelsView
            onComplete={() => addLocalNotif(lang === 'ko' ? '릴스 피드 로드됨' : 'Reels feed loaded', 'reels', null)}
          />
        </div>

        <div ref={scrollRef} style={{ display: view === 'reels' ? 'none' : 'block', flex: 1, overflowY: 'auto', padding: '0 16px 80px', background: '#FAF7F2' }}>

          {/* Trending tab */}
          <div style={{ display: view === 'trending' ? 'block' : 'none' }}>
            <TrendingFeed
              onQuickSearch={handleQuickSearch}
              onComplete={() => addLocalNotif(lang === 'ko' ? '트렌딩 논문 로드됨' : 'Trending papers loaded', 'trending', null)}
            />
          </div>

          {/* My Feed tab */}
          <div style={{ display: view === 'myFeed' ? 'block' : 'none' }}>
            <MyFeedView
              userId={userId}
              refreshKey={myFeedRefreshKey}
              papersRefreshKey={myFeedPapersKey}
              onCheckDone={fetchUnreadCount}
              onComplete={() => addLocalNotif(lang === 'ko' ? '내 피드 업데이트됨' : 'My Feed updated', 'myFeed', null)}
            />
          </div>

          {/* Venues tab */}
          <div style={{ display: view === 'venues' ? 'block' : 'none' }}>
            <VenuesView
              onComplete={(venue, year) => addLocalNotif(lang === 'ko' ? `${venue} ${year} 논문 로드됨` : `${venue} ${year} papers loaded`, 'venues', null)}
            />
          </div>

          {/* Search tab */}
          <div style={{ display: view === 'search' ? 'block' : 'none' }}>
            <div style={{ display: searchMode === 'learning' ? 'block' : 'none', paddingTop: 8 }}>
              <LearningPath
                userId={userId}
                onBack={() => setSearchMode('quick')}
                onComplete={(topic) => addLocalNotif(lang === 'ko' ? `학습 경로: "${topic}" 완료` : `Learning Path: "${topic}" ready`, 'search', 'learning')}
                embedded
              />
            </div>

            <div style={{ display: searchMode === 'lineage' ? 'block' : 'none', paddingTop: 8 }}>
              <CitationGraph
                embedded
                onBack={() => setSearchMode('quick')}
                onComplete={(q) => addLocalNotif(lang === 'ko' ? `인용 계보: "${q}" 완료` : `Research Lineage: "${q}" ready`, 'search', 'lineage')}
              />
            </div>

            <div style={{ display: searchMode === 'network' ? 'block' : 'none', paddingTop: 8 }}>
              <ResearcherNetwork
                embedded
                onBack={() => setSearchMode('quick')}
                onComplete={(q) => addLocalNotif(lang === 'ko' ? `연구자 네트워크: "${q}" 완료` : `Researcher Network: "${q}" ready`, 'search', 'network')}
              />
            </div>

            <div style={{ display: searchMode === 'quick' ? 'block' : 'none' }}>
              <>
                <>
                  {searchState === 'idle' && (
                    <div style={{ padding: '32px 8px 0', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                        {['reasoning', 'RAG', 'diffusion model', 'fine-tuning', 'multimodal', 'AI agent', 'LoRA', 'transformer', 'RLHF', 'MoE'].map(kw => (
                          <button key={kw} onClick={() => handleSuggestion(kw)} style={{ padding: '7px 14px', background: '#FFFFFF', border: '1px solid #D8D0BE', borderRadius: 20, fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', cursor: 'pointer' }}>
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchState === 'loading' && (
                    <div>
                      <SearchProgress lang={lang} elapsed={elapsed} sourceStatus={sourceStatus} papersSourceLabel={papersSourceLabel} />
                      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                        <button onClick={handleCancelSearch} style={{ background: 'none', border: '1px solid #D8D0BE', borderRadius: 4, padding: '7px 18px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer' }}>
                          {lang === 'ko' ? '취소' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}

                  {searchState === 'done' && (
                    <>
                      <button onClick={handleClear} style={{ background: 'none', border: 'none', padding: '8px 4px 4px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ← {ts.backToFeed}
                      </button>

                      <SourceErrorBanner sourceErrors={sourceErrors} lang={lang} />

                      {/* Topic / Author toggle */}
                      <div style={{ display: 'flex', gap: 0, background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: 3, marginBottom: 12 }}>
                        {[
                          { key: 'topic', label: ts.queryTypeTopic },
                          { key: 'author', label: ts.queryTypeAuthor },
                        ].map(({ key, label }) => {
                          const active = queryType === key;
                          return (
                            <button
                              key={key}
                              onClick={() => key === 'author' ? handleAuthorSwitch() : setQueryType('topic')}
                              style={{ flex: 1, padding: '7px 12px', background: active ? '#1A1611' : 'transparent', color: active ? '#FAF7F2' : '#6B6358', border: 'none', borderRadius: 2, fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Author mode content */}
                      {isAuthorMode && (
                        authorLoading ? (
                          <div style={{ padding: '40px 8px 0' }}>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#1A1611', fontStyle: 'italic', textAlign: 'center', marginBottom: 28 }}>
                              {lang === 'ko' ? '검색 중…' : 'Searching…'}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #D8D0BE', background: '#FAF7F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: '#C8C0B0', fontSize: 20 }}>·</span>
                                </div>
                                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', textAlign: 'center', maxWidth: 80 }}>Semantic Scholar</span>
                              </div>
                            </div>
                          </div>
                        ) : authorStep === 'candidates' ? (
                          /* ── Candidate list ── */
                          authorCandidates.length === 0 ? (
                            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#1A1611', fontStyle: 'italic' }}>
                                {ts.authorNotFound(searchResults?.keyword || '')}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 12 }}>
                                {ts.authorCandidatesHeader.toUpperCase()}
                              </div>
                              {authorCandidates.map(author => (
                                <button
                                  key={author.id}
                                  onClick={() => handleSelectAuthor(author)}
                                  style={{ width: '100%', textAlign: 'left', background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: '14px 18px', marginBottom: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
                                >
                                  <div>
                                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 500, color: '#1A1611', marginBottom: 4 }}>{author.name}</div>
                                    <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358' }}>
                                      {ts.authorPaperCount(author.paper_count)} · {ts.citations(author.citation_count)}
                                    </div>
                                  </div>
                                  <span style={{ color: '#9B9185', fontSize: 16, flexShrink: 0 }}>›</span>
                                </button>
                              ))}
                            </>
                          )
                        ) : (
                          /* ── Papers for selected author ── */
                          <>
                            <button
                              onClick={() => { setAuthorStep('candidates'); setAuthorResults(null); setPage(1); }}
                              style={{ background: 'none', border: 'none', padding: '0 0 10px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer' }}>
                              {ts.authorBackToCandidates}
                            </button>

                            {authorResults && (
                              <>
                                <div style={{ margin: '0 0 4px', padding: '10px 14px', background: '#FFFFFF', borderLeft: '3px solid #C84B31', borderRadius: '0 4px 4px 0' }}>
                                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 4 }}>AUTHOR</div>
                                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 600, color: '#1A1611' }}>{authorResults.author?.name}</div>
                                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', marginTop: 2 }}>
                                    {ts.authorPaperCount(tabItems.length)}
                                  </div>
                                </div>
                                {isAuthorCached && (
                                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '0 0 8px', textAlign: 'right' }}>
                                    ⚡ cached result
                                  </p>
                                )}

                                <TabBar activeTab="paper" counts={tabCounts} onTab={() => {}} perPage={perPage} onPerPage={handlePerPage} ts={ts} authorOnly />

                                {pageItems.length === 0 ? (
                                  <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#1A1611', fontStyle: 'italic' }}>
                                      {ts.noResults(authorResults.author?.name || '')}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="card-grid">
                                    {pageItems.map((item, i) => (
                                      <PaperCard key={`author-${pageStart + i}`} item={item} type="paper" showCite showCode summary={paperSummaries[item.title]} summaryLoading={!!summaryLoading[item.title]} summaryNoKey={!!paperNoKey[item.title]} onSummarize={() => fetchPaperSummary(item.title, item.abstract)} />
                                    ))}
                                  </div>
                                )}
                                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
                              </>
                            )}
                          </>
                        )
                      )}

                      {/* Topic mode content */}
                      {!isAuthorMode && (
                        <>
                          {isTopicCached && (
                            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '0 0 8px', textAlign: 'right' }}>
                              ⚡ cached result
                            </p>
                          )}
                          {/* Topic label */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 2 }}>
                              {ts.topicLabel}
                            </div>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontStyle: 'italic', color: '#1A1611' }}>
                              {searchResults?.keyword}
                            </div>
                          </div>

                          {/* AI Overview */}
                          <div style={{ margin: '4px 0 16px', padding: '12px 16px', background: '#FFFFFF', borderLeft: '3px solid #C84B31', borderRadius: '0 4px 4px 0' }}>
                            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 8 }}>OVERVIEW</div>
                            {overviewText ? (
                              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', lineHeight: 1.6, margin: 0 }}>{overviewText}</p>
                            ) : overviewNoKey ? (
                              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{ts.noApiKeyOverview}</p>
                            ) : overviewError ? (
                              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#C84B31', lineHeight: 1.6, margin: 0 }}>{ts.overviewError}</p>
                            ) : overviewLoading ? (
                              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', fontStyle: 'italic', margin: 0 }}>{ts.aiLoading}</p>
                            ) : (
                              <button onClick={fetchOverview} style={{ background: 'none', border: '1px solid #D8D0BE', borderRadius: 3, padding: '5px 12px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer' }}>
                                {ts.aiOverviewBtn}
                              </button>
                            )}
                          </div>

                          <TabBar activeTab={activeTab} counts={tabCounts} onTab={handleTab} perPage={perPage} onPerPage={handlePerPage} ts={ts} />

                          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185', marginBottom: 10, padding: '0 2px' }}>
                            {ts.resultsFor(tabItems.length, searchResults?.keyword || '')}
                          </div>

                          {pageItems.length === 0 ? (
                            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#1A1611', fontStyle: 'italic' }}>
                                {ts.noResults(searchResults?.keyword || '')}
                              </div>
                            </div>
                          ) : (
                            <div className="card-grid">
                              {pageItems.map((item, i) => {
                                const title = item.title || item.name || '';
                                return (
                                  <PaperCard key={`${activeTab}-${pageStart + i}`} item={item} type={activeTab} showCite showCode summary={paperSummaries[title]} summaryLoading={!!summaryLoading[title]} summaryNoKey={!!paperNoKey[title]} onSummarize={() => fetchPaperSummary(title, item.abstract)} />
                                );
                              })}
                            </div>
                          )}

                          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
                        </>
                      )}
                    </>
                  )}

                  {searchState === 'error' && (
                    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#C84B31', fontStyle: 'italic', marginBottom: 12 }}>{ts.searchError}</div>
                      <button onClick={handleClear} style={{ background: 'none', border: '1px solid #D8D0BE', padding: '8px 16px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer', borderRadius: 4 }}>
                        ← {ts.backToFeed}
                      </button>
                    </div>
                  )}
                </>
              </>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll buttons — not shown in reels (it has its own snap scroll) */}
      {view !== 'reels' && (
      <div style={{ position: 'absolute', bottom: 68, right: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
        <button onClick={scrollToTop} title={ts.scrollTop} style={scrollBtnStyle}><ChevronUp size={14} /></button>
        <button onClick={scrollToBottom} title={ts.scrollBottom} style={scrollBtnStyle}><ChevronDown size={14} /></button>
      </div>
      )}

      {/* Bottom navigation */}
      <BottomNav view={view} onView={(v) => { setView(v); if (scrollRef.current) scrollRef.current.scrollTop = 0; }} t={t} />
    </div>
  );
}

const monthInputStyle = { padding: '5px 8px', border: '1px solid #D8D0BE', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#1A1611', background: '#FFFFFF', outline: 'none' };
const nMonthsInputStyle = { width: 56, padding: '5px 8px', border: '1px solid #D8D0BE', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', background: '#FFFFFF', outline: 'none', textAlign: 'center' };
const scrollBtnStyle = { width: 32, height: 32, background: '#FFFFFF', border: '1px solid #D8D0BE', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B6358', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
