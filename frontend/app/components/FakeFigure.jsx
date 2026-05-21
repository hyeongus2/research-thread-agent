export default function FakeFigure({ type }) {
  const baseStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '6px',
    position: 'relative',
    overflow: 'hidden',
    background: '#F5F0E8',
  };

  if (type === 'curves') {
    return (
      <div style={baseStyle}>
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <path d="M 10 80 Q 50 20, 100 50 T 190 30" stroke="#C84B31" strokeWidth="2" fill="none" />
          <path d="M 10 85 Q 50 60, 100 70 T 190 60" stroke="#1A1611" strokeWidth="1.5" fill="none" strokeDasharray="3,3" />
          <line x1="10" y1="90" x2="190" y2="90" stroke="#6B6358" strokeWidth="0.5" />
          <line x1="10" y1="10" x2="10" y2="90" stroke="#6B6358" strokeWidth="0.5" />
        </svg>
      </div>
    );
  }
  if (type === 'bars') {
    return (
      <div style={baseStyle}>
        <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', alignItems: 'flex-end', gap: 4, height: 'calc(100% - 16px)' }}>
          {[60, 40, 80, 55, 90, 70, 45].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 4 ? '#C84B31' : '#1A1611', borderRadius: '2px 2px 0 0', opacity: i === 4 ? 1 : 0.7 }} />
          ))}
        </div>
      </div>
    );
  }
  if (type === 'heatmap') {
    const values = [0.2, 0.8, 0.4, 0.1, 0.9, 0.3, 0.6, 0.2,
                    0.5, 0.3, 0.7, 0.4, 0.2, 0.8, 0.1, 0.5,
                    0.1, 0.6, 0.3, 0.9, 0.4, 0.2, 0.7, 0.3,
                    0.4, 0.2, 0.5, 0.1, 0.8, 0.6, 0.3, 0.7];
    return (
      <div style={baseStyle}>
        <div style={{ position: 'absolute', inset: 8, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
          {values.map((v, i) => (
            <div key={i} style={{ background: `rgba(200, 75, 49, ${v})`, borderRadius: 1 }} />
          ))}
        </div>
      </div>
    );
  }
  if (type === 'pie') {
    return (
      <div style={baseStyle}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          <circle cx="50" cy="50" r="35" fill="none" stroke="#E8E2D5" strokeWidth="20" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#C84B31" strokeWidth="20" strokeDasharray="154 220" transform="rotate(-90 50 50)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#1A1611" strokeWidth="20" strokeDasharray="44 220" strokeDashoffset="-154" transform="rotate(-90 50 50)" />
        </svg>
      </div>
    );
  }
  return <div style={baseStyle} />;
}
