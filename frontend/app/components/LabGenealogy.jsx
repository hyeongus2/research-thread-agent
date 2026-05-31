'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

const API = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

// SVG layout constants
const NODE_W = 160;
const NODE_H = 70;
const ROW_H = 160;
const PAD_X = 32;
const PAD_Y = 48;
const NODE_GAP_X = 20;

const CONFIDENCE_COLORS = {
  high: '#1A1611',
  medium: '#8B6A42',
  low: '#C0B8B0',
};

function truncate(str, len = 22) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// ---------- Layout ----------

function computeTreeLayout(nodes) {
  const byLevel = {};
  nodes.forEach(n => {
    const lvl = n.generationLevel ?? 0;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(n);
  });

  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  const positions = {};

  let maxRowWidth = 0;
  levels.forEach(lvl => {
    const row = byLevel[lvl];
    const rowWidth = row.length * NODE_W + (row.length - 1) * NODE_GAP_X;
    if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
  });

  const svgW = Math.max(400, maxRowWidth + PAD_X * 2);

  const minLevel = levels.length > 0 ? Math.min(...levels) : 0;
  const maxLevel = levels.length > 0 ? Math.max(...levels) : 0;

  levels.forEach(lvl => {
    const row = byLevel[lvl];
    const rowWidth = row.length * NODE_W + (row.length - 1) * NODE_GAP_X;
    const startX = (svgW - rowWidth) / 2;
    // Shift so that minLevel maps to row 0 (top)
    const y = PAD_Y + (lvl - minLevel) * ROW_H;
    row.forEach((n, i) => {
      positions[n.authorId] = { x: startX + i * (NODE_W + NODE_GAP_X), y };
    });
  });

  const svgH = PAD_Y * 2 + (maxLevel - minLevel) * ROW_H + NODE_H;

  return { positions, svgW, svgH };
}

// ---------- Node ----------

function GenealogyNode({ node, pos, selected, onClick }) {
  const conf = node.confidence || 'medium';
  const color = CONFIDENCE_COLORS[conf] || CONFIDENCE_COLORS.medium;
  const isSel = selected === node.authorId;

  const affil = (node.affiliations || [])[0] || '';

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(node.authorId)}
    >
      {/* Background rect */}
      <rect
        width={NODE_W} height={NODE_H}
        rx={4}
        fill={isSel ? '#FFF8F0' : '#FFFFFF'}
        stroke={isSel ? color : '#E8E2D5'}
        strokeWidth={isSel ? 1.5 : 1}
      />
      {/* Top accent bar */}
      <rect width={NODE_W} height={3} rx={2} fill={color} />

      {/* Name */}
      <text
        x={8} y={20}
        fontFamily="'Fraunces', serif"
        fontSize={12}
        fontWeight={600}
        fill="#1A1611"
      >
        {truncate(node.name, 20)}
      </text>

      {/* Affiliation */}
      {affil && (
        <text
          x={8} y={34}
          fontFamily="'Geist', sans-serif"
          fontSize={9}
          fill="#8B7355"
        >
          {truncate(affil, 24)}
        </text>
      )}

      {/* hIndex / citations */}
      <text
        x={8} y={58}
        fontFamily="'Geist', sans-serif"
        fontSize={9}
        fill="#A09080"
      >
        {node.hIndex != null ? `h=${node.hIndex}` : ''}
        {node.hIndex != null && node.citationCount ? '  ' : ''}
        {node.citationCount ? `${(node.citationCount / 1000).toFixed(0)}k cit.` : ''}
      </text>
    </g>
  );
}

// ---------- Edge ----------

function GenealogyEdge({ edge, positions }) {
  const src = positions[edge.source];
  const tgt = positions[edge.target];
  if (!src || !tgt) return null;

  const x1 = src.x + NODE_W / 2;
  const y1 = src.y + NODE_H;
  const x2 = tgt.x + NODE_W / 2;
  const y2 = tgt.y;

  const mid = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  const color = CONFIDENCE_COLORS[edge.confidence] || CONFIDENCE_COLORS.medium;

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeOpacity={0.7}
      markerEnd={`url(#arrow-${edge.confidence})`}
    />
  );
}

