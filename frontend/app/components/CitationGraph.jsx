'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import PaperCard from './PaperCard';

const API = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000/api` : 'http://localhost:8000/api';

// Graph display caps (frontend subset of backend nodes/edges)
const GRAPH_MAX_NODES = 60;
const GRAPH_MAX_EDGES = 120;

// SVG layout constants
const NODE_W = 134;
const NODE_H = 56;
const PAD_X = 20;
const PAD_Y = 40;   // extra top space for year labels
const NODE_GAP_Y = 14;
const COL_W = 180;  // fixed width per year column

function truncate(str, len = 19) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// ---------- Graph subset selection ----------

function selectGraphNodes(nodes, edges) {
  const seeds = nodes.filter(n => n.type === 'seed');
  const refs = nodes.filter(n => n.type === 'reference');
  const citing = nodes.filter(n => n.type === 'citing');

  const connCount = {};
  edges.forEach(e => {
    connCount[e.source] = (connCount[e.source] || 0) + 1;
    connCount[e.target] = (connCount[e.target] || 0) + 1;
  });

  const sortByConn = arr => [...arr].sort((a, b) => {
    const d = (connCount[b.id] || 0) - (connCount[a.id] || 0);
    return d !== 0 ? d : (b.citationCount || 0) - (a.citationCount || 0);
  });

  // Step 1: All seeds
  const visible = [...seeds];

  // Step 2: All reference (blue) nodes guaranteed — bounded by _PAPERS_PER_YEAR * _MAX_YEAR_SPAN
  const refSlots = Math.ceil((GRAPH_MAX_NODES - seeds.length) / 2);
  for (const r of sortByConn(refs).slice(0, refSlots)) {
    if (visible.length >= GRAPH_MAX_NODES) break;
    visible.push(r);
  }

  // Step 3: Citing (white) nodes — must prioritize those connected to seeds or blue nodes.
  // If we skip this, blue nodes whose refs are not in visible set become "isolated"
  // and get filtered from displayNodes, making entire year columns disappear.
  const visibleSet = new Set(visible.map(n => n.id));
  const citingIds = new Set(citing.map(n => n.id));
  const linkedToVisible = new Set();
  edges.forEach(e => {
    if (visibleSet.has(e.target) && citingIds.has(e.source)) linkedToVisible.add(e.source);
    if (visibleSet.has(e.source) && citingIds.has(e.target)) linkedToVisible.add(e.target);
  });

  const priorityCiting = citing.filter(n => linkedToVisible.has(n.id));
  const otherCiting = citing.filter(n => !linkedToVisible.has(n.id));

  for (const c of [...sortByConn(priorityCiting), ...sortByConn(otherCiting)]) {
    if (visible.length >= GRAPH_MAX_NODES) break;
    visible.push(c);
  }

  return visible;
}

function selectGraphEdges(edges, visibleIds) {
  return [...edges]
    .sort((a, b) => (b.isInfluential ? 1 : 0) - (a.isInfluential ? 1 : 0))
    .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
    .slice(0, GRAPH_MAX_EDGES);
}

// ---------- Edge path (bezier curve) ----------

function edgePath(sp, tp) {
  const x1 = sp.x + NODE_W;
  const y1 = sp.y + NODE_H / 2;
  const x2 = tp.x;
  const y2 = tp.y + NODE_H / 2;
  const dx = x2 - x1;
  if (dx > 10) {
    const cp = dx * 0.45;
    return `M ${x1} ${y1} C ${x1 + cp} ${y1} ${x2 - cp} ${y2} ${x2} ${y2}`;
  }
  // Same column or backward edge: arc outward to the right
  const arc = 50 + Math.abs(y2 - y1) * 0.2;
  return `M ${x1} ${y1} C ${x1 + arc} ${y1} ${x2 + arc} ${y2} ${x2} ${y2}`;
}

// ---------- Year-based left-to-right layout ----------

function computeLayout(nodes) {
  const yearSet = new Set(nodes.map(n => n.year).filter(Boolean));
  const years = [...yearSet].sort((a, b) => a - b);

  const sortGroup = arr =>
    [...arr].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'seed' ? -1 : 1;
      return (b.citationCount || 0) - (a.citationCount || 0);
    });

  const byYear = {};
  years.forEach(y => {
    byYear[y] = sortGroup(nodes.filter(n => n.year === y));
  });
  const noYear = sortGroup(nodes.filter(n => !n.year));

  const cols = [
    ...years.map(y => ({ label: String(y), nodes: byYear[y] })),
    ...(noYear.length ? [{ label: '?', nodes: noYear }] : []),
  ];

  const maxRows = Math.max(...cols.map(c => c.nodes.length), 1);
  const svgW = PAD_X * 2 + cols.length * COL_W;
  const svgH = Math.max(220, PAD_Y + maxRows * (NODE_H + NODE_GAP_Y) + PAD_X);

  const positions = {};
  cols.forEach((col, ci) => {
    const x = PAD_X + ci * COL_W;
    col.nodes.forEach((n, ri) => {
      positions[n.id] = { x, y: PAD_Y + ri * (NODE_H + NODE_GAP_Y) };
    });
  });

  return { positions, svgW, svgH, cols };
}

// ---------- Sub-components ----------


function AllResultsList({ nodes, edges, nodeById }) {
  const { t } = useLanguage();
  const ts = t.search;
  const seeds = nodes.filter(n => n.type === 'seed');
  const refs = nodes.filter(n => n.type === 'reference');
  const citing = nodes.filter(n => n.type === 'citing');

  return (
    <div>
      {refs.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B9FD4', letterSpacing: '0.15em', marginBottom: 8 }}>
            {ts.lineageRefHeader} ({refs.length})
          </div>
          {refs.map(n => <PaperCard key={n.id} item={n} type="paper" showCite />)}
        </section>
      )}
      {seeds.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#C84B31', letterSpacing: '0.15em', marginBottom: 8 }}>
            {ts.lineageSeedHeader} ({seeds.length})
          </div>
          {seeds.map(n => <PaperCard key={n.id} item={n} type="paper" showCite />)}
        </section>
      )}
      {citing.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.15em', marginBottom: 8 }}>
            {ts.lineageCitingHeader} ({citing.length})
          </div>
          {citing.map(n => <PaperCard key={n.id} item={n} type="paper" showCite />)}
        </section>
      )}
      {edges.length > 0 && (
        <section>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.15em', marginBottom: 8 }}>
            {ts.lineageEdgesHeader} ({edges.length})
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, overflow: 'hidden' }}>
            {edges.map((e, i) => {
              const src = nodeById[e.source];
              const tgt = nodeById[e.target];
              if (!src || !tgt) return null;
              return (
                <div key={i} style={{ padding: '9px 14px', borderTop: i > 0 ? '1px solid #F0EBE2' : 'none', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', lineHeight: 1.5 }}>
                    <span style={{ color: '#6B6358' }}>{src.title}{src.year ? ` (${src.year})` : ''}</span>
                    <span style={{ color: '#9B9185', margin: '0 6px' }}>→</span>
                    <span>{tgt.title}{tgt.year ? ` (${tgt.year})` : ''}</span>
                  </div>
                  {e.isInfluential && (
                    <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#C84B31', whiteSpace: 'nowrap', marginTop: 1 }}>
                      {ts.lineageInfluential}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- Main component ----------

export default function CitationGraph({ embedded, onBack, onComplete }) {
  const { t, lang } = useLanguage();
  const ts = t.search;

  const [query, setQuery] = useState('');
  const [buildState, setBuildState] = useState('idle');
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState(null);
  const [history, setHistory] = useState(null);
  const [showHistoryCG, setShowHistoryCG] = useState(false);
  const abortRef = useRef(null);
  const cgInputRef = useRef(null);

  const loadHistory = async () => {
    try {
      const r = await fetch(`${API}/citation-graph/history`);
      setHistory(await r.json());
    } catch { setHistory([]); }
  };

  const deleteHistory = async (q, e) => {
    e.stopPropagation();
    try { await fetch(`${API}/citation-graph/history?query=${encodeURIComponent(q)}`, { method: 'DELETE' }); } catch {}
    setHistory(h => h.filter(item => item.query !== q));
  };

  const [nodeSummaries, setNodeSummaries] = useState({});
  const [nodeSumLoading, setNodeSumLoading] = useState({});
  const [nodeSumNoKey, setNodeSumNoKey] = useState({});

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (cgInputRef.current && !cgInputRef.current.contains(e.target)) {
        setShowHistoryCG(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNodeSummary = async (title, abstract) => {
    if (!abstract || nodeSummaries[title] !== undefined || nodeSumNoKey[title] || nodeSumLoading[title]) return;
    setNodeSumLoading(s => ({ ...s, [title]: true }));
    try {
      const r = await fetch(`${API}/summarize/paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abstract, lang }),
      });
      const d = await r.json();
      if (d.no_api_key) setNodeSumNoKey(s => ({ ...s, [title]: true }));
      else if (d.summary) setNodeSummaries(s => ({ ...s, [title]: d.summary }));
    } finally {
      setNodeSumLoading(s => ({ ...s, [title]: false }));
    }
  };

  const handleCancel = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setBuildState('idle');
  };

  const handleBuildWithQuery = async (q) => {
    setQuery('');
    if (!q) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBuildState('loading');
    setResult(null);
    setSelectedId(null);
    setActiveTab('graph');
    try {
      const res = await fetch(`${API}/citation-graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, max_seed_papers: 5, max_depth: 1, min_citations: 0 }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const graphData = await res.json();
      setResult(graphData);
      setBuildState('done');
      loadHistory();
      if (onComplete) onComplete(q);
    } catch (err) {
      if (err?.name !== 'AbortError') setBuildState('error');
    } finally {
      abortRef.current = null;
    }
  };

  const handleBuild = () => handleBuildWithQuery(query.trim());

  const allNodes = result?.nodes || [];
  const allEdges = result?.edges || [];
  const graphNodes = selectGraphNodes(allNodes, allEdges);
  const visibleIds = new Set(graphNodes.map(n => n.id));
  const graphEdges = selectGraphEdges(allEdges, visibleIds);

  // IDs of nodes connected to the selected node (for highlight)
  const connectedToSelected = selectedId
    ? new Set(
        graphEdges
          .filter(e => e.source === selectedId || e.target === selectedId)
          .flatMap(e => [e.source, e.target])
      )
    : new Set();

  // Filter isolated nodes from graph view (nodes with no edges are just noise)
  const connectedIds = new Set();
  graphEdges.forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });
  const displayNodes = graphNodes.filter(n => connectedIds.has(n.id));
  const isolatedCount = graphNodes.length - displayNodes.length;

  const { positions, svgW, svgH, cols } = computeLayout(displayNodes);
  const nodeById = Object.fromEntries(allNodes.map(n => [n.id, n]));
  const selectedNode = selectedId ? nodeById[selectedId] : null;

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Query input */}
      <div ref={cgInputRef} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBuild()}
            onFocus={() => setShowHistoryCG(true)}
            placeholder={ts.lineagePlaceholder}
            style={{ width: '100%', padding: '9px 32px 9px 12px', border: '1px solid #D8D0BE', borderRadius: showHistoryCG && history && history.length > 0 ? '4px 4px 0 0' : 4, fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9B9185', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
          )}
          {showHistoryCG && history && history.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#FFFFFF', border: '1px solid #D8D0BE', borderTop: 'none', borderRadius: '0 0 4px 4px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: 240, overflowY: 'auto' }}>
              <div style={{ padding: '8px 12px 4px', fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.12em' }}>
                {lang === 'ko' ? '최근 인용 계보' : 'RECENT GRAPHS'}
              </div>
              {history.map(item => (
                <div key={item.query}
                  style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderTop: '1px solid #F0EAD9' }}
                  onClick={() => { setQuery(item.query); setShowHistoryCG(false); handleBuildWithQuery(item.query); }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAF7F2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ flex: 1, fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.query}
                  </span>
                  {item.year_range && (
                    <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185', marginLeft: 8, flexShrink: 0 }}>
                      {item.year_range}
                    </span>
                  )}
                  <button
                    onClick={(e) => deleteHistory(item.query, e)}
                    style={{ background: 'none', border: 'none', padding: '2px 6px', color: '#9B9185', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0, marginLeft: 4 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleBuild}
          disabled={!query.trim() || buildState === 'loading'}
          style={{ padding: '0 16px', background: query.trim() ? '#1A1611' : '#D8D0BE', color: '#FAF7F2', border: 'none', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500, cursor: query.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
        >
          {ts.lineageBuildBtn}
        </button>
      </div>

      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#9B9185', lineHeight: 1.5, margin: '0 0 16px' }}>
        {ts.lineageHint}
      </p>

      {buildState === 'loading' && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358', fontStyle: 'italic', marginBottom: 16 }}>
            {ts.lineageLoading}
          </div>
          <button onClick={handleCancel} style={{ background: 'none', border: '1px solid #D8D0BE', borderRadius: 4, padding: '7px 18px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer' }}>
            {lang === 'ko' ? '취소' : 'Cancel'}
          </button>
        </div>
      )}

      {buildState === 'error' && (
        <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#C84B31' }}>
          {ts.lineageError}
        </div>
      )}

      {buildState === 'done' && allNodes.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#9B9185', lineHeight: 1.6 }}>
          {result?.warning || ts.lineageEmpty}
        </div>
      )}

      {buildState === 'done' && allNodes.length > 0 && (
        <>
          {embedded && (
            <button
              onClick={() => { setBuildState('idle'); setResult(null); setSelectedId(null); }}
              style={{ background: 'none', border: 'none', padding: '0 0 8px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#6B6358', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              ← {ts.backToFeed}
            </button>
          )}
          <div style={{ margin: '0 0 12px' }}>
            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#6B6358', letterSpacing: '0.15em', marginBottom: 2 }}>
              {lang === 'ko' ? '주제' : 'TOPIC'}
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontStyle: 'italic', color: '#1A1611' }}>
              {result?.query}
            </div>
          </div>
          {result?.cache_hit && (
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '-8px 0 8px', textAlign: 'right' }}>
              ⚡ cached result
            </p>
          )}
          {/* Tab bar: Graph / All Results */}
          <div style={{ display: 'flex', gap: 0, background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: 3, marginBottom: 14 }}>
            {[
              { key: 'graph', label: ts.lineageGraphTab },
              { key: 'list', label: ts.lineageAllTab(allNodes.length) },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ flex: 1, padding: '7px 10px', background: activeTab === key ? '#1A1611' : 'transparent', color: activeTab === key ? '#FAF7F2' : '#6B6358', border: 'none', borderRadius: 2, fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: activeTab === key ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Graph tab ── */}
          {activeTab === 'graph' && (
            <>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 8 }}>
                {[
                  { shape: 'rect', fill: '#FFF0EC', stroke: '#C84B31', sw: 1.5, label: lang === 'ko' ? '영향력 높음' : 'Influential' },
                  { shape: 'rect', fill: '#EEF4FF', stroke: '#6B9FD4', sw: 1, label: lang === 'ko' ? '관련 논문' : 'Related' },
                  { shape: 'line', stroke: '#C84B31', sw: 1.5, label: lang === 'ko' ? '주요 인용' : 'Top ref' },
                  { shape: 'line', stroke: '#D8D0BE', sw: 1, label: lang === 'ko' ? '인용' : 'Cites' },
                ].map(({ shape, fill, stroke, sw, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185' }}>
                    {shape === 'rect'
                      ? <span style={{ width: 10, height: 10, background: fill, border: `${sw}px solid ${stroke}`, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                      : <span style={{ width: 16, height: sw, background: stroke, display: 'inline-block', flexShrink: 0 }} />
                    }
                    {label}
                  </span>
                ))}
              </div>

              {/* SVG canvas — scrollable in both directions */}
              <div className="cg-scroll" style={{ overflow: 'scroll', maxHeight: 520, border: '1px solid #E8E2D5', borderRadius: 4, background: '#FAFAF8' }}
                onClick={() => { setSelectedId(null); setHoveredEdgeIdx(null); }}>
                <svg width={svgW} height={svgH} style={{ display: 'block' }}>
                  <defs>
                    <marker id="cg-arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                      <polygon points="0 0, 7 2.5, 0 5" fill="#C0B8B0" />
                    </marker>
                    <marker id="cg-arr-inf" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                      <polygon points="0 0, 7 2.5, 0 5" fill="#C84B31" />
                    </marker>
                    <marker id="cg-arr-sel" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                      <polygon points="0 0, 7 2.5, 0 5" fill="#1A1611" />
                    </marker>
                  </defs>

                  {/* Year column labels */}
                  {cols.map((col, ci) => (
                    <text key={col.label}
                      x={PAD_X + ci * COL_W + NODE_W / 2}
                      y={22}
                      textAnchor="middle"
                      style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, fill: '#9B9185', fontWeight: 500 }}
                    >
                      {col.label}
                    </text>
                  ))}

                  {/* Edges — rendered before nodes so nodes appear on top */}
                  {graphEdges.map((e, i) => {
                    const sp = positions[e.source];
                    const tp = positions[e.target];
                    if (!sp || !tp) return null;
                    const isHov = hoveredEdgeIdx === i;
                    const isInf = e.isInfluential;
                    const isConnected = selectedId && (e.source === selectedId || e.target === selectedId);
                    const isDimmed = selectedId && !isConnected;
                    // influential always stays red; connected non-influential → dark
                    const edgeColor = isInf ? '#C84B31' : (isConnected ? '#1A1611' : '#D0C8C0');
                    const edgeMarker = isInf ? 'url(#cg-arr-inf)' : (isConnected ? 'url(#cg-arr-sel)' : 'url(#cg-arr)');
                    return (
                      <path key={i}
                        d={edgePath(sp, tp)}
                        fill="none"
                        stroke={edgeColor}
                        strokeWidth={isConnected ? (isInf ? 2.5 : 2) : isInf ? 1.5 : 1}
                        strokeOpacity={isDimmed ? 0.12 : isHov ? 1 : isConnected ? 0.95 : isInf ? 0.75 : 0.55}
                        markerEnd={edgeMarker}
                        onMouseEnter={ev => { ev.stopPropagation(); setHoveredEdgeIdx(i); }}
                        onMouseLeave={() => setHoveredEdgeIdx(null)}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  })}

                  {/* Hovered edge tooltip */}
                  {hoveredEdgeIdx !== null && (() => {
                    const e = graphEdges[hoveredEdgeIdx];
                    if (!e) return null;
                    const sp = positions[e.source];
                    const tp = positions[e.target];
                    if (!sp || !tp) return null;
                    const mx = (sp.x + NODE_W + tp.x) / 2;
                    const my = Math.min(sp.y, tp.y) + NODE_H / 2 - 6;
                    const label = `${truncate(nodeById[e.source]?.title || '', 14)} → ${truncate(nodeById[e.target]?.title || '', 14)}`;
                    return (
                      <g style={{ pointerEvents: 'none' }}>
                        <rect x={mx - 84} y={my - 22} width={168} height={e.isInfluential ? 32 : 22} rx={3} fill="#1A1611" opacity={0.88} />
                        <text x={mx} y={my - 7} textAnchor="middle"
                          style={{ fontFamily: "'Geist', sans-serif", fontSize: 9, fill: '#FAF7F2' }}>
                          {label}
                        </text>
                        {e.isInfluential && (
                          <text x={mx} y={my + 5} textAnchor="middle"
                            style={{ fontFamily: "'Geist', sans-serif", fontSize: 9, fill: '#F4A27A' }}>
                            ★ influential
                          </text>
                        )}
                      </g>
                    );
                  })()}

                  {/* Nodes */}
                  {displayNodes.map(n => {
                    const pos = positions[n.id];
                    if (!pos) return null;
                    const isSeed = n.type === 'seed';
                    const isSel = selectedId === n.id;
                    const isLinked = !isSel && connectedToSelected.has(n.id);
                    const isDimmedNode = selectedId && !isSel && !isLinked;
                    return (
                      <g key={n.id}
                        transform={`translate(${pos.x},${pos.y})`}
                        onClick={ev => { ev.stopPropagation(); setSelectedId(isSel ? null : n.id); }}
                        style={{ cursor: 'pointer', opacity: isDimmedNode ? 0.25 : 1, transition: 'opacity 0.15s' }}
                      >
                        <rect width={NODE_W} height={NODE_H} rx={3}
                          fill={isSeed ? '#FFF0EC' : n.type === 'reference' ? '#EEF4FF' : '#FFFFFF'}
                          stroke={isSel ? '#F59E0B' : isLinked ? '#3A342B' : isSeed ? '#C84B31' : n.type === 'reference' ? '#6B9FD4' : '#D8D0BE'}
                          strokeWidth={isSel ? 3 : isLinked ? 1.5 : isSeed ? 1.5 : n.type === 'reference' ? 1 : 1}
                        />
                        {/* Seed indicator: left accent bar */}
                        {isSeed && <rect width={3} height={NODE_H} rx={1} fill="#C84B31" />}
                        {/* Reference indicator: left accent bar */}
                        {n.type === 'reference' && <rect width={3} height={NODE_H} rx={1} fill="#6B9FD4" />}
                        <text x={isSeed ? 9 : 7} y={18}
                          style={{ fontFamily: "'Geist', sans-serif", fontSize: 10.5, fontWeight: 500, fill: '#1A1611' }}>
                          {truncate(n.title, 17)}
                        </text>
                        <text x={isSeed ? 9 : 7} y={32}
                          style={{ fontFamily: "'Geist', sans-serif", fontSize: 9.5, fill: '#6B6358' }}>
                          {n.year || '—'}
                        </text>
                        <text x={isSeed ? 9 : 7} y={46}
                          style={{ fontFamily: "'Geist', sans-serif", fontSize: 9.5, fill: '#9B9185' }}>
                          {n.citationCount > 0 ? `${n.citationCount.toLocaleString()} cit.` : '—'}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Subset note */}
              {(displayNodes.length < allNodes.length || graphEdges.length < allEdges.length) && (
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '5px 0 0', textAlign: 'right' }}>
                  {ts.lineageSubsetNote(displayNodes.length, allNodes.length, graphEdges.length, allEdges.length, isolatedCount)}
                </p>
              )}

              {/* Selected node panel */}
              {selectedNode && (
                <div style={{ marginTop: 14, position: 'relative' }}>
                  <button
                    onClick={() => setSelectedId(null)}
                    style={{ position: 'absolute', top: 10, right: 10, zIndex: 1, background: 'none', border: 'none', color: '#9B9185', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>
                    ×
                  </button>
                  <PaperCard
                    item={{
                      title: selectedNode.title,
                      url: selectedNode.url,
                      abstract: selectedNode.abstract,
                      authors: selectedNode.authors,
                      published_date: selectedNode.year ? String(selectedNode.year) : '',
                      citation_count: selectedNode.citationCount || 0,
                      venue: selectedNode.venue,
                    }}
                    type="paper"
                    badgeLabel={selectedNode.type === 'seed' ? (lang === 'ko' ? '영향력 높음' : 'INFLUENTIAL') : 'PAPER'}
                    showCite
                    onSummarize={() => fetchNodeSummary(selectedNode.title, selectedNode.abstract)}
                    summary={nodeSummaries[selectedNode.title]}
                    summaryLoading={!!nodeSumLoading[selectedNode.title]}
                    summaryNoKey={!!nodeSumNoKey[selectedNode.title]}
                  />
                </div>
              )}
            </>
          )}

          {/* ── All Results tab ── */}
          {activeTab === 'list' && (
            <AllResultsList nodes={allNodes} edges={allEdges} nodeById={nodeById} />
          )}
        </>
      )}
    </div>
  );
}
