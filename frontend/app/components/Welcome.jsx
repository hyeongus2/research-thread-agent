import { ChevronRight } from 'lucide-react';

export default function Welcome({ onStart }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '60px 28px 32px',
      justifyContent: 'space-between',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 52,
          lineHeight: 0.95,
          fontWeight: 400,
          color: '#1A1611',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          Every day,<br />
          <span style={{ fontStyle: 'italic', fontWeight: 300 }}>the papers</span><br />
          worth reading.
        </h1>
        <div style={{
          marginTop: 32,
          fontFamily: "'Geist', sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          color: '#6B6358',
          maxWidth: 280,
        }}>
          Papers, models, and repos from arXiv, Hugging Face, and GitHub — curated to your interests, delivered daily.
        </div>
        <div style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: "'Geist', sans-serif",
          fontSize: 12,
          color: '#1A1611',
        }}>
          <div style={{ width: 28, height: 1, background: '#1A1611' }} />
          <span style={{ fontStyle: 'italic', fontFamily: "'Fraunces', serif", fontSize: 14 }}>
            Beyond the Pond, Into the Open
          </span>
        </div>
      </div>
      <button
        onClick={onStart}
        style={{
          width: '100%',
          padding: '18px',
          background: '#1A1611',
          color: '#FAF7F2',
          border: 'none',
          borderRadius: 0,
          fontSize: 15,
          fontWeight: 500,
          fontFamily: "'Geist', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          letterSpacing: '0.02em',
        }}
      >
        Get Started <ChevronRight size={18} />
      </button>
    </div>
  );
}