// ---------- Side panel ----------

function SidePanel({ node, edges, t, onClose, onQuickSearch }) {
  if (!node) return null;
  const tg = t.genealogy;
  const conf = node.confidence || 'medium';
  const color = CONFIDENCE_COLORS[conf] || CONFIDENCE_COLORS.medium;

  // Find inbound edge to this node
  const inboundEdge = edges.find(e => e.target === node.authorId);

  const ssUrl = `https://www.semanticscholar.org/author/${node.authorId}`;

  return (
    <div style={{
      width: 280,
      minWidth: 240,
      borderLeft: '1px solid #E8E2D5',
      padding: '16px 14px',
      overflowY: 'auto',
      background: '#FDFAF5',
      fontFamily: "'Geist', sans-serif",
      fontSize: 12,
    }}>
      {/* Close */}
      <button
        onClick={onClose}
        style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#8B7355' }}
      >✕</button>

      {/* Name */}
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#1A1611' }}>
        {node.name}
      </div>

      {/* Node type */}
      <div style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        background: color,
        color: '#FAF7F2',
        fontSize: 9,
        fontWeight: 600,
        marginBottom: 10,
      }}>
        {node.generationLevel === 0
          ? tg.generationRoot
          : node.generationLevel < 0
          ? tg.generationAdvisor
          : node.generationLevel === 2
          ? tg.generationDepth2
          : tg.generationCandidate}
      </div>

      {/* Affiliations */}
      <div style={{ marginBottom: 8 }}>
        {(node.affiliations || []).length > 0
          ? node.affiliations.map((a, i) => (
              <div key={i} style={{ color: '#5A4E3C', marginBottom: 2 }}>{a}</div>
            ))
          : <div style={{ color: '#B0A898', fontSize: 11 }}>{tg.noAffiliation}</div>
        }
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, color: '#8B7355', fontSize: 11 }}>
        {node.hIndex != null && <span>h-index: {node.hIndex}</span>}
        {node.citationCount > 0 && <span>{node.citationCount.toLocaleString()} citations</span>}
      </div>

      {/* Lab focus */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#8B7355', letterSpacing: '0.05em', marginBottom: 3 }}>
          {tg.labFocusLabel.toUpperCase()}
        </div>
        <div style={{ color: '#3A342B' }}>
          {node.labFocus || <span style={{ color: '#B0A898' }}>{tg.noLabFocus}</span>}
        </div>
      </div>

      {/* Confidence & evidence */}
      {inboundEdge && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#8B7355', letterSpacing: '0.05em', marginBottom: 3 }}>
            {tg.evidenceLabel.toUpperCase()}
          </div>
          <div style={{ color: '#3A342B', marginBottom: 2 }}>
            {tg.sharedPapers(inboundEdge.sharedPaperCount)}
          </div>
          {inboundEdge.evidence?.sharedAffiliationMatches?.length > 0 && (
            <div style={{ color: '#5A4E3C', fontSize: 11 }}>
              {inboundEdge.evidence.sharedAffiliationMatches[0]}
            </div>
          )}
          <div style={{ marginTop: 4, color: '#8B7355', fontSize: 10 }}>
            {conf === 'high' ? tg.confidenceHigh : conf === 'medium' ? tg.confidenceMedium : tg.confidenceLow}
          </div>
        </div>
      )}

      {/* Quick Search button */}
      {onQuickSearch && (
        <button
          onClick={() => { onQuickSearch(node.name); onClose(); }}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: '#1A1611',
            color: '#FAF7F2',
            border: 'none',
            borderRadius: 4,
            fontFamily: "'Geist', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          {tg.searchPapersBtn}
        </button>
      )}

      {/* SS link */}
      {!node.authorId?.startsWith('wd:') && (
        <a
          href={ssUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#8B6A42', fontSize: 11, textDecoration: 'none' }}
        >
          {tg.viewOnSS}
        </a>
      )}
    </div>
  );
}

