import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { C, FONT, MONO, Shell, Header, Footer } from './theme'

const OPTIONS = [
  {
    key: 'pre',
    icon: '✅',
    text: '¡Sí, por favor! Aún no estoy en Suiza y quiero que me guíen. Quiero que me contacten y me asesoren en el proceso desde cero (orientación para alojamiento, trabajo y papeleo) para ahorrar tiempo y evitar dolores de cabeza.',
  },
  {
    key: 'in',
    icon: '✅',
    text: '¡Sí! Ya estoy en Suiza y necesito ayuda con gestiones clave. Necesito asesoramiento para organizarme aquí de la mejor manera (contratar el seguro médico obligatorio, encontrar alojamiento o recibir orientación laboral).',
  },
  {
    key: 'no',
    icon: '❌',
    text: 'No, gracias. Prefiero ir por mi cuenta y arriesgarme a cometer los errores yo solo/a.',
  },
]

export default function GuiaForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', preferencia: '' })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    document.title = 'Completa el formulario para acceder a los recursos'
  }, [])

  function validate() {
    const e = {}
    if (!form.telefono.trim()) e.telefono = 'Número de teléfono requerido'
    if (!form.email.trim()) e.email = 'Email requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email no válido'
    if (!form.preferencia) e.preferencia = 'Selecciona una opción'
    return e
  }

  async function onSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setSubmitting(true)
    try {
      try {
        await fetch('/api/onboard-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, vertical: 'asesoriasuiza-guia' }),
        })
      } catch {}
      navigate('/asesoriasuizaguia/thx')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Shell>
      <Header current="form" />

      <section style={{
        padding: '64px 24px 40px',
        maxWidth: 640, margin: '0 auto',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontFamily: MONO, fontSize: 11, color: C.muted,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 22,
          }}>
            <span>Paso 2 de 3</span>
            <span style={{ display: 'flex', gap: 4 }}>
              <i style={dotDone} />
              <i style={dotActive} />
              <i style={dotTodo} />
            </span>
          </div>

          <h1 style={{
            fontFamily: FONT, fontWeight: 700,
            fontSize: 'clamp(28px, 4vw, 42px)',
            lineHeight: 1.1, letterSpacing: '-0.028em',
            color: C.ink, margin: 0,
          }}>
            Completa el formulario para acceder a los recursos
          </h1>

          <p style={{
            fontFamily: FONT, fontSize: 15.5, lineHeight: 1.55,
            color: C.muted, marginTop: 14,
          }}>
            Tardas menos de 60 segundos. Recibirás el manual y el directorio en tu email al instante.
          </p>
        </motion.div>

        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            marginTop: 36, padding: '32px 28px',
            background: C.bgAccent,
            border: `1px solid ${C.line}`,
            borderRadius: 18,
            boxShadow: '0 20px 40px -28px rgba(11,11,12,0.18)',
          }}
        >
          <Field
            label="Nombre Completo"
            value={form.nombre}
            onChange={v => setForm(f => ({ ...f, nombre: v }))}
            placeholder="Tu nombre y apellidos"
          />

          <Field
            label="Número de teléfono"
            required
            type="tel"
            value={form.telefono}
            onChange={v => setForm(f => ({ ...f, telefono: v }))}
            placeholder="+34 600 000 000"
            error={errors.telefono}
          />

          <Field
            label="Email"
            required
            type="email"
            value={form.email}
            onChange={v => setForm(f => ({ ...f, email: v }))}
            placeholder="tu@email.com"
            error={errors.email}
          />

          <div style={{ marginTop: 26 }}>
            <label style={labelStyle}>
              ¿Cómo prefieres avanzar? <span style={{ color: C.red }}>*</span>
            </label>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {OPTIONS.map(opt => {
                const selected = form.preferencia === opt.key
                return (
                  <label
                    key={opt.key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      padding: '18px 18px',
                      border: `1.5px solid ${selected ? C.ink : C.line}`,
                      background: selected ? C.bg : C.bgAccent,
                      borderRadius: 14, cursor: 'pointer',
                      transition: 'border-color .15s, background .15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="preferencia"
                      value={opt.key}
                      checked={selected}
                      onChange={() => {
                        setForm(f => ({ ...f, preferencia: opt.key }))
                        setErrors(er => ({ ...er, preferencia: undefined }))
                      }}
                      style={{ display: 'none' }}
                    />
                    <span style={{
                      width: 22, height: 22, borderRadius: 999,
                      border: `2px solid ${selected ? C.ink : C.lineStrong}`,
                      flexShrink: 0, position: 'relative', marginTop: 1,
                      display: 'grid', placeItems: 'center',
                      background: selected ? C.ink : 'transparent',
                      transition: 'all .15s',
                    }}>
                      {selected && (
                        <span style={{
                          width: 8, height: 8, borderRadius: 999, background: C.bgAccent,
                        }} />
                      )}
                    </span>
                    <span style={{
                      fontFamily: FONT, fontSize: 14, lineHeight: 1.5,
                      color: C.ink2,
                    }}>
                      <b style={{ marginRight: 6 }}>{opt.icon}</b>
                      {opt.text}
                    </span>
                  </label>
                )
              })}
            </div>
            {errors.preferencia && <div style={errStyle}>{errors.preferencia}</div>}
          </div>

          <button type="submit" disabled={submitting} style={{
            marginTop: 28, width: '100%',
            padding: '16px 22px', borderRadius: 12,
            background: submitting ? C.muted : C.ink,
            color: C.bgAccent, border: 'none',
            fontFamily: FONT, fontSize: 14, fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
            transition: 'transform .1s, background .15s',
            boxShadow: '0 12px 30px -14px rgba(11,11,12,0.45)',
          }}>
            {submitting ? 'Enviando…' : 'Enviar'}
            {!submitting && <span style={{ marginLeft: 10 }}>→</span>}
          </button>

          <div style={{
            marginTop: 18, textAlign: 'center',
            fontFamily: MONO, fontSize: 11,
            color: C.muted, letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            🔒 Tus datos se tratan con confidencialidad
          </div>
        </motion.form>
      </section>

      <Footer />
    </Shell>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', required, error }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: C.red }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', marginTop: 8,
          padding: '14px 16px', borderRadius: 10,
          border: `1.5px solid ${error ? C.red : C.line}`,
          background: C.bgAccent, color: C.ink,
          fontFamily: FONT, fontSize: 15,
          outline: 'none',
          transition: 'border-color .15s, box-shadow .15s',
        }}
        onFocus={e => {
          e.target.style.borderColor = C.ink
          e.target.style.boxShadow = `0 0 0 3px ${C.ink}15`
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? C.red : C.line
          e.target.style.boxShadow = 'none'
        }}
      />
      {error && <div style={errStyle}>{error}</div>}
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontFamily: FONT, fontSize: 13, fontWeight: 600,
  color: C.ink, letterSpacing: '-0.005em',
}

const errStyle = {
  marginTop: 6,
  fontFamily: FONT, fontSize: 12, color: C.red,
}

const dotBase = { width: 6, height: 6, borderRadius: 999 }
const dotDone = { ...dotBase, background: C.ink }
const dotActive = { ...dotBase, background: C.red }
const dotTodo = { ...dotBase, background: C.line }
