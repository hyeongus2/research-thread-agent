'use client';

import { useState } from 'react';
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
function ResultCard({ item, type }) {
  const { t, lang } = useLanguage();
  const ts = t.search;
  const colors = TYPE_COLORS[type];
  const typeLabel = { paper: 'PAPER', model: 'MODEL', repo: 'REPO' }[type];
  const relevance = Math.round((item.relevance_score || 0) * 100);

  const title = item.title || item.name || '';
  const summary = item.summary || item.abstract?.slice(0, 200) || item.description || '';
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
        marginBottom: summary ? 10 : 0,
      }}>
        {title}
      </h3>

      {summary && (
        <p style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
          lineHeight: 1.5,
          color: '#3A342B',
          margin: 0,
          marginBottom: meta ? 10 : 0,
        }}>
          {summary}
        </p>
      )}

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

// =============================================================================
// Empty state — shown before any search
// =============================================================================
function EmptyFeed({ onSuggestionClick }) {
  const { t } = useLanguage();
  const tf = t.feed;
  const suggestions = ['RAG', 'diffusion', 'LoRA', 'reasoning', 'VLM'];

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
  const [period, setPeriod] = useState('month');
  const [nMonths, setNMonths] = useState(6);
  const [customFrom, setCustomFrom] = useState(() => toYearMonth(new Date(new Date().setMonth(new Date().getMonth() - 6))));
  const [customTo, setCustomTo] = useState(() => toYearMonth(new Date()));
  const [typeFilters, setTypeFilters] = useState(['paper', 'model', 'repo']);
  const [searchState, setSearchState] = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [searchResults, setSearchResults] = useState(null);

  const toggleType = (type) =>
    setTypeFilters(prev =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter(t => t !== type) : prev) : [...prev, type]
    );

  const handleSearch = async (overrideQuery) => {
    const kw = (overrideQuery || query).trim();
    if (!kw) return;
    if (overrideQuery) setQuery(overrideQuery);
    setSearchState('loading');
    const { start, end } = getPeriodDates(period, nMonths, customFrom, customTo);
    try {
      const res = await fetch(`${API}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kw,
          start_date: start,
          end_date: end,
          info_types: typeFilters,
          user_id: userId || 1,
        }),
      });
      const data = await res.json();
      setSearchResults(data);
      setSearchState('done');
    } catch {
      setSearchState('error');
    }
  };

  const handleClear = () => {
    setQuery('');
    setSearchState('idle');
    setSearchResults(null);
  };

  // Merge and sort all search results by relevance
  const allResults = searchState === 'done' && searchResults
    ? [
        ...(searchResults.papers || []).map(p => ({ ...p, _type: 'paper' })),
        ...(searchResults.models || []).map(m => ({ ...m, _type: 'model' })),
        ...(searchResults.repos  || []).map(r => ({ ...r, _type: 'repo' })),
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
            gap: 8,
            background: '#FFFFFF',
            border: '1px solid #D8D0BE',
            borderRadius: 4,
            padding: '0 12px',
          }}>
            <Search size={14} style={{ color: '#6B6358', flexShrink: 0 }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={ts.placeholder}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                color: '#1A1611',
                padding: '10px 0',
              }}
            />
            {query && (
              <button onClick={handleClear} style={{ background: 'none', border: 'none', padding: 2, color: '#6B6358', lineHeight: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || searchState === 'loading'}
            style={{
              padding: '0 16px',
              background: query.trim() ? '#1A1611' : '#D8D0BE',
              color: '#FAF7F2',
              border: 'none',
              borderRadius: 4,
              fontFamily: "'Geist', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: query.trim() ? 'pointer' : 'default',
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
          <EmptyFeed onSuggestionClick={(kw) => handleSearch(kw)} />
        )}

        {/* ── Loading ── */}
        {searchState === 'loading' && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#1A1611', fontStyle: 'italic' }}>
              {ts.loading}
            </div>
          </div>
        )}

        {/* ── Search results ── */}
        {searchState === 'done' && (
          <>
            {/* Overview */}
            {searchResults?.overview && (
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
                <p style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  color: '#1A1611',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {searchResults.overview}
                </p>
              </div>
            )}

            {/* Result count */}
            <div style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 11,
              color: '#6B6358',
              letterSpacing: '0.08em',
              marginBottom: 12,
              padding: '0 4px',
            }}>
              {ts.resultsFor(allResults.length, searchResults?.keyword || query)}
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
                <ResultCard key={`${item._type}-${i}`} item={item} type={item._type} />
              ))
            )}
          </>
        )}

        {/* ── Error ── */}
        {searchState === 'error' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#C84B31', fontStyle: 'italic' }}>
              Search failed. Check your API keys and server.
            </div>
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