// ---------- Graph view ----------

function GraphView({ result, selectedId, onSelectNode, t, onQuickSearch }) {
  const tg = t.genealogy;

  // Filter: root PI always shown; advisors (level < 0) always shown;
  // students shown only if high or medium confidence
  const graphNodes = result.nodes.filter(
    n => n.generationLevel <= 0 || n.confidence === 'high' || n.confidence === 'medium'
  );
  const graphNodeIds = new Set(graphNodes.map(n => n.authorId));
  const graphEdges = result.edges.filter(
    e => graphNodeIds.has(e.source) && graphNodeIds.has(e.target)
  );

  const { positions, svgW, svgH } = computeTreeLayout(graphNodes);

  const selectedNode = result.nodes.find(n => n.authorId === selectedId) || null;

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <svg width={svgW} height={svgH}>
          <defs>
            {['high', 'medium', 'low'].map(conf => (
              <marker
                key={conf}
                id={`arrow-${conf}`}
                markerWidth={8} markerHeight={8}
                refX={6} refY={3}
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" fill={CONFIDENCE_COLORS[conf]} fillOpacity={0.7} />
              </marker>
            ))}
          </defs>

          {/* Edges first */}
          {graphEdges.map((edge, i) => (
            <GenealogyEdge key={i} edge={edge} positions={positions} />
          ))}

          {/* Nodes */}
          {graphNodes.map(node => {
            const pos = positions[node.authorId];
            if (!pos) return null;
            return (
              <GenealogyNode
                key={node.authorId}
                node={node}
                pos={pos}
                selected={selectedId}
                onClick={onSelectNode}
              />
            );
          })}
        </svg>
      </div>

      {selectedNode && (
        <SidePanel
          node={selectedNode}
          edges={result.edges}
          t={t}
          onClose={() => onSelectNode(null)}
          onQuickSearch={onQuickSearch}
        />
      )}
    </div>
  );
}

// ---------- Full list view ----------

