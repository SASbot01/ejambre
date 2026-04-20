import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { C, FONT, MONO, Shell, Header, Footer } from './theme'

const HERO = 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/Qiknybal77YqBdnqk6SS/media/f71371be-3d09-40f9-bb3e-f72827557274.png'

export default function GuiaThx() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = '¡TODO LISTO! Revisa tu correo · Growth Passport'
  }, [])

  return (
    <Shell>
      <Header current="thx" />

      <section style={{
        padding: '56px 24px 28px',
        maxWidth: 820, margin: '0 auto',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderRadius: 999,
            background: '#15A34A15', color: '#15A34A',
            fontFamily: MONO, fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            fontWeight: 700, marginBottom: 26,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 999,
              background: '#15A34A', color: '#fff',
              display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
            }}>✓</span>
            Cita Confirmada — El Portillo en Suiza
          </div>

          <h1 style={{
            fontFamily: FONT, fontWeight: 700,
            fontSize: 'clamp(34px, 5vw, 54px)',
            lineHeight: 1.05, letterSpacing: '-0.03em',
            color: C.ink, margin: 0,
          }}>
            ¡TODO LISTO! <br />
            <span style={{ color: C.muted, fontWeight: 500, fontStyle: 'italic' }}>
              Revisa tu correo.
            </span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginTop: 44, position: 'relative' }}
        >
          <img
            src={HERO}
            alt="Growth Passport — Suiza"
            style={{
              width: '100%', height: 'auto',
              borderRadius: 18, border: `1px solid ${C.line}`,
              boxShadow: '0 30px 60px -30px rgba(11,11,12,0.25)',
              display: 'block',
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            marginTop: 40,
            padding: '34px 34px',
            background: C.bgAccent,
            border: `1px solid ${C.line}`,
            borderRadius: 18,
            boxShadow: '0 20px 40px -28px rgba(11,11,12,0.12)',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: MONO, fontSize: 11, color: C.red,
            letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
            marginBottom: 16,
          }}>
            📩 Entrega del manual
          </div>

          <p style={{
            fontFamily: FONT, fontSize: 17.5, lineHeight: 1.55,
            color: C.ink, margin: 0, letterSpacing: '-0.005em',
          }}>
            El manual ya va de camino (mira en <b>Spam</b> si no aparece).
            Enviar CVs sin un plan es la forma más rápida de quemar tus ahorros en Suiza.
            Antes de leerlo, mira este vídeo de <b>3 minutos</b>: te explico la estrategia
            para ejecutar un <em style={{ fontStyle: 'italic' }}>"desembarco profesional"</em> y
            ser rentable desde el primer mes.
          </p>

          <div style={{
            marginTop: 28, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            gap: 14, flexWrap: 'wrap',
          }}>
            <Link
              to="/asesoriasuiza"
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '16px 26px', borderRadius: 12,
                background: C.red, color: '#fff',
                fontFamily: FONT, fontSize: 14, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                textDecoration: 'none',
                boxShadow: '0 14px 32px -12px rgba(216,40,40,0.55)',
                animation: 'pulse-ring 2s ease-out infinite',
              }}
            >
              🎥 VER HOJA DE RUTA ESTRATÉGICA
              <span style={{ marginLeft: 12 }}>→</span>
            </Link>
          </div>

          <div style={{
            marginTop: 22, textAlign: 'center',
            fontFamily: MONO, fontSize: 11,
            color: C.muted, letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Serás redirigido al método en 10 s…
          </div>
        </motion.div>
      </section>

      <Footer />

      <AutoRedirect navigate={navigate} />
    </Shell>
  )
}

function AutoRedirect({ navigate }) {
  useEffect(() => {
    const t = setTimeout(() => navigate('/asesoriasuiza'), 10000)
    return () => clearTimeout(t)
  }, [navigate])
  return null
}
