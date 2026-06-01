'use client';

import { useEffect, useState, useRef } from 'react';
import { ExternalLink, Sparkles, Heart, Bookmark } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

function fmtAuthors(authors) {
  if (!authors || !authors.length) return '';
  if (authors.length <= 3) return authors.join(', ');
  return `${authors.slice(0, 3).join(', ')} +${authors.length - 3}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// Single full-height reel card
// =============================================================================
function ReelCard({ paper, isFirst, figureUrl }) {
  const { lang } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryNoKey, setSummaryNoKey] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const abstractText = paper.abstract || paper.summary || '';
  const hasLongAbstract = abstractText.length > 220;

  const generateSummary = async () => {
    if (summary || summaryLoading || summaryNoKey) return;
    setSummaryLoading(true);
    try {
      const r = await fetch(`${API}/summarize/paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abstract: abstractText, lang }),
      });
      const d = await r.json();
      if (d.no_api_key) setSummaryNoKey(true);
      else if (d.summary) {
        setSummary(d.summary);
        // auto-expand the sheet so the user sees the summary they just asked for
        setExpanded(true);
      }
    } catch {
      // leave summary unset so the user can retry
    } finally {
      setSummaryLoading(false);
    }
  };

  const arxivUrl = paper.arxiv_id
    ? `https://arxiv.org/abs/${paper.arxiv_id}`
    : (paper.url || '#');

  // Prefer ar5iv-extracted Figure 1; fall back to HF Daily Papers thumbnail
  // (which is usually a PDF-first-page screenshot). If the chosen image fails
  // to load (404, blocked, etc.), fall back further.
  const primaryImg = figureUrl || paper.thumbnail;
  const showThumb = primaryImg && !imgFailed;
  const imgSource = figureUrl ? 'ar5iv' : (paper.thumbnail ? 'preview' : null);

  // If a better source arrives after we already failed (e.g. HF thumb 404'd
  // but ar5iv URL came later), give the new src a fresh chance.
  useEffect(() => { setImgFailed(false); }, [primaryImg]);

  return (
    <div style={{
      height: '100%',
      minHeight: '100%',
      scrollSnapAlign: 'start',
      scrollSnapStop: 'always',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 22px 96px',
      boxSizing: 'border-box',
      position: 'relative',
      background: 'linear-gradient(180deg, #FAF7F2 0%, #F2EDE3 100%)',
      overflow: 'hidden',
    }}>
      {/* Top meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358',
        letterSpacing: '0.06em', flexShrink: 0,
      }}>
        <span style={{ background: '#FFE8E0', color: '#8B2E1B', padding: '3px 9px', borderRadius: 12, fontWeight: 600, letterSpacing: '0.1em' }}>
          HF DAILY
        </span>
        {paper.upvotes != null && paper.upvotes > 0 && (
          <span style={{ padding: '3px 4px' }}>▲ {paper.upvotes}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>{fmtDate(paper.published_at || paper.published_date)}</span>
      </div>

      {/* Figure / thumbnail — now the dominant visual */}
      {showThumb && (
        <div style={{
          width: '100%',
          flex: '1 1 auto',
          minHeight: 0,
          background: '#FFFFFF',
          borderRadius: 14,
          marginBottom: 14,
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid #E8E2D5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={primaryImg}
            alt={`Figure from ${paper.title}`}
            loading="lazy"
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <div style={{
            position: 'absolute', bottom: 6, right: 8,
            background: 'rgba(26,22,17,0.72)', color: '#FAF7F2',
            padding: '2px 8px', borderRadius: 10, fontSize: 9,
            fontFamily: "'Geist', sans-serif", letterSpacing: '0.05em',
          }}>
            {paper.arxiv_id ? `arXiv:${paper.arxiv_id}` : 'figure'}
            {imgSource === 'ar5iv' && ' · Fig 1'}
          </div>
        </div>
      )}

      {/* Title — compact below figure */}
      <h2 style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 19,
        fontWeight: 500,
        color: '#1A1611',
        lineHeight: 1.22,
        margin: '0 0 6px',
        letterSpacing: '-0.015em',
        flexShrink: 0,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {paper.title}
      </h2>

      {/* Authors */}
      <div style={{
        fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358',
        marginBottom: 4, flexShrink: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {fmtAuthors(paper.authors)}
      </div>

      {/* Backdrop dim when sheet is expanded — click to close */}
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(26,22,17,0.35)',
            transition: 'opacity 0.3s',
            zIndex: 5,
          }}
        />
      )}

      {/* Abstract sheet — slides up from bottom, covers figure when expanded */}
      <div style={{
        position: 'absolute',
        left: 22,
        right: 22,
        bottom: 88,
        height: expanded ? 'calc(100% - 100px)' : 130,
        maxHeight: 'calc(100% - 100px)',
        background: '#FAF7F2',
        border: '1px solid #E8E2D5',
        borderRadius: 14,
        padding: '14px 16px 16px',
        boxSizing: 'border-box',
        boxShadow: expanded
          ? '0 -8px 28px rgba(26,22,17,0.12)'
          : '0 -2px 10px rgba(26,22,17,0.04)',
        transition: 'height 0.38s cubic-bezier(0.32, 0.72, 0.2, 1), box-shadow 0.35s',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}>
        {/* Drag handle / close indicator */}
        <div
          onClick={() => setExpanded(v => !v)}
          style={{
            width: 36, height: 4, background: '#D8D0BE', borderRadius: 2,
            margin: '0 auto 10px', cursor: 'pointer', flexShrink: 0,
          }}
        />

        {/* Sheet content */}
        <div style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 14,
          lineHeight: 1.55,
          color: '#3A332A',
          flex: 1,
          minHeight: 0,
          overflowY: expanded ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingRight: 4,
        }}>
          {summary ? (
            <div>
              <div style={{ fontSize: 10, color: '#1B3E8B', letterSpacing: '0.15em', marginBottom: 6, fontWeight: 600 }}>
                ✦ AI SUMMARY
              </div>
              {summary}
            </div>
          ) : (
            <div>{abstractText}</div>
          )}
        </div>

        {/* Bottom fade + "more" affordance when collapsed */}
        {!expanded && hasLongAbstract && (
          <>
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 32, height: 32,
              background: 'linear-gradient(180deg, rgba(250,247,242,0) 0%, #FAF7F2 100%)',
              pointerEvents: 'none',
            }} />
            <button
              onClick={() => setExpanded(true)}
              style={{
                position: 'absolute', left: 16, right: 16, bottom: 10,
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: "'Geist', sans-serif", fontSize: 11,
                color: '#1B3E8B', letterSpacing: '0.1em', fontWeight: 600,
                padding: 0,
              }}
            >
              more ↑
            </button>
          </>
        )}
      </div>

      {/* Action bar pinned to card bottom — always above the sheet */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        position: 'absolute', left: 22, right: 22, bottom: 24,
        zIndex: 20,
      }}>
        <a href={arxivUrl} target="_blank" rel="noopener noreferrer" style={{
          flex: 1, padding: '12px 14px', background: '#1A1611', color: '#FAF7F2',
          borderRadius: 24, textDecoration: 'none', fontFamily: "'Geist', sans-serif",
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6,
        }}>
          <ExternalLink size={14} /> Read
        </a>

        <button onClick={generateSummary} disabled={summaryLoading} title="AI summary" style={{
          padding: '12px 14px', background: 'transparent', color: '#1A1611',
          border: '1px solid #1A1611', borderRadius: 24, fontFamily: "'Geist', sans-serif",
          fontSize: 13, fontWeight: 600, cursor: summaryLoading ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          <Sparkles size={14} />
          {summaryLoading ? '…' : (summaryNoKey ? 'key?' : 'AI')}
        </button>

        <button onClick={() => setLiked(v => !v)} aria-label="like" style={{
          width: 42, height: 42, padding: 0, background: 'transparent',
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Heart size={22} fill={liked ? '#C84B31' : 'none'} color={liked ? '#C84B31' : '#1A1611'} />
        </button>

        <button onClick={() => setSaved(v => !v)} aria-label="save" style={{
          width: 42, height: 42, padding: 0, background: 'transparent',
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Bookmark size={22} fill={saved ? '#1A1611' : 'none'} color="#1A1611" />
        </button>
      </div>

      {/* First-card swipe hint */}
      {isFirst && !expanded && (
        <div style={{
          position: 'absolute', bottom: 230, left: '50%', transform: 'translateX(-50%)',
          fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185',
          letterSpacing: '0.1em', animation: 'reelHint 1.6s ease-in-out infinite',
          pointerEvents: 'none', zIndex: 15,
        }}>
          ↑ swipe up
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Reels container — vertical snap-scroll over trending papers
// =============================================================================
export default function ReelsView() {
  const { lang } = useLanguage();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(0);
  const [figures, setFigures] = useState({}); // { arxiv_id: url | null }
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/feed/trending?period=monthly`);
        if (!r.ok) throw new Error('failed');
        const d = await r.json();
        if (!cancelled) setPapers(d.papers || []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Background-fetch the real Figure 1 for each paper via ar5iv.
  // Concurrency-limited so we don't slam the backend (which calls out to ar5iv).
  // Earlier cards are prioritized — they'll be seen first.
  useEffect(() => {
    if (!papers.length) return;
    let cancelled = false;
    const ids = papers.map(p => p.arxiv_id).filter(Boolean);
    if (!ids.length) return;

    const MAX_CONCURRENT = 3;
    let cursor = 0;

    const runNext = async () => {
      if (cancelled) return;
      const i = cursor++;
      if (i >= ids.length) return;
      const id = ids[i];
      try {
        const r = await fetch(`${API}/figure/${encodeURIComponent(id)}`);
        const d = await r.json();
        if (!cancelled && d && d.figure_url) {
          setFigures(prev => ({ ...prev, [id]: d.figure_url }));
        }
      } catch {
        // Silent; HF thumbnail will continue to be used for this card.
      }
      runNext();
    };

    for (let i = 0; i < Math.min(MAX_CONCURRENT, ids.length); i++) {
      runNext();
    }
    return () => { cancelled = true; };
  }, [papers]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const h = el.clientHeight || 1;
      setIdx(Math.round(el.scrollTop / h));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [papers.length]);

  const centerMsg = (msg) => (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358',
      fontStyle: 'italic', padding: 24, textAlign: 'center',
    }}>{msg}</div>
  );

  if (loading) return centerMsg(lang === 'ko' ? '릴스 불러오는 중…' : 'Loading reels…');
  if (error) return centerMsg(lang === 'ko' ? '논문을 불러오지 못했습니다.' : 'Could not load papers.');
  if (!papers.length) return centerMsg(lang === 'ko' ? '표시할 논문이 없습니다.' : 'No papers to show.');

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <style>{`
        @keyframes reelHint {
          0%, 100% { opacity: 0.4; transform: translateX(-50%) translateY(0); }
          50%      { opacity: 1;   transform: translateX(-50%) translateY(-6px); }
        }
        .reels-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        ref={containerRef}
        className="reels-scroll"
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {papers.map((p, i) => (
          <ReelCard
            key={p.arxiv_id || p.title || i}
            paper={p}
            isFirst={i === 0}
            figureUrl={p.arxiv_id ? figures[p.arxiv_id] : null}
          />
        ))}
      </div>

      {/* Progress pill */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(250,247,242,0.85)', backdropFilter: 'blur(4px)',
        padding: '5px 12px', borderRadius: 20, fontFamily: "'Geist', sans-serif",
        fontSize: 11, color: '#6B6358', letterSpacing: '0.1em',
        border: '1px solid #E8E2D5', pointerEvents: 'none',
      }}>
        {Math.min(idx + 1, papers.length)} / {papers.length}
      </div>
    </div>
  );
}
