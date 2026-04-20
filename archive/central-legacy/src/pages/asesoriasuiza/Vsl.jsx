import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { C, FONT, MONO, Shell, Header, Footer, fadeUp, stagger } from './theme'

const HERO = 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/Qiknybal77YqBdnqk6SS/media/f71371be-3d09-40f9-bb3e-f72827557274.png'
const CALENDLY = 'https://calendly.com/growth-passport/plan-de-aterrizaje-en-suiza'

const VALOR = [
  { icon: '📄', text: 'Adaptamos tu CV al estándar que exigen las empresas suizas para que dejen de ignorarte.' },
  { icon: '🏠', text: 'Acceso a nuestra red de habitaciones para que tengas dirección legal y alojamiento seguro desde el día 1.' },
  { icon: '🗺️', text: 'Un plan paso a paso desde España para que sepas exactamente qué hacer y cuándo hacerlo.' },
  { icon: '🛡️', text: 'Te acompaño para evitar los fallos típicos que hacen que la gente pierda miles de euros y vuelva derrotada.' },
]

const FAQS = [
  {
    q: '¿Garantizas un puesto de trabajo al 100%?',
    a: 'No. Nadie honesto puede garantizarte un contrato, ya que la decisión final es de la empresa. Lo que yo te garantizo es el Método Estratégico.',
  },
  {
    q: '¿Puedo empezar el proceso si todavía estoy en España?',
    a: 'Sí, de hecho, es lo más recomendable.',
  },
  {
    q: '¿Cómo funciona el tema del alojamiento?',
    a: 'Al entrar en el programa, tienes acceso a mi red de habitaciones en zonas estratégicas.',
  },
  {
    q: '¿Qué pasa si no hablo alemán o francés perfecto?',
    a: 'No todos los sectores exigen un nivel bilingüe.',
  },
  {
    q: '¿Vale la pena la inversión si puedo ir por mi cuenta?',
    a: 'Lo que te vas a gastar en tu primera semana en un Airbnb o un hotel al llegar a ciegas, es lo que inviertes en mi acompañamiento.',
  },
]

