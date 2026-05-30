'use client';

import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const API = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000/api` : 'http://localhost:8000/api';

// Graph display caps (frontend subset of backend 50 nodes / 100 edges)
const GRAPH_MAX_NODES = 25;
const GRAPH_MAX_EDGES = 40;

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

  // Count how many distinct seeds each reference connects to
  const refSeedCount = {};
  edges.forEach(e => {
    refSeedCount[e.source] = (refSeedCount[e.source] || 0) + 1;
  });

  refs.sort((a, b) => {
    const d = (refSeedCount[b.id] || 0) - (refSeedCount[a.id] || 0);
    return d !== 0 ? d : (b.citationCount || 0) - (a.citationCount || 0);
  });

  const visible = seeds.slice(0, GRAPH_MAX_NODES);
  for (const ref of refs) {
    if (visible.length >= GRAPH_MAX_NODES) break;
    visible.push(ref);
  }
  return visible;
}

function selectGraphEdges(edges, visibleIds) {
  return [...edges]
    .sort((a, b) => (b.isInfluential ? 1 : 0) - (a.isInfluential ? 1 : 0))
    .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
    .slice(0, GRAPH_MAX_EDGES);
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

function ListNodeCard({ node }) {
  const { t } = useLanguage();
  const ts = t.search;
  const [expanded, setExpanded] = useState(false);
  const authors = (node.authors || []).slice(0, 2).join(', ');
  const meta = [node.venue, authors, node.year].filter(Boolean).join(' · ');
  const abstract = node.abstract || '';

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
      <a href={node.url || '#'} target="_blank" rel="noreferrer"
        style={{ display: 'block', padding: '12px 14px 8px', textDecoration: 'none', color: '#1A1611' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <h4 style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 500, margin: 0, lineHeight: 1.3, flex: 1 }}>
            {node.title}
          </h4>
          {node.citationCount > 0 && (
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', whiteSpace: 'nowrap', marginTop: 2 }}>
              {node.citationCount.toLocaleString()} cit.
            </span>
          )}
        </div>
        {meta && <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358' }}>{meta}</div>}
        {abstract && (
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', lineHeight: 1.5, margin: '6px 0 0', display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden' }}>
            {abstract}
          </p>
        )}
      </a>
      {abstract.length > 150 && (
        <div style={{ borderTop: '1px solid #F0EBE2', padding: '5px 14px' }}>
          <button onClick={() => setExpanded(v => !v)}
            style={{ background: 'none', border: 'none', padding: 0, fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', cursor: 'pointer' }}>
            {expanded ? ts.hideAbstract : ts.showAbstract}
          </button>
        </div>
      )}
    </div>
  );
}

function AllResultsList({ nodes, edges, nodeById }) {
  const { t } = useLanguage();
  const ts = t.search;
  const seeds = nodes.filter(n => n.type === 'seed');
  const refs = nodes.filter(n => n.type === 'reference');

  return (
    <div>
      {seeds.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.15em', marginBottom: 8 }}>
            {ts.lineageSeedHeader} ({seeds.length})
          </div>
          {seeds.map(n => <ListNodeCard key={n.id} node={n} />)}
        </section>
      )}
      {refs.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', letterSpacing: '0.15em', marginBottom: 8 }}>
            {ts.lineageRefHeader} ({refs.length})
          </div>
          {refs.map(n => <ListNodeCard key={n.id} node={n} />)}
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

export default function CitationGraph({ embedded }) {
  const { t } = useLanguage();
  const ts = t.search;

  const [query, setQuery] = useState('');
  const [buildState, setBuildState] = useState('idle');
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState(null);

  const handleBuild = async () => {
    const q = query.trim();
    if (!q) return;
    setBuildState('loading');
    setResult(null);
    setSelectedId(null);
    setActiveTab('graph');
    try {
      const res = await fetch(`${API}/citation-graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, max_seed_papers: 20, max_depth: 1, min_citations: 0 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
      setBuildState('done');
    } catch {
      setBuildState('error');
    }
  };

  const allNodes = result?.nodes || [];
  const allEdges = result?.edges || [];
  const graphNodes = selectGraphNodes(allNodes, allEdges);
  const visibleIds = new Set(graphNodes.map(n => n.id));
  const graphEdges = selectGraphEdges(allEdges, visibleIds);
  const { positions, svgW, svgH, cols } = computeLayout(graphNodes);
  const nodeById = Object.fromEntries(allNodes.map(n => [n.id, n]));
  const selectedNode = selectedId ? nodeById[selectedId] : null;

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Query input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBuild()}
          placeholder={ts.lineagePlaceholder}
          style={{ flex: 1, padding: '9px 12px', border: '1px solid #D8D0BE', borderRadius: 4, fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#1A1611', background: '#FFFFFF', outline: 'none' }}
        />
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
        <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358', fontStyle: 'italic' }}>
          {ts.lineageLoading}
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
                  { shape: 'rect', fill: '#FFF0EC', stroke: '#C84B31', sw: 1.5, label: 'Seed' },
                  { shape: 'rect', fill: '#FFFFFF', stroke: '#D8D0BE', sw: 1, label: 'Reference' },
                  { shape: 'line', stroke: '#C84B31', sw: 1.5, label: 'Influential' },
                  { shape: 'line', stroke: '#D8D0BE', sw: 1, label: 'Cites' },
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

              {/* SVG canvas — horizontally scrollable */}
              <div style={{ overflowX: 'auto', border: '1px solid #E8E2D5', borderRadius: 4, background: '#FAFAF8' }}
                onClick={() => { setSelectedId(null); setHoveredEdgeIdx(null); }}>
                <svg width={svgW} height={svgH} style={{ display: 'block' }}>
                  <defs>
                    <marker id="cg-arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                      <polygon points="0 0, 7 2.5, 0 5" fill="#C0B8B0" />
                    </marker>
                    <marker id="cg-arr-inf" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                      <polygon points="0 0, 7 2.5, 0 5" fill="#C84B31" />
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
                    const x1 = sp.x + NODE_W;
                    const y1 = sp.y + NODE_H / 2;
                    const x2 = tp.x;
                    const y2 = tp.y + NODE_H / 2;
                    const isHov = hoveredEdgeIdx === i;
                    const isInf = e.isInfluential;
                    return (
                      <line key={i}
                        x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke={isInf ? '#C84B31' : '#D0C8C0'}
                        strokeWidth={isInf ? 1.5 : 1}
                        strokeOpacity={isHov ? 1 : isInf ? 0.75 : 0.55}
                        markerEnd={isInf ? 'url(#cg-arr-inf)' : 'url(#cg-arr)'}
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
                  {graphNodes.map(n => {
                    const pos = positions[n.id];
                    if (!pos) return null;
                    const isSeed = n.type === 'seed';
                    const isSel = selectedId === n.id;
                    return (
                      <g key={n.id}
                        transform={`translate(${pos.x},${pos.y})`}
                        onClick={ev => { ev.stopPropagation(); setSelectedId(isSel ? null : n.id); }}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect width={NODE_W} height={NODE_H} rx={3}
                          fill={isSeed ? '#FFF0EC' : '#FFFFFF'}
                          stroke={isSel ? '#1A1611' : isSeed ? '#C84B31' : '#D8D0BE'}
                          strokeWidth={isSel ? 2 : isSeed ? 1.5 : 1}
                        />
                        {/* Seed indicator: left accent bar */}
                        {isSeed && <rect width={3} height={NODE_H} rx={1} fill="#C84B31" />}
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
              {(graphNodes.length < allNodes.length || graphEdges.length < allEdges.length) && (
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9B9185', margin: '5px 0 0', textAlign: 'right' }}>
                  {ts.lineageSubsetNote(graphNodes.length, allNodes.length, graphEdges.length, allEdges.length)}
                </p>
              )}

              {/* Selected node panel */}
              {selectedNode && (
                <div style={{ marginTop: 14, padding: '14px 16px', background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <h4 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 500, color: '#1A1611', margin: 0, lineHeight: 1.3, flex: 1 }}>
                      {selectedNode.title}
                    </h4>
                    <button onClick={() => setSelectedId(null)}
                      style={{ background: 'none', border: 'none', color: '#9B9185', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>
                      ×
                    </button>
                  </div>
                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', marginBottom: 4 }}>
                    {[selectedNode.venue, selectedNode.year, selectedNode.citationCount > 0 ? `${selectedNode.citationCount.toLocaleString()} citations` : null].filter(Boolean).join(' · ')}
                  </div>
                  {selectedNode.authors?.length > 0 && (
                    <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', marginBottom: 6 }}>
                      {selectedNode.authors.join(', ')}
                    </div>
                  )}
                  {selectedNode.abstract && (
                    <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', lineHeight: 1.55, margin: '8px 0' }}>
                      {selectedNode.abstract.slice(0, 340)}{selectedNode.abstract.length > 340 ? '…' : ''}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, padding: '2px 8px', borderRadius: 10, background: selectedNode.type === 'seed' ? '#FFF0EC' : '#F5F2EE', color: selectedNode.type === 'seed' ? '#C84B31' : '#6B6358', fontWeight: 500 }}>
                      {selectedNode.type}
                    </span>
                    {selectedNode.url && (
                      <a href={selectedNode.url} target="_blank" rel="noreferrer"
                        style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', textDecoration: 'none', borderBottom: '1px solid #D8D0BE' }}>
                        {ts.lineageViewSource}
                      </a>
                    )}
                  </div>
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
