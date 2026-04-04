import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error de autenticacion');
        return;
      }
      localStorage.setItem('enjambre_token', data.token);
      localStorage.setItem('enjambre_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient orbs */}
      <div style={{
        position: 'fixed', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(245,245,245,0.06), transparent)',
        borderRadius: '50%', filter: 'blur(120px)',
        top: '-15%', right: '-10%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(245,245,245,0.04), transparent)',
        borderRadius: '50%', filter: 'blur(120px)',
        bottom: '-10%', left: '-5%', pointerEvents: 'none',
      }} />

      <div style={{
        width: 420,
        maxWidth: '90vw',
        background: '#0A0A0A',
        border: '1px solid #1A1A1A',
        borderRadius: 16,
        padding: '48px 40px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 20px',
            background: '#F5F5F5',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(245,245,245,0.1)',
          }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#000' }}>BW</span>
          </div>
          <h1 style={{
            fontSize: '1.8rem', fontWeight: 800,
            letterSpacing: 4, margin: 0,
          }}>
            <span style={{
              background: '#F5F5F5',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>BLACKWOLF</span>
          </h1>
          <p style={{
            color: '#555', marginTop: 12, fontSize: '0.8rem',
          }}>
            Panel de Control — Acceso Restringido
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block', color: '#A0A0A0',
              fontSize: '0.75rem', marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #1F1F1F', borderRadius: 8,
                color: '#fff', fontSize: '0.9rem',
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#F5F5F5'}
              onBlur={(e) => e.target.style.borderColor = '#1F1F1F'}
              placeholder="admin@blackwolfsec.io"
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{
              display: 'block', color: '#A0A0A0',
              fontSize: '0.75rem', marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '12px 16px', paddingRight: 44,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid #1F1F1F', borderRadius: 8,
                  color: '#fff', fontSize: '0.9rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#F5F5F5'}
                onBlur={(e) => e.target.style.borderColor = '#1F1F1F'}
                placeholder="••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#555',
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 16px',
              marginBottom: 18, color: '#EF4444',
              fontSize: '0.85rem', fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 14,
              background: loading ? '#1F1F1F' : '#F5F5F5',
              border: 'none', borderRadius: 100,
              color: loading ? '#555' : '#000',
              fontSize: '0.9rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: 1,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? 'Verificando...' : (
              <>Acceder <ArrowRight size={16} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