export default function Vsl() {
  useEffect(() => {
    document.title = 'El Método Estratégico para Llegar a Suiza · Growth Passport'
  }, [])

  return (
    <Shell>
      <Header current="vsl" />

      {/* HERO + VSL */}
      <section style={{ padding: '44px 24px 0', maxWidth: 1080, margin: '0 auto' }}>
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          style={{ textAlign: 'center', padding: '28px 0 28px' }}
        >
          <motion.div variants={fadeUp} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '7px 14px', borderRadius: 999,
            border: `1px solid ${C.line}`, background: C.bgAccent,
            fontFamily: MONO, fontSize: 11, color: C.ink2,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: 22,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.red }} />
            Hoja de Ruta Estratégica · 3 min
          </motion.div>

          <motion.h1 variants={fadeUp} style={{
            fontFamily: FONT, fontWeight: 700,
            fontSize: 'clamp(34px, 5.4vw, 60px)',
            lineHeight: 1.02, letterSpacing: '-0.03em',
            color: C.ink, margin: 0, maxWidth: 860, marginInline: 'auto',
          }}>
            El Método Estratégico para <em style={{ fontStyle: 'italic', fontWeight: 500 }}>Llegar a Suiza</em>
          </motion.h1>

          <motion.p variants={fadeUp} style={{
            fontFamily: FONT, fontSize: 19, lineHeight: 1.5,
            color: C.ink2, marginTop: 18, maxWidth: 680, marginInline: 'auto',
          }}>
            Prepara tu perfil, asegura tu habitación y llega a Suiza con un plan real.
          </motion.p>
        </motion.div>

        {/* Video */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{
            position: 'relative', maxWidth: 960, margin: '0 auto',
            aspectRatio: '16 / 9', borderRadius: 22,
            overflow: 'hidden',
            border: `1px solid ${C.line}`,
            boxShadow: '0 40px 80px -40px rgba(11,11,12,0.35)',
            background: C.ink,
          }}
        >
          <img src={HERO} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: 0.55,
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'grid', placeItems: 'center',
          }}>
            <button onClick={() => document.getElementById('calendly-cta')?.scrollIntoView({ behavior: 'smooth' })} style={{
              width: 82, height: 82, borderRadius: 999,
              background: C.red, color: '#fff',
              border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 20px 50px rgba(216,40,40,0.5)',
              animation: 'pulse-ring 2s ease-out infinite',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
          <div style={{
            position: 'absolute', bottom: 22, left: 22,
            color: '#fff', fontFamily: MONO, fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
            padding: '6px 12px', borderRadius: 6,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          }}>
            ▶ Reproducir · 3:12
          </div>
        </motion.div>

        {/* Subhead below video */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{
            maxWidth: 760, margin: '56px auto 0',
            textAlign: 'center',
          }}
        >
          <div style={{
            display: 'inline-block',
            fontFamily: MONO, fontSize: 11,
            color: C.red, letterSpacing: '0.14em',
            textTransform: 'uppercase', fontWeight: 700,
            padding: '5px 10px', borderRadius: 6,
            background: `${C.red}12`,
          }}>El Sistema</div>
          <h2 style={{
            fontFamily: FONT, fontWeight: 600,
            fontSize: 'clamp(24px, 3.4vw, 36px)',
            lineHeight: 1.15, letterSpacing: '-0.025em',
            color: C.ink, margin: '14px 0 0',
          }}>
            Un sistema que te ayuda a conseguir entrevistas y convertir tu{' '}
            <span style={{ color: C.red, fontWeight: 700 }}>ESFUERZO</span> en un{' '}
            <span style={{ color: C.red, fontWeight: 700 }}>CONTRATO REAL</span>.
          </h2>
        </motion.div>
      </section>

      {/* VALOR */}
      <section style={{ padding: '80px 24px', maxWidth: 1080, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 40, maxWidth: 680 }}
        >
          <div style={{
            display: 'inline-block',
            fontFamily: MONO, fontSize: 11,
            color: C.red, letterSpacing: '0.14em',
            textTransform: 'uppercase', fontWeight: 700,
            padding: '5px 10px', borderRadius: 6,
            background: `${C.red}12`,
          }}>VALOR</div>
          <h2 style={{
            fontFamily: FONT, fontWeight: 700,
            fontSize: 'clamp(26px, 3.6vw, 40px)',
            lineHeight: 1.1, letterSpacing: '-0.025em',
            color: C.ink, margin: '14px 0 0',
          }}>
            Lo que incluye el método.
          </h2>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {VALOR.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              style={{
                display: 'flex', gap: 18, alignItems: 'flex-start',
                padding: '24px 22px',
                background: C.bgAccent,
                border: `1px solid ${C.line}`,
                borderRadius: 16,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: C.ink, color: C.bgAccent,
                display: 'grid', placeItems: 'center',
                fontSize: 20, flexShrink: 0,
              }}>{v.icon}</div>
              <div style={{
                fontFamily: FONT, fontSize: 15, lineHeight: 1.5,
                color: C.ink, letterSpacing: '-0.005em',
              }}>
                {v.text}
              </div>
            </motion.div>
          ))}
        </div>

        <div id="calendly-cta" style={{
          marginTop: 56, padding: '40px 36px',
          background: C.ink, borderRadius: 22,
          display: 'grid', gridTemplateColumns: '1fr auto',
          alignItems: 'center', gap: 24,
        }} className="cta-band">
          <div>
            <div style={{
              fontFamily: MONO, fontSize: 11, color: C.red,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              fontWeight: 700, marginBottom: 10,
            }}>Siguiente paso</div>
            <div style={{
              fontFamily: FONT, fontSize: 24, fontWeight: 600,
              color: C.bgAccent, letterSpacing: '-0.02em',
              lineHeight: 1.25, maxWidth: 560,
            }}>
              Agenda tu llamada y recibe tu Plan de Aterrizaje personalizado.
            </div>
          </div>
          <a href={CALENDLY} target="_blank" rel="noopener" style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '16px 26px', borderRadius: 12,
            background: C.red, color: '#fff',
            fontFamily: FONT, fontSize: 13, fontWeight: 800,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            textDecoration: 'none',
            boxShadow: '0 14px 32px -12px rgba(216,40,40,0.55)',
            whiteSpace: 'nowrap',
          }}>
            Agendar Llamada
            <span style={{ marginLeft: 10 }}>→</span>
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section style={{
        padding: '60px 24px 80px',
        background: C.bg, borderTop: `1px solid ${C.line}`,
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 32 }}
          >
            <div style={{
              display: 'inline-block',
              fontFamily: MONO, fontSize: 11,
              color: C.red, letterSpacing: '0.14em',
              textTransform: 'uppercase', fontWeight: 700,
              padding: '5px 10px', borderRadius: 6,
              background: `${C.red}12`,
            }}>FAQ</div>
            <h2 style={{
              fontFamily: FONT, fontWeight: 700,
              fontSize: 'clamp(26px, 3.6vw, 38px)',
              lineHeight: 1.15, letterSpacing: '-0.025em',
              color: C.ink, margin: '14px 0 0',
            }}>
              Preguntas Frecuentes
            </h2>
          </motion.div>

          <div style={{ display: 'grid', gap: 10 }}>
            {FAQS.map((f, i) => <Faq key={i} q={f.q} a={f.a} idx={i} />)}
          </div>

          <div style={{
            marginTop: 40, padding: '28px 28px',
            background: C.bgAccent, borderRadius: 16,
            border: `1px solid ${C.line}`,
            display: 'flex', gap: 18, alignItems: 'center',
            flexWrap: 'wrap', justifyContent: 'space-between',
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 15, color: C.ink,
              letterSpacing: '-0.01em', maxWidth: 480,
            }}>
              ¿Listo para tu aterrizaje en Suiza? Agenda ahora tu llamada estratégica.
            </div>
            <a href={CALENDLY} target="_blank" rel="noopener" style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '13px 20px', borderRadius: 10,
              background: C.ink, color: C.bgAccent,
              fontFamily: FONT, fontSize: 13, fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              textDecoration: 'none',
            }}>
              QUIERO EL MÉTODO PARA LLEGAR A SUIZA
              <span style={{ marginLeft: 10 }}>→</span>
            </a>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 760px) {
          .cta-band {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Shell>
  )
}

function Faq({ q, a, idx }) {
  const [open, setOpen] = useState(idx === 0)
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: idx * 0.04 }}
      style={{
        background: C.bgAccent,
        border: `1px solid ${C.line}`,
        borderRadius: 14, overflow: 'hidden',
      }}
    >
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        gap: 14, padding: '18px 22px',
        background: 'transparent', border: 'none',
        color: C.ink, cursor: 'pointer',
        fontFamily: FONT, fontSize: 15.5, fontWeight: 600,
        letterSpacing: '-0.005em', textAlign: 'left',
      }}>
        <span>{q}</span>
        <span style={{
          width: 28, height: 28, borderRadius: 999,
          background: open ? C.ink : C.bg,
          color: open ? C.bgAccent : C.ink,
          display: 'grid', placeItems: 'center',
          flexShrink: 0, transition: 'all .2s',
          fontSize: 18, fontWeight: 400,
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}>+</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 22px 20px',
              fontFamily: FONT, fontSize: 14.5, lineHeight: 1.55,
              color: C.ink2,
            }}>
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
