import { Link, useLocation } from 'react-router-dom'

export const C = {
  bg: '#FAFAF9',
  bgAccent: '#FFFFFF',
  ink: '#0B0B0C',
  ink2: '#2A2A2E',
  muted: '#6B6B72',
  line: '#E6E6E3',
  lineStrong: '#CFCFC9',
  red: '#D82828',
  redDark: '#A51D1D',
  gold: '#C9A14C',
  alpine: '#1E3A5F',
}

export const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
export const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace"

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] } },
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.ink,
      fontFamily: FONT,
      fontFeatureSettings: '"ss01", "cv11"',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; }
        a:hover { opacity: 0.88; }
        button:focus-visible, a:focus-visible {
          outline: 2px solid ${C.red};
          outline-offset: 3px;
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(216,40,40,0.35); }
          50% { box-shadow: 0 0 0 12px rgba(216,40,40,0); }
        }
      `}</style>
      {children}
    </div>
  )
}

export function Header({ current }) {
  return (
    <header style={{
      borderBottom: `1px solid ${C.line}`,
      background: `${C.bg}EE`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{
        maxWidth: 1180, margin: '0 auto',
        padding: '18px 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 24,
      }}>
        <Link to="/asesoriasuizaguia" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          textDecoration: 'none', color: C.ink,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: C.ink, color: C.bgAccent,
            display: 'grid', placeItems: 'center',
            fontFamily: MONO, fontSize: 12, fontWeight: 700,
            letterSpacing: '-0.03em',
          }}>GP</div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>
            Growth Passport
            <span style={{
              marginLeft: 8, fontWeight: 500,
              color: C.muted, fontSize: 13,
            }}>· Suiza</span>
          </div>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a href="#valor" style={navLink}>Qué incluye</a>
          <Link to="/asesoriasuiza" style={navLink}>Método</Link>
          <Link to="/asesoriasuizaguia/form" style={navCta}>
            Acceder
            <span style={{ marginLeft: 6 }}>→</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer style={{
      borderTop: `1px solid ${C.line}`,
      padding: '36px 24px 40px',
      background: C.bg,
    }}>
      <div style={{
        maxWidth: 1180, margin: '0 auto',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 20,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 11,
          color: C.muted, letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          © Growth Passport · Suiza
        </div>
        <div style={{ display: 'flex', gap: 22, fontFamily: FONT, fontSize: 13 }}>
          <a href="#" style={{ color: C.ink2, textDecoration: 'none' }}>Privacy Policy</a>
          <a href="#" style={{ color: C.ink2, textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </div>
    </footer>
  )
}

const navLink = {
  padding: '8px 14px', borderRadius: 8,
  fontFamily: FONT, fontSize: 13.5, fontWeight: 500,
  color: C.ink2, textDecoration: 'none',
  letterSpacing: '-0.005em',
}

const navCta = {
  display: 'inline-flex', alignItems: 'center',
  padding: '9px 16px', borderRadius: 8,
  background: C.ink, color: C.bgAccent,
  fontFamily: FONT, fontSize: 13, fontWeight: 600,
  textDecoration: 'none',
  letterSpacing: '0.02em',
}