function AllResultsList({ result, t }) {
  const tg = t.genealogy;
  const allNodes = [...result.nodes].sort((a, b) => {
    if (a.generationLevel !== b.generationLevel) return a.generationLevel - b.generationLevel;
    return (b.citationCount || 0) - (a.citationCount || 0);
  });

  return (
    <div style={{ padding: '0 4px' }}>
      {allNodes.map(node => {
        const inboundEdge = result.edges.find(e => e.target === node.authorId);
        const conf = node.confidence || null;
        const color = conf ? CONFIDENCE_COLORS[conf] : '#1A1611';

        return (
          <div
            key={node.authorId}
            style={{
              padding: '12px 14px',
              border: '1px solid #E8E2D5',
              borderRadius: 6,
              marginBottom: 8,
              background: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                padding: '2px 8px',
                borderRadius: 12,
                background: color,
                color: '#FAF7F2',
                fontSize: 9,
                fontWeight: 600,
              }}>
                {node.generationLevel === 0
                  ? tg.generationRoot
                  : node.generationLevel < 0
                  ? tg.generationAdvisor
                  : node.generationLevel === 2
                  ? tg.generationDepth2
                  : tg.generationCandidate}
              </span>
              {conf && conf !== 'high' && (
                <span style={{ fontSize: 10, color: color }}>
                  {conf === 'medium' ? tg.confidenceMedium : tg.confidenceLow}
                </span>
              )}
            </div>

            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 13, fontWeight: 600, color: '#1A1611', marginBottom: 2 }}>
              {node.name}
            </div>

            {(node.affiliations || []).length > 0 && (
              <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 4 }}>
                {node.affiliations[0]}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#A09080' }}>
              {node.hIndex != null && <span>h={node.hIndex}</span>}
              {node.citationCount > 0 && <span>{node.citationCount.toLocaleString()} cit.</span>}
              {inboundEdge && <span>{tg.sharedPapers(inboundEdge.sharedPaperCount)}</span>}
            </div>

            {node.labFocus && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#5A4E3C' }}>{node.labFocus}</div>
            )}

            <a
              href={`https://www.semanticscholar.org/author/${node.authorId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 6, fontSize: 10, color: '#8B6A42', textDecoration: 'none' }}
            >
              {tg.viewOnSS}
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Main component ----------

export default function LabGenealogy({ embedded = false, onQuickSearch }) {
  const { t, lang } = useLanguage();
  const tg = t.genealogy;
  const ts = t.search;

  const [query, setQuery] = useState('');
  const [maxDepth, setMaxDepth] = useState(1);
  const [buildState, setBuildState] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const abortRef = useRef(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [acLoading, setAcLoading] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const totalNodes = result?.nodes?.length ?? 0;
  const acAbortRef = useRef(null); // abort controller for in-flight autocomplete request

  // Debounced autocomplete fetch — cancels previous in-flight request on each keystroke
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    // Cancel pending debounce
    clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      if (acAbortRef.current) { acAbortRef.current.abort(); acAbortRef.current = null; }
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // Cancel any still-running request from a previous keystroke
      if (acAbortRef.current) acAbortRef.current.abort();
      const controller = new AbortController();
      acAbortRef.current = controller;

      setAcLoading(true);
      try {
        const resp = await fetch(
          `${API}/lab-genealogy/author-search?q=${encodeURIComponent(val.trim())}`,
          { signal: controller.signal },
        );
        if (!resp.ok) return;
        const data = await resp.json();
        const candidates = data.candidates || [];
        setSuggestions(candidates);
        if (candidates.length > 0) {
          // Decide whether to open up or down based on available viewport space
          if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            setDropUp(spaceBelow < 220 && spaceAbove > spaceBelow);
          }
          setShowSuggestions(true);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          // silent — autocomplete errors shouldn't block the user
        }
      } finally {
        setAcLoading(false);
        acAbortRef.current = null;
      }
    }, 400);
  };

  const handleSelectSuggestion = (candidate) => {
    setQuery(candidate.name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleBuild = async () => {
    if (!query.trim()) return;
    setShowSuggestions(false);

    setBuildState('loading');
    setResult(null);
    setSelectedId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(`${API}/lab-genealogy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_author_name: query.trim(),
          max_depth: maxDepth,
          lang: lang || 'en',
        }),
        signal: controller.signal,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setResult(data);
      setBuildState('done');
    } catch (err) {
      if (err.name === 'AbortError') {
        setBuildState('idle');
      } else {
        setBuildState('error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setBuildState('idle');
  };

  const hasNodes = result?.nodes?.length > 0;

  return (
    <div style={{ fontFamily: "'Geist', sans-serif", padding: embedded ? 0 : 16 }}>
      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {/* Input + dropdown wrapper */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && buildState !== 'loading') { setShowSuggestions(false); handleBuild(); }
              if (e.key === 'Escape') setShowSuggestions(false);
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder={tg.placeholder}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 12px',
              border: '1px solid #D8D0BE',
              borderRadius: 4,
              fontFamily: "'Geist', sans-serif",
              fontSize: 13,
              background: '#FAFAF8',
              color: '#1A1611',
            }}
          />

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              style={{
                position: 'absolute',
                ...(dropUp
                  ? { bottom: '100%', top: 'auto', borderBottom: 'none', borderTop: '1px solid #D8D0BE', borderRadius: '4px 4px 0 0', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }
                  : { top: '100%', bottom: 'auto', borderTop: 'none', borderRadius: '0 0 4px 4px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }
                ),
                left: 0,
                right: 0,
                zIndex: 100,
                background: '#FFFFFF',
                border: '1px solid #D8D0BE',
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {suggestions.map((s, i) => (
                <div
                  key={s.authorId || i}
                  onMouseDown={() => handleSelectSuggestion(s)}
                  style={{
                    padding: '9px 12px',
                    cursor: 'pointer',
                    borderBottom: i < suggestions.length - 1 ? '1px solid #F0EBE0' : 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FDF8F0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontSize: 13, color: '#1A1611', fontWeight: 500 }}>{s.name}</div>
                  {(s.affiliations || []).length > 0 && (
                    <div style={{ fontSize: 11, color: '#8B7355', marginTop: 1 }}>
                      {s.affiliations[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Depth toggle */}
        <div style={{
          display: 'flex',
          gap: 0,
          border: '1px solid #D8D0BE',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          {[1, 2].map(d => (
            <button
              key={d}
              onClick={() => setMaxDepth(d)}
              style={{
                padding: '8px 12px',
                background: maxDepth === d ? '#1A1611' : '#FAFAF8',
                color: maxDepth === d ? '#FAF7F2' : '#6B6358',
                border: 'none',
                fontFamily: "'Geist', sans-serif",
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {d === 1 ? tg.depthOne : tg.depthTwo}
            </button>
          ))}
        </div>

        {buildState === 'loading' ? (
          <button
            onClick={handleCancel}
            style={{
              padding: '9px 16px',
              background: '#E8E2D5',
              border: 'none',
              borderRadius: 4,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              cursor: 'pointer',
              color: '#3A342B',
            }}
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={handleBuild}
            disabled={!query.trim()}
            style={{
              padding: '9px 16px',
              background: query.trim() ? '#1A1611' : '#E8E2D5',
              color: query.trim() ? '#FAF7F2' : '#A09080',
              border: 'none',
              borderRadius: 4,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: query.trim() ? 'pointer' : 'default',
            }}
          >
            {tg.buildBtn}
          </button>
        )}
      </div>

      {/* Always-visible disclaimer */}
      <div style={{
        padding: '7px 10px',
        background: '#FFF8EE',
        border: '1px solid #E8D9B8',
        borderRadius: 4,
        fontSize: 11,
        color: '#7A5E28',
        marginBottom: 12,
      }}>
        {tg.warning}
      </div>

      {/* Loading */}
      {buildState === 'loading' && (
        <div style={{ padding: '24px 8px', textAlign: 'center', color: '#8B7355' }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>{tg.loading}</div>
          <div style={{ fontSize: 11, color: '#A09080' }}>{tg.loadingHint}</div>
        </div>
      )}

      {/* Error */}
      {buildState === 'error' && (
        <div style={{ padding: '20px 8px', textAlign: 'center', color: '#C0392B', fontSize: 13 }}>
          {tg.error}
        </div>
      )}

      {/* Empty result */}
      {buildState === 'done' && !hasNodes && (
        <div style={{ padding: '20px 8px', textAlign: 'center', color: '#8B7355', fontSize: 13 }}>
          {result?.warning || tg.empty}
        </div>
      )}

      {/* Partial result warning */}
      {buildState === 'done' && hasNodes && result?.warning && (
        <div style={{ padding: '6px 10px', background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 4, fontSize: 11, color: '#7A4A00', marginBottom: 8 }}>
          {tg.partialResult}
        </div>
      )}

      {/* Results */}
      {buildState === 'done' && hasNodes && (
        <>
          {/* Tab toggle */}
          <div style={{ display: 'flex', gap: 0, background: '#FFFFFF', border: '1px solid #E8E2D5', borderRadius: 4, padding: 3, marginBottom: 12 }}>
            {[
              { key: 'graph', label: tg.graphTab },
              { key: 'list', label: tg.listTab(totalNodes) },
            ].map(({ key, label }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: active ? '#1A1611' : 'transparent',
                    color: active ? '#FAF7F2' : '#6B6358',
                    border: 'none',
                    borderRadius: 2,
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {activeTab === 'graph' && (
            <GraphView
              result={result}
              selectedId={selectedId}
              onSelectNode={setSelectedId}
              t={t}
              onQuickSearch={onQuickSearch}
            />
          )}

          {activeTab === 'list' && (
            <AllResultsList result={result} t={t} />
          )}
        </>
      )}
    </div>
  );
}
