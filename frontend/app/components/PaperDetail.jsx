'use client';

import { ChevronLeft, Box, Play, ArrowUpRight } from 'lucide-react';
import FakeFigure from './FakeFigure';
import { useLanguage } from '../context/LanguageContext';

export default function PaperDetail({ paper, onClose }) {
  const { t } = useLanguage();
  const td = t.detail;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#FAF7F2',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10,
    }}>
      <div style={{
        padding: '52px 24px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #E8E2D5',
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#1A1611',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: "'Geist', sans-serif",
            fontSize: 13,
          }}
        >
          <ChevronLeft size={18} /> {td.backToFeed}
        </button>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6B6358' }}>
          arXiv:{paper.arxivId}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 40px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          fontSize: 11,
          fontFamily: "'Geist', sans-serif",
          color: '#6B6358',
        }}>
          <span style={{
            background: '#FFE8E0',
            color: '#8B2E1B',
            padding: '3px 8px',
            borderRadius: 2,
            fontSize: 10,
            fontWeight: 600,
          }}>
            {paper.category}
          </span>
          <span>▲ {paper.upvotes} {td.upvotes}</span>
          <span>·</span>
          <span>{paper.authors}</span>
        </div>

        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 28,
          lineHeight: 1.15,
          fontWeight: 500,
          color: '#1A1611',
          margin: 0,
          marginBottom: 20,
          letterSpacing: '-0.01em',
        }}>
          {paper.headline}
        </h1>

        <div style={{ height: 160, marginBottom: 24 }}>
          <FakeFigure type={paper.figure} />
        </div>

        <div style={sectionLabel}>{td.tldr}</div>
        <p style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 17,
          lineHeight: 1.55,
          color: '#1A1611',
          margin: 0,
          marginBottom: 24,
          fontStyle: 'italic',
        }}>
          {paper.tldr}
        </p>

        {(paper.models > 0 || paper.demos > 0) && (
          <>
            <div style={sectionLabel}>{td.onHuggingFace}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {paper.models > 0 && (
                <a
                  href={`https://huggingface.co/models?search=${encodeURIComponent(paper.arxivId)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px',
                    background: '#FFFFFF',
                    border: '1px solid #E8E2D5',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 13,
                    color: '#1A1611',
                  }}
                >
                  <Box size={16} />
                  <span style={{ flex: 1 }}>{td.modelsAvailable(paper.models)}</span>
                  <ArrowUpRight size={14} style={{ color: '#6B6358' }} />
                </a>
              )}
              {paper.demos > 0 && (
                <a
                  href={`https://huggingface.co/spaces?search=${encodeURIComponent(paper.arxivId)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px',
                    background: '#1A1611',
                    border: 'none',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 13,
                    color: '#FAF7F2',
                    fontWeight: 500,
                  }}
                >
                  <Play size={16} fill="#FAF7F2" />
                  <span style={{ flex: 1 }}>{td.runLiveDemo}</span>
                  <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          </>
        )}

        <div style={sectionLabel}>{td.whyRecommended}</div>
        <div style={{
          padding: '14px 16px',
          background: '#FFFFFF',
          borderLeft: '2px solid #C84B31',
          borderRadius: '0 4px 4px 0',
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
          color: '#3A342B',
          lineHeight: 1.55,
        }}>
          {paper.reason}
        </div>
      </div>
    </div>
  );
}

const sectionLabel = {
  fontFamily: "'Geist', sans-serif",
  fontSize: 11,
  color: '#6B6358',
  letterSpacing: '0.1em',
  marginBottom: 8,
};
