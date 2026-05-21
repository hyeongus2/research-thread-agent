'use client';

import { useState } from 'react';
import { Bookmark, Settings, Bell, FlaskConical, Sparkles, Box, Play, ArrowUpRight } from 'lucide-react';
import { MOCK_PAPERS } from '../data';
import FakeFigure from './FakeFigure';

// =============================================================================
// Paper card
// =============================================================================
function PaperCard({ paper, onTap, onSave, isSaved }) {
  return (
    <div
      onClick={onTap}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D5',
        marginBottom: 14,
        padding: '22px 20px',
        cursor: 'pointer',
        borderRadius: 4,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          fontFamily: "'Geist', sans-serif",
          color: '#6B6358',
          letterSpacing: '0.02em',
        }}>
          <span style={{
            background: '#FFE8E0',
            color: '#8B2E1B',
            padding: '3px 8px',
            borderRadius: 2,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}>
            {paper.category}
          </span>
          <span>▲ {paper.upvotes}</span>
          <span>·</span>
          <span>{paper.daysAgo}d ago</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          style={{ background: 'none', border: 'none', padding: 4, color: isSaved ? '#C84B31' : '#6B6358' }}
        >
          <Bookmark size={16} fill={isSaved ? '#C84B31' : 'none'} />
        </button>
      </div>

      <h3 style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 22,
        lineHeight: 1.18,
        fontWeight: 500,
        color: '#1A1611',
        margin: 0,
        marginBottom: 14,
        letterSpacing: '-0.01em',
      }}>
        {paper.headline}
      </h3>

      <div style={{ height: 90, marginBottom: 14 }}>
        <FakeFigure type={paper.figure} />
      </div>

      <p style={{
        fontFamily: "'Geist', sans-serif",
        fontSize: 13,
        lineHeight: 1.55,
        color: '#3A342B',
        margin: 0,
        marginBottom: 14,
      }}>
        {paper.tldr}
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '10px 12px',
        background: '#FAF7F2',
        borderLeft: '2px solid #C84B31',
        marginBottom: paper.models > 0 || paper.demos > 0 ? 14 : 0,
      }}>
        <Sparkles size={12} style={{ color: '#C84B31', marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B', lineHeight: 1.4 }}>
          {paper.reason}
        </span>
      </div>

      {(paper.models > 0 || paper.demos > 0) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingTop: 12,
          borderTop: '1px solid #F0EAD9',
        }}>
          <span style={{ fontSize: 14 }}>🤗</span>
          {paper.models > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              color: '#1A1611',
              fontWeight: 500,
            }}>
              <Box size={12} /> {paper.models} model{paper.models > 1 ? 's' : ''}
            </span>
          )}
          {paper.demos > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              color: '#C84B31',
              fontWeight: 600,
            }}>
              <Play size={12} fill="#C84B31" /> Live demo
            </span>
          )}
          <span style={{
            marginLeft: 'auto',
            fontFamily: "'Geist', sans-serif",
            fontSize: 11,
            color: '#6B6358',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}>
            Read more <ArrowUpRight size={11} />
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Feed main
// =============================================================================
export default function Feed({ onSettings, onPaperTap, saved, onToggleSave }) {
  const [skippedIds] = useState([]);
  const papers = MOCK_PAPERS.filter(p => !skippedIds.includes(p.id));

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF7F2' }}>
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
            TODAY'S FEED · {dateLabel}
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

      <div style={{ padding: '14px 24px', background: '#FAF7F2', display: 'flex', alignItems: 'center', gap: 8 }}>
        <FlaskConical size={14} style={{ color: '#C84B31' }} />
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#3A342B' }}>
          <strong style={{ color: '#1A1611' }}>{papers.length} papers</strong> in your areas today
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 80px', background: '#FAF7F2' }}>
        {papers.map(p => (
          <PaperCard
            key={p.id}
            paper={p}
            onTap={() => onPaperTap(p)}
            onSave={() => onToggleSave(p.id)}
            isSaved={saved.includes(p.id)}
          />
        ))}
        {papers.length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#1A1611', fontStyle: 'italic' }}>
              All caught up!
            </div>
            <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#6B6358', marginTop: 8 }}>
              Check back tomorrow for fresh papers ✦
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
