'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const TYPE_COLORS = {
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

export function makeBibtex(item) {
  const firstAuthor = (item.authors?.[0] || 'unknown').split(' ').pop().toLowerCase().replace(/[^a-z]/g, '');
  const year = (item.published_date || '').slice(0, 4) || 'unknown';
  const authors = (item.authors || []).join(' and ');
  const type = item.venue ? 'inproceedings' : 'article';
  const venueField = item.venue
    ? `  booktitle = {${item.venue}},\n`
    : `  journal   = {arXiv preprint},\n`;
  return `@${type}{${firstAuthor}${year},\n  title     = {${item.title || ''}},\n  author    = {${authors}},\n  year      = {${year}},\n${venueField}}`;
}

function relTime(isoTs) {
  if (!isoTs) return '';
  const diff = Date.now() - new Date(isoTs).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '< 1h ago';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Unified paper / model / repo card.
 *
 * Props:
 *   item            - paper/model/repo data object
 *   type            - 'paper' | 'model' | 'repo'  (default 'paper')
 *   badgeLabel      - override type badge text (e.g. 'SEED', 'REF')
 *   showTypeBadge   - show the PAPER/MODEL/REPO badge (default true)
 *
 *   Action buttons (Quick Search / Venues):
 *   showCite        - show BibTeX copy button
 *   showCode        - show code link button (reads item.code_links)
 *   onSummarize     - callback; if provided shows AI Summary button
 *   summary         - AI summary string (shown below buttons)
 *   summaryLoading  - bool
 *   summaryNoKey    - bool (show "add API key" hint instead of button)
 *
 *   Learning Path AI analysis (reads from item fields directly):
 *   analysisNoKey   - show "add API key" card when no analysis present
 *
 *   My Feed extras (reads from item fields):
 *   showTopicBadge  - show item.topic as a colored chip
 *   showReadDot     - show red dot when !item.is_read
 *   showTimestamp   - show item.created_at as relative time
 */
export default function PaperCard({
  item,
  type = 'paper',
  badgeLabel,
  showTypeBadge = true,
  showCite = false,
  showCode = false,
  onSummarize,
  summary,
  summaryLoading,
  summaryNoKey,
  analysisNoKey = false,
  showTopicBadge = false,
  showReadDot = false,
  showTimestamp = false,
}) {
  const { t } = useLanguage();
  const ts = t.search;
  const tl = t.learningPath;
  const [expanded, setExpanded] = useState(false);
  const [citeCopied, setCiteCopied] = useState(false);

  const title = item.title || item.name || '';
  const url = item.url || item.pdf_url || '#';
  const abstract = item.abstract || '';
  const colors = TYPE_COLORS[type] || TYPE_COLORS.paper;
  const typeBadge = badgeLabel || { paper: 'PAPER', model: 'MODEL', repo: 'REPO' }[type] || 'PAPER';
  const citationCount = item.citation_count ?? item.citationCount ?? 0;

  // Meta line
  let meta = '';
  if (type === 'paper') {
    const authors = Array.isArray(item.authors)
      ? item.authors.slice(0, 2).join(', ')
      : item.authors || '';
    const year = item.published_date
      ? item.published_date.slice(0, 4)
      : item.year ? String(item.year) : '';
    meta = [authors, year].filter(Boolean).join(' · ');
    if (item.venue) meta = item.venue + (meta ? ' · ' + meta : '');
  } else if (type === 'model') {
    const dl = item.downloads ? `↓ ${(item.downloads / 1000).toFixed(0)}K` : '';
    meta = [item.pipeline_tag, dl].filter(Boolean).join(' · ');
  } else {
    const stars = item.stars ? `★ ${item.stars.toLocaleString()}` : '';
    meta = [item.language, stars].filter(Boolean).join(' · ');
  }

  const ABSTRACT_THRESHOLD = 200;
  const needsToggle = type === 'paper' && abstract.length > ABSTRACT_THRESHOLD;

  const analysisFields = [
    { key: 'problem',      label: tl.problem,      color: ANALYSIS_COLORS.problem },
    { key: 'solution',     label: tl.solution,      color: ANALYSIS_COLORS.solution },
    { key: 'significance', label: tl.significance,  color: ANALYSIS_COLORS.significance },
    { key: 'limitations',  label: tl.limitations,   color: ANALYSIS_COLORS.limitations },
  ];
  const hasAnalysis = type === 'paper' && analysisFields.some(f => item[f.key]);
  const hasActions = showCite || showCode || !!onSummarize;

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D5', marginBottom: 14, borderRadius: 4, overflow: 'hidden' }}>
      <a href={url} target="_blank" rel="noreferrer"
        style={{ display: 'block', padding: '18px 20px 14px', textDecoration: 'none', color: '#1A1611' }}>

        {/* Top row: badges + arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {showTypeBadge && (
              <span style={{
                background: colors.bg, color: colors.fg,
                padding: '3px 8px', borderRadius: 2,
                fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                fontFamily: "'Geist', sans-serif",
              }}>
                {typeBadge}
              </span>
            )}
            {citationCount > 0 && (
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', fontWeight: 500 }}>
                {ts.citations(citationCount)}
              </span>
            )}
            {showTopicBadge && item.topic && (
              <span style={{
                fontFamily: "'Geist', sans-serif", fontSize: 10,
                color: '#C84B31', background: '#FFF0EC',
                padding: '2px 7px', borderRadius: 10, letterSpacing: '0.05em',
              }}>
                {item.topic}
              </span>
            )}
            {showTimestamp && item.created_at && (
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: '#9E9485' }}>
                {relTime(item.created_at)}
              </span>
            )}
            {showReadDot && !item.is_read && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C84B31', display: 'inline-block', flexShrink: 0 }} />
            )}
          </div>
          <ArrowUpRight size={14} style={{ color: '#6B6358', flexShrink: 0 }} />
        </div>

        {/* Title */}
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, lineHeight: 1.25, fontWeight: 500, color: '#1A1611', margin: '0 0 10px' }}>
          {title}
        </h3>

        {/* Abstract */}
        {type === 'paper' && abstract && (
          <p style={{
            fontFamily: "'Geist', sans-serif", fontSize: 12, lineHeight: 1.6,
            color: '#3A342B', margin: '0 0 8px',
            display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 3,
            WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden',
          }}>
            {abstract}
          </p>
        )}

        {/* Description (model / repo) */}
        {type !== 'paper' && item.description && (
          <p style={{
            fontFamily: "'Geist', sans-serif", fontSize: 12, lineHeight: 1.5,
            color: '#3A342B', margin: '0 0 8px', overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
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

        {/* Learning Path AI analysis */}
        {hasAnalysis && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0EAD9', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analysisFields.map(({ key, label, color }) =>
              item[key] ? (
                <div key={key}>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 9, fontWeight: 700, color, letterSpacing: '0.1em' }}>
                    {label}
                  </span>
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', margin: '3px 0 0', lineHeight: 1.55 }}>
                    {item[key]}
                  </p>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* LP: API key prompt when no analysis */}
        {type === 'paper' && analysisNoKey && !hasAnalysis && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0EAD9', fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#A09880', lineHeight: 1.4 }}>
            {tl.noApiKeyCard}
          </div>
        )}
      </a>

      {/* Bottom bar: abstract toggle + action buttons */}
      {(needsToggle || hasActions) && (
        <div style={{ borderTop: '1px solid #F0EBE2' }}>
          <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {needsToggle ? (
              <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', padding: 0, fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', cursor: 'pointer' }}>
                {expanded ? ts.hideAbstract : ts.showAbstract}
              </button>
            ) : <span />}

            {hasActions && type === 'paper' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                {showCode && item.code_links?.length > 0 && (() => {
                  const best = item.code_links.find(l => l.is_official) || item.code_links[0];
                  return (
                    <a href={best.repo_url} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: 'none', border: '1px solid #D8D0BE', borderRadius: 3, padding: '3px 10px', fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#6B6358', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                      {ts.codeBtn}
                    </a>
                  );
                })()}
                {showCite && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      navigator.clipboard.writeText(makeBibtex(item));
                      setCiteCopied(true);
                      setTimeout(() => setCiteCopied(false), 1500);
                    }}
                    style={{ background: 'none', border: '1px solid #D8D0BE', borderRadius: 3, padding: '3px 10px', fontFamily: "'Geist', sans-serif", fontSize: 11, color: citeCopied ? '#4A7C59' : '#6B6358', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
                    {citeCopied ? ts.bibtexCopied : ts.bibtexBtn}
                  </button>
                )}
                {onSummarize && abstract && !summary && (
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
              </div>
            )}
          </div>
          {summary && (
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', margin: 0, lineHeight: 1.6, padding: '0 20px 12px' }}>
              {summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
