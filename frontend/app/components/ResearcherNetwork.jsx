'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000/api` : 'http://localhost:8000/api';

// Display caps (frontend subset of backend nodes/edges)
const GRAPH_MAX_COLLABORATORS = 30;

const CURRENT_YEAR = new Date().getFullYear();

// SVG canvas
const SVG_W = 640;
const SVG_H = 520;
const CENTER = { x: SVG_W / 2, y: SVG_H / 2 };
const ROOT_R = 26;

const HINT_KEYS = {
  strong_collaborator: 'strongCollaborator',
  possible_mentor_trainee_pattern: 'possibleMentorTrainee',
  high_impact_collaboration: 'highImpact',
  same_affiliation_overlap: 'sameAffiliation',
};

function truncate(str, len = 20) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// Radial layout: root at center, collaborators on one or two rings.
// In two-ring mode the inner ring is offset by half a step so inner and outer
// nodes never align on the same ray from the root (avoids fake "same line").
function computeRadialLayout(edges) {
  const positions = { __root__: CENTER };
  const n = edges.length;
  if (n === 0) return positions;

  const ringMargin = 70;
  const outerR = Math.min(SVG_W, SVG_H) / 2 - ringMargin;
  const twoRings = n > 16;
  const innerR = outerR * 0.62;
  const place = (target, r, angle) => {
    positions[target] = { x: CENTER.x + r * Math.cos(angle), y: CENTER.y + r * Math.sin(angle) };
  };

  if (!twoRings) {
    edges.forEach((e, i) => place(e.target, outerR, (i / n) * 2 * Math.PI - Math.PI / 2));
    return positions;
  }

  const outerCount = Math.ceil(n / 2);
  const innerCount = Math.floor(n / 2);
  edges.forEach((e, i) => {
    if (i % 2 === 0) {
      place(e.target, outerR, ((i / 2) / outerCount) * 2 * Math.PI - Math.PI / 2);
    } else {
      place(e.target, innerR, (((i - 1) / 2 + 0.5) / innerCount) * 2 * Math.PI - Math.PI / 2);
    }
  });
  return positions;
}

function nodeRadius(sharedCount, maxShared) {
  const t = maxShared > 0 ? sharedCount / maxShared : 0;
  return 9 + t * 11; // 9..20
}

function edgeWidth(sharedCount, maxShared) {
  const t = maxShared > 0 ? sharedCount / maxShared : 0;
  return 1.5 + t * 6; // 1.5..7.5
}

