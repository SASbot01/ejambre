import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { C, FONT, MONO, Shell, Header, Footer, fadeUp, stagger } from './theme'

const HERO = 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/Qiknybal77YqBdnqk6SS/media/f71371be-3d09-40f9-bb3e-f72827557274.png'

const VALUE = [
  {
    n: '01',
    title: 'Formato de CV Suizo Profesional:',
    body: 'La estructura técnica exacta que necesitas para superar el filtro de los 6 segundos y volverte visible.',
  },
  {
    n: '02',
    title: 'Directorio de 50 Agencias:',
    body: 'El listado de las empresas que mueven los contratos reales hoy, para que dejes de perder el tiempo en portales que no funcionan.',
  },
  {
    n: '03',
    title: 'El Error de Identidad Local:',
    body: 'Descubre por qué tu número de teléfono actual es la razón por la que te tratan como un "turista" y te descartan automáticamente.',
  },
]

export default function GuiaLanding() {
  useEffect(() => {
    document.title = 'Cómo Trabajar en Suiza: Estrategia y Alojamiento | Growth Passport'
  }, [])

  return (
    <Shell>
      <Header current="guia" />

      {/* HERO */}
      <section style={{ padding: '48px 24px 0', maxWidth: 1180, margin: '0 auto' }}>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: 56,
            alignItems: 'center',
            padding: '32px 0 72px',
          }}
          className="hero-grid"
        >
          <motion.div variants={fadeUp}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', borderRadius: 999,
              border: `1px solid ${C.line}`, background: C.bg,
              fontFamily: MONO, fontSize: 11, color: C.ink2,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              marginBottom: 28,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} />
              Growth Passport · Suiza
            </div>

            <h1 style={{
              fontFamily: FONT, fontWeight: 700,
              fontSize: 'clamp(34px, 5vw, 56px)',
              lineHeight: 1.05, letterSpacing: '-0.03em',
              color: C.ink, margin: 0,
            }}>
              <em style={{ fontStyle: 'italic', fontWeight: 500 }}>
                Cómo crear tu currículum suizo
              </em>{' '}
              sin perder meses en los que nadie los lee.
            </h1>

            <p style={{
              fontFamily: FONT, fontSize: 18, lineHeight: 1.55,
              color: C.ink2, marginTop: 22, maxWidth: 540,
            }}>
              <em style={{ fontStyle: 'italic' }}>
                Accede al formato técnico que los reclutadores escanean en 6 segundos
              </em>{' '}
              y el listado de las 50 empresas que están contratando ahora mismo.
            </p>

            <div style={{ marginTop: 32, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link to="/asesoriasuizaguia/form" style={ctaPrimary}>
                ACCEDE A LOS RECURSOS
                <span style={{ marginLeft: 10, transform: 'translateY(-1px)' }}>→</span>
              </Link>
              <a href="#valor" style={ctaGhost}>Ver qué incluye</a>
            </div>

            <div style={{
              marginTop: 40, display: 'flex', gap: 22, flexWrap: 'wrap',
              fontFamily: MONO, fontSize: 11, color: C.muted,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              <span>✓ Gratuito</span>
              <span>✓ Acceso inmediato</span>
              <span>✓ 50 empresas verificadas</span>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: '-16px -16px 16px 16px',
              background: `linear-gradient(135deg, ${C.red}12, transparent 60%)`,
              borderRadius: 20, zIndex: 0,
            }} />
            <img
              src={HERO}
              alt="Alpes Suizos — Growth Passport"
              style={{
                position: 'relative', zIndex: 1,
                width: '100%', height: 'auto',
                borderRadius: 18, border: `1px solid ${C.line}`,
                boxShadow: '0 30px 60px -30px rgba(11,11,12,0.25)',
                display: 'block',
              }}
            />
            <div style={{
              position: 'absolute', bottom: -14, left: 20,
              background: C.ink, color: C.bgAccent,
              padding: '10px 14px', borderRadius: 10,
              fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase', zIndex: 2,
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            }}>
              Manual + Directorio · PDF
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* VALOR */}
      <section id="valor" style={{
        padding: '80px 24px', background: C.bg, borderTop: `1px solid ${C.line}`,
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 48, maxWidth: 780 }}
          >
            <div style={labelTag}>VALOR</div>
            <h2 style={{
              fontFamily: FONT, fontWeight: 700,
              fontSize: 'clamp(26px, 3.6vw, 40px)',
              lineHeight: 1.1, letterSpacing: '-0.025em',
              color: C.ink, margin: '14px 0 0',
            }}>
              <em style={{ fontStyle: 'italic', fontWeight: 500 }}>No caigas en el error:</em>{' '}
              que sea gratis no significa que no valga oro.
            </h2>
          </motion.div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
          }}>
            {VALUE.map((v, i) => (
              <motion.div
                key={v.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                style={{
                  background: C.bgAccent,
                  border: `1px solid ${C.line}`,
                  borderRadius: 16, padding: '28px 26px',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{
                  fontFamily: MONO, fontSize: 12, color: C.red,
                  letterSpacing: '0.12em', marginBottom: 14, fontWeight: 600,
                }}>{v.n}</div>
                <div style={{
                  fontFamily: FONT, fontSize: 17, fontWeight: 600,
                  color: C.ink, lineHeight: 1.3, marginBottom: 10,
                  letterSpacing: '-0.01em',
                }}>
                  <em style={{ fontStyle: 'italic', fontWeight: 500 }}>{v.title}</em>
                </div>
                <div style={{
                  fontFamily: FONT, fontSize: 14.5, lineHeight: 1.55,
                  color: C.ink2,
                }}>
                  <em style={{ fontStyle: 'italic', fontWeight: 400 }}>{v.body}</em>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Second CTA */}
          <div style={{
            marginTop: 56, padding: '36px 32px',
            background: C.ink, borderRadius: 20,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em',
                color: C.red, textTransform: 'uppercase', marginBottom: 8,
              }}>Acceso directo</div>
              <div style={{
                fontFamily: FONT, fontSize: 22, fontWeight: 600,
                color: C.bgAccent, letterSpacing: '-0.015em',
                lineHeight: 1.25, maxWidth: 540,
              }}>
                Lleva el listado completo de las 50 empresas suizas que contratan ahora mismo.
              </div>
            </div>
            <Link to="/asesoriasuizaguia/form" style={ctaPrimaryOnDark}>
              QUIERO EL LISTADO DE EMPRESAS SUIZAS
              <span style={{ marginLeft: 10 }}>→</span>
            </Link>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 860px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </Shell>
  )
}

const ctaPrimary = {
  display: 'inline-flex', alignItems: 'center',
  padding: '14px 22px', borderRadius: 10,
  background: C.ink, color: C.bgAccent,
  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  textDecoration: 'none',
  transition: 'transform .15s, box-shadow .15s',
  boxShadow: '0 10px 30px -10px rgba(11,11,12,0.35)',
}

const ctaPrimaryOnDark = {
  display: 'inline-flex', alignItems: 'center',
  padding: '14px 22px', borderRadius: 10,
  background: C.red, color: '#fff',
  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  textDecoration: 'none',
  boxShadow: '0 10px 30px -10px rgba(216,40,40,0.6)',
}

const ctaGhost = {
  display: 'inline-flex', alignItems: 'center',
  padding: '14px 22px', borderRadius: 10,
  background: 'transparent', color: C.ink,
  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
  letterSpacing: '0.02em',
  textDecoration: 'none',
  border: `1px solid ${C.line}`,
}

const labelTag = {
  display: 'inline-block',
  fontFamily: MONO, fontSize: 11,
  color: C.red, letterSpacing: '0.14em',
  textTransform: 'uppercase', fontWeight: 600,
  padding: '5px 10px', borderRadius: 6,
  background: `${C.red}12`,
}