export default function ResearcherNetwork({ embedded, onBack, onComplete }) {
  const { t, lang } = useLanguage();
  const ts = t.search;
  const rn = ts.researcherNetwork;

  const [name, setName] = useState('');
  const [searchedName, setSearchedName] = useState(''); // displayed as chip after search
  const [minShared, setMinShared] = useState(2);
  const [maxCollab, setMaxCollab] = useState(20);
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');

  const [buildState, setBuildState] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [selectedTarget, setSelectedTarget] = useState(null); // collaborator node id
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef(null);
  const inputWrapRef = useRef(null);
  // In-memory cache (per name + filters); survives until the app/tab is closed.
  const cacheRef = useRef({});

  const cacheKeyFor = (p) =>
    `${(p.name || '').trim().toLowerCase()}:${Number(p.minShared) || 1}:${Number(p.maxCollab) || 20}:${p.yearStart || ''}-${p.yearEnd || ''}`;

  const loadHistory = async () => {
    try {
      const r = await fetch(`${API}/researcher-network/history`);
      setHistory(await r.json());
    } catch { setHistory([]); }
  };

  const deleteHistory = async (topic, e) => {
    e.stopPropagation();
    try { await fetch(`${API}/researcher-network/history?topic=${encodeURIComponent(topic)}`, { method: 'DELETE' }); } catch {}
    setHistory(h => (h || []).filter(item => item.topic !== topic));
    // Also evict from in-memory cache: topic = "network::min:N:max:N:years:...:name:<name>"
    const nameMatch = topic.match(/:name:(.+)$/);
    if (nameMatch) {
      const namePrefix = nameMatch[1].toLowerCase();
      Object.keys(cacheRef.current).forEach(k => {
        if (k.startsWith(namePrefix + ':')) delete cacheRef.current[k];
      });
    }
  };

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCancel = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setBuildState('idle');
  };

  const runBuild = async (params) => {
    const root = (params.name || '').trim();
    if (!root) return;
    setSearchedName(root);
    setName('');
    setMinShared(params.minShared);
    setMaxCollab(params.maxCollab);
    setYearStart(params.yearStart);
    setYearEnd(params.yearEnd);
    setShowHistory(false);

    // In-memory cache hit: render instantly, no fetch, no loading state.
    const key = cacheKeyFor(params);
    if (cacheRef.current[key]) {
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      setResult(cacheRef.current[key]);
      setSelectedTarget(null);
      setActiveTab('graph');
      setBuildState('done');
      if (onComplete) onComplete(root);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBuildState('loading');
    setResult(null);
    setSelectedTarget(null);
    setActiveTab('graph');
    try {
      const res = await fetch(`${API}/researcher-network`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_author_name: root,
          min_shared_papers: Number(params.minShared) || 1,
          max_collaborators: Number(params.maxCollab) || 20,
          year_start: params.yearStart ? Number(params.yearStart) : null,
          year_end: params.yearEnd ? Number(params.yearEnd) : null,
          max_papers: 100,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cacheRef.current[key] = data;
      setResult(data);
      setBuildState('done');
      loadHistory();
      if (onComplete) onComplete(root);
    } catch (err) {
      if (err?.name !== 'AbortError') setBuildState('error');
    } finally {
      abortRef.current = null;
    }
  };

  const handleBuild = () => runBuild({ name, minShared, maxCollab, yearStart, yearEnd });

  const allEdges = result?.edges || [];
  const graphEdges = allEdges.slice(0, GRAPH_MAX_COLLABORATORS);
  const nodeById = Object.fromEntries((result?.nodes || []).map(n => [n.id, n]));
  const rootNode = (result?.nodes || []).find(n => n.isRoot) || null;
  const maxShared = Math.max(1, ...allEdges.map(e => e.sharedPaperCount || 0));
  const positions = computeRadialLayout(graphEdges);
  // Collaborator-to-collaborator edges (coauthored within the root's papers).
  const peerEdges = (result?.peerEdges || []).filter(e => positions[e.source] && positions[e.target]);
  const maxPeerShared = Math.max(1, ...peerEdges.map(e => e.sharedPaperCount || 0));

  const selectedEdge = selectedTarget ? allEdges.find(e => e.target === selectedTarget) : null;
  const selectedNode = selectedTarget ? nodeById[selectedTarget] : null;

  const hintLabel = (h) => rn[HINT_KEYS[h]] || h;

  // Sorted collaborators (edges already sorted by backend, but be safe)
  const sortedEdges = [...allEdges].sort((a, b) => (b.sharedPaperCount || 0) - (a.sharedPaperCount || 0));

  return (
    <div style={{ paddingBottom: 40, paddingTop: 8 }}>
      {/* Inputs */}
      <div ref={inputWrapRef} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBuild()}
            onFocus={() => setShowHistory(true)}
            placeholder={rn.placeholder}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #D8D0BE', borderRadius: showHistory && history && history.length > 0 ? '4px 4px 0 0' : 4, fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
          />
          {showHistory && history && history.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#FFFFFF', border: '1px solid #D8D0BE', borderTop: 'none', borderRadius: '0 0 4px 4px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: 240, overflowY: 'auto' }}>
              <div style={{ padding: '8px 12px 4px', fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.12em' }}>
                {rn.recentNetworks}
              </div>
              {history.map(item => (
                <div key={item.topic}
                  style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderTop: '1px solid #F0EAD9' }}
                  onClick={() => runBuild({ name: item.name, minShared: item.min_shared_papers, maxCollab: item.max_collaborators, yearStart: item.year_start ?? '', yearEnd: item.year_end ?? '' })}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAF7F2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ flex: 1, fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <button
                    onClick={(e) => deleteHistory(item.topic, e)}
                    style={{ background: 'none', border: 'none', padding: '2px 4px', color: '#9B9185', cursor: 'pointer', lineHeight: 0, flexShrink: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleBuild}
          disabled={!name.trim() || buildState === 'loading'}
          style={{ padding: '0 16px', background: name.trim() ? '#1A1611' : '#D8D0BE', color: '#FAF7F2', border: 'none', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500, cursor: name.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
        >
          {rn.buildBtn}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <label style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {rn.minSharedPapers}
          <input type="number" min={1} max={50} value={minShared}
            onChange={e => setMinShared(e.target.value)}
            onBlur={e => setMinShared(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
            style={{ width: 70, padding: '5px 8px', border: '1px solid #D8D0BE', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 12 }} />
        </label>
        <label style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {rn.maxCollaborators}
          <input type="number" min={1} max={50} value={maxCollab}
            onChange={e => setMaxCollab(e.target.value)}
            onBlur={e => setMaxCollab(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
            style={{ width: 70, padding: '5px 8px', border: '1px solid #D8D0BE', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 12 }} />
        </label>
        <label style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {rn.yearStart}
          <select value={yearStart} onChange={e => setYearStart(e.target.value)}
            style={{ width: 90, padding: '5px 8px', border: '1px solid #D8D0BE', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 12, background: '#FFFFFF' }}>
            <option value="">—</option>
            {Array.from({ length: CURRENT_YEAR - 1950 + 1 }, (_, i) => CURRENT_YEAR - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {rn.yearEnd}
          <select value={yearEnd} onChange={e => setYearEnd(e.target.value)}
            style={{ width: 90, padding: '5px 8px', border: '1px solid #D8D0BE', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 12, background: '#FFFFFF' }}>
            <option value="">—</option>
            {Array.from({ length: CURRENT_YEAR - 1950 + 1 }, (_, i) => CURRENT_YEAR - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Always-visible warning */}
      <div style={{ background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 4, padding: '8px 12px', marginBottom: 14, fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#7A6A2E', lineHeight: 1.5 }}>
        ⚠ {rn.warning}
      </div>

      {buildState !== 'idle' && searchedName && (
        <>
          {embedded && buildState === 'done' && (
            <button onClick={() => { setBuildState('idle'); setResult(null); setSearchedName(''); }}
              style={{ background: 'none', border: 'none', padding: '0 0 8px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              ← {ts.backToFeed}
            </button>
          )}
          <div style={{ margin: '0 0 12px' }}>
            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 2 }}>
              {lang === 'ko' ? '저자' : 'AUTHOR'}
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontStyle: 'italic', color: '#1A1611' }}>
              {result?.root?.name || searchedName}
            </div>
          </div>
        </>
      )}

      {buildState === 'loading' && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358', fontStyle: 'italic', marginBottom: 16 }}>
            {rn.loading}
          </div>
          <button onClick={handleCancel} style={{ background: 'none', border: '1px solid #D8D0BE', borderRadius: 4, padding: '7px 18px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer' }}>
            {lang === 'ko' ? '취소' : 'Cancel'}
          </button>
        </div>
      )}

      {buildState === 'error' && (
        <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#C84B31' }}>
          {rn.error}
        </div>
      )}

      {buildState === 'done' && allEdges.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#9B9185', lineHeight: 1.6 }}>
          {rn.empty}
        </div>
      )}

      {buildState === 'done' && allEdges.length > 0 && (
        <>
          {result?.cached && (
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '-8px 0 8px', textAlign: 'right' }}>
              ⚡ cached result
            </p>
          )}
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: 3, marginBottom: 14 }}>
            {(() => {
              const sharedPaperCount = selectedTarget && selectedEdge
                ? (selectedEdge.topSharedPapers || []).length
                : (() => { const s = new Set(); sortedEdges.forEach(e => (e.topSharedPapers || []).forEach(p => { if (p.paperId) s.add(p.paperId); })); return s.size; })();
              return [
                { key: 'graph', label: rn.graphTab },
                { key: 'collaborators', label: `${rn.collaboratorsTab} (${allEdges.length})` },
                { key: 'papers', label: `${rn.papersTab} (${sharedPaperCount})` },
              ];
            })().map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ flex: 1, padding: '7px 10px', background: activeTab === key ? '#1A1611' : 'transparent', color: activeTab === key ? '#FAF7F2' : '#6B6358', border: 'none', borderRadius: 2, fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: activeTab === key ? 600 : 400, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Graph tab ── */}
          {activeTab === 'graph' && (
            <>
              <div style={{ overflow: 'auto', maxHeight: 560, border: '1px solid #E8E2D5', borderRadius: 4, background: '#FAFAF8' }}
                onClick={() => setSelectedTarget(null)}>
                <svg width={SVG_W} height={SVG_H} style={{ display: 'block', margin: '0 auto' }}>
                  {/* Peer edges (collaborator ↔ collaborator) — rendered underneath */}
                  {peerEdges.map((e, i) => {
                    const sp = positions[e.source];
                    const tp = positions[e.target];
                    const touchesSel = selectedTarget && (e.source === selectedTarget || e.target === selectedTarget);
                    const dimmed = selectedTarget && !touchesSel;
                    return (
                      <line key={`peer-${i}`}
                        x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                        stroke={touchesSel ? '#9A8A6E' : '#CDBEA8'}
                        strokeWidth={0.5 + (e.sharedPaperCount / maxPeerShared) * 1.8}
                        strokeOpacity={dimmed ? 0.06 : touchesSel ? 0.7 : 0.3}
                        style={{ pointerEvents: 'none' }}>
                        <title>{`${nodeById[e.source]?.name} ↔ ${nodeById[e.target]?.name}: ${e.sharedPaperCount}`}</title>
                      </line>
                    );
                  })}

                  {/* Root → collaborator edges */}
                  {graphEdges.map((e, i) => {
                    const tp = positions[e.target];
                    if (!tp) return null;
                    const isSel = selectedTarget === e.target;
                    const isMentor = (e.relationshipHints || []).includes('possible_mentor_trainee_pattern');
                    return (
                      <line key={i}
                        x1={CENTER.x} y1={CENTER.y} x2={tp.x} y2={tp.y}
                        stroke={isSel ? '#1A1611' : isMentor ? '#B07A2E' : '#6B9FD4'}
                        strokeWidth={edgeWidth(e.sharedPaperCount, maxShared)}
                        strokeOpacity={selectedTarget && !isSel ? 0.2 : 0.6}
                        strokeDasharray={isMentor ? '5 3' : undefined}
                        onClick={ev => { ev.stopPropagation(); setSelectedTarget(e.target); }}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  })}

                  {/* Collaborator nodes */}
                  {graphEdges.map((e, i) => {
                    const tp = positions[e.target];
                    if (!tp) return null;
                    const node = nodeById[e.target];
                    const isSel = selectedTarget === e.target;
                    const r = nodeRadius(e.sharedPaperCount, maxShared);
                    return (
                      <g key={i} transform={`translate(${tp.x},${tp.y})`}
                        onClick={ev => { ev.stopPropagation(); setSelectedTarget(isSel ? null : e.target); }}
                        style={{ cursor: 'pointer', opacity: selectedTarget && !isSel ? 0.4 : 1 }}>
                        <circle r={r} fill="#EEF4FF" stroke={isSel ? '#1A1611' : '#6B9FD4'} strokeWidth={isSel ? 2.5 : 1.5} />
                        <text y={r + 12} textAnchor="middle"
                          style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, fill: '#3A342B', fontWeight: 500 }}>
                          {truncate(node?.name || '', 18)}
                        </text>
                        <text y={3} textAnchor="middle"
                          style={{ fontFamily: "'Geist', sans-serif", fontSize: 9, fill: '#4A6B8A', fontWeight: 600 }}>
                          {e.sharedPaperCount}
                        </text>
                      </g>
                    );
                  })}

                  {/* Root node (on top) */}
                  <g transform={`translate(${CENTER.x},${CENTER.y})`}>
                    <circle r={ROOT_R} fill="#FFF0EC" stroke="#C84B31" strokeWidth={2.5} />
                    <text y={ROOT_R + 14} textAnchor="middle"
                      style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, fill: '#1A1611', fontWeight: 700 }}>
                      {truncate(rootNode?.name || '', 22)}
                    </text>
                  </g>
                </svg>
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', flexWrap: 'wrap' }}>
                <span><span style={{ display: 'inline-block', width: 16, height: 3, background: '#6B9FD4', verticalAlign: 'middle', marginRight: 4 }} />{lang === 'ko' ? '공저 (두께=공동 논문 수)' : 'Coauthored (thickness = shared papers)'}</span>
                <span><span style={{ display: 'inline-block', width: 16, height: 0, borderTop: '2px dashed #B07A2E', verticalAlign: 'middle', marginRight: 4 }} />{rn.possibleMentorTrainee}</span>
                {peerEdges.length > 0 && (
                  <span><span style={{ display: 'inline-block', width: 16, height: 1, background: '#CDBEA8', verticalAlign: 'middle', marginRight: 4 }} />{rn.peerCoauthored}</span>
                )}
              </div>
            </>
          )}

          {/* ── Collaborators tab ── */}
          {activeTab === 'collaborators' && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, overflow: 'hidden' }}>
              {sortedEdges.map((e, i) => {
                const node = nodeById[e.target];
                return (
                  <div key={i} style={{ padding: '10px 14px', borderTop: i > 0 ? '1px solid #F0EBE2' : 'none', cursor: 'pointer' }}
                    onClick={() => { setSelectedTarget(e.target); setActiveTab('graph'); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', fontWeight: 500 }}>{node?.name}</span>
                      <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#4A6B8A', whiteSpace: 'nowrap' }}>{rn.sharedPapers(e.sharedPaperCount)}</span>
                    </div>
                    <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185', marginTop: 2 }}>
                      {e.firstSharedYear && e.lastSharedYear ? `${e.firstSharedYear}–${e.lastSharedYear}` : '—'}
                      {e.topSharedPapers?.[0] && ` · ${truncate(e.topSharedPapers[0].title, 40)}`}
                    </div>
                    {(e.relationshipHints || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                        {e.relationshipHints.map(h => (
                          <span key={h} style={{ fontFamily: "'Geist', sans-serif", fontSize: 9.5, color: h === 'possible_mentor_trainee_pattern' ? '#B07A2E' : '#4A6B8A', background: h === 'possible_mentor_trainee_pattern' ? '#FBF3E4' : '#EEF4FF', padding: '2px 6px', borderRadius: 3 }}>
                            {hintLabel(h)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Shared papers tab ── */}
          {activeTab === 'papers' && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, overflow: 'hidden' }}>
              {selectedTarget && selectedEdge ? (
                <>
                  <div style={{ padding: '8px 14px', fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185', borderBottom: '1px solid #F0EBE2', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{lang === 'ko' ? `${selectedNode?.name}과의 공동 논문` : `Shared with ${selectedNode?.name}`}</span>
                    <button onClick={() => setSelectedTarget(null)}
                      style={{ background: 'none', border: 'none', color: '#9B9185', cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline' }}>
                      {lang === 'ko' ? '전체 보기' : 'Show all'}
                    </button>
                  </div>
                  {(selectedEdge.topSharedPapers || []).map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer"
                      style={{ display: 'block', padding: '10px 14px', borderTop: i > 0 ? '1px solid #F0EBE2' : 'none', textDecoration: 'none' }}>
                      <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', lineHeight: 1.4 }}>{p.title}</div>
                      <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185', marginTop: 2 }}>
                        {p.year || '—'} · {ts.citations(p.citationCount || 0)}
                      </div>
                    </a>
                  ))}
                </>
              ) : (
                (() => {
                  const seen = new Set();
                  const papers = [];
                  sortedEdges.forEach(e => (e.topSharedPapers || []).forEach(p => {
                    if (p.paperId && !seen.has(p.paperId)) { seen.add(p.paperId); papers.push(p); }
                  }));
                  papers.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
                  return papers.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer"
                      style={{ display: 'block', padding: '10px 14px', borderTop: i > 0 ? '1px solid #F0EBE2' : 'none', textDecoration: 'none' }}>
                      <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', lineHeight: 1.4 }}>{p.title}</div>
                      <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185', marginTop: 2 }}>
                        {p.year || '—'} · {ts.citations(p.citationCount || 0)}
                      </div>
                    </a>
                  ));
                })()
              )}
            </div>
          )}

          {/* Side panel (selected collaborator) */}
          {selectedEdge && selectedNode && (
            <div style={{ marginTop: 14, position: 'relative', background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: '14px 16px' }}>
              <button onClick={() => setSelectedTarget(null)}
                style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', color: '#9B9185', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 15, color: '#1A1611', fontWeight: 600, marginBottom: 6 }}>{selectedNode.name}</div>
              <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', lineHeight: 1.7 }}>
                <div>{rn.sharedPapers(selectedEdge.sharedPaperCount)}</div>
                <div>{rn.activeYears}: {selectedEdge.firstSharedYear && selectedEdge.lastSharedYear ? `${selectedEdge.firstSharedYear}–${selectedEdge.lastSharedYear}` : '—'}</div>
                <div>{rn.authorPosition}: {rn.rootLastAuthor(selectedEdge.rootLastAuthorCount)} · {rn.collaboratorEarly(selectedEdge.collaboratorEarlyAuthorCount)}</div>
              </div>

              {(selectedEdge.relationshipHints || []).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.1em', marginBottom: 4 }}>{rn.relationshipHints}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedEdge.relationshipHints.map(h => (
                      <span key={h} style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: h === 'possible_mentor_trainee_pattern' ? '#B07A2E' : '#4A6B8A', background: h === 'possible_mentor_trainee_pattern' ? '#FBF3E4' : '#EEF4FF', padding: '2px 7px', borderRadius: 3 }}>{hintLabel(h)}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedEdge.topSharedPapers?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.1em', marginBottom: 4 }}>{rn.topSharedPapers}</div>
                  {selectedEdge.topSharedPapers.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer"
                      style={{ display: 'block', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', textDecoration: 'none', padding: '3px 0', lineHeight: 1.4 }}>
                      · {truncate(p.title, 60)} <span style={{ color: '#9B9185' }}>({p.year || '—'})</span>
                    </a>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10, fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', fontStyle: 'italic', lineHeight: 1.5 }}>
                {rn.warning}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
