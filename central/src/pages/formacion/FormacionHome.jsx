import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClientContext } from '../../contexts/ClientContext'
import { supabase } from '../../utils/supabase'

export default function FormacionHome() {
  const { clientId, clientConfig } = useContext(ClientContext)
  const navigate = useNavigate()
  const [cursos, setCursos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCurso, setEditingCurso] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', thumbnailUrl: '', category: 'general' })

  const CATEGORIES = ['general', 'avanzado', 'onboarding', 'masterclass', 'herramientas']

  useEffect(() => { if (clientId) loadCursos() }, [clientId])

  async function loadCursos() {
    setLoading(true)
    const { data } = await supabase.from('formacion_cursos').select('*').eq('client_id', clientId).order('position', { ascending: true })
    setCursos(data || [])
    setLoading(false)
  }

  async function saveCurso() {
    if (!form.title.trim()) return
    if (editingCurso) {
      await supabase.from('formacion_cursos').update({
        title: form.title, description: form.description,
        thumbnail_url: form.thumbnailUrl, category: form.category,
      }).eq('id', editingCurso)
    } else {
      await supabase.from('formacion_cursos').insert({
        client_id: clientId, title: form.title, description: form.description,
        thumbnail_url: form.thumbnailUrl, category: form.category,
        position: cursos.length,
      })
    }
    setForm({ title: '', description: '', thumbnailUrl: '', category: 'general' })
    setShowForm(false)
    setEditingCurso(null)
    loadCursos()
  }

  async function deleteCurso(id) {
    if (!confirm('Eliminar este curso y todos sus vídeos?')) return
    await supabase.from('formacion_videos').delete().eq('curso_id', id)
    await supabase.from('formacion_cursos').delete().eq('id', id)
    loadCursos()
  }

  function startEdit(curso) {
    setEditingCurso(curso.id)
    setForm({ title: curso.title, description: curso.description || '', thumbnailUrl: curso.thumbnail_url || '', category: curso.category || 'general' })
    setShowForm(true)
  }

  const color = clientConfig?.primaryColor || '#3B82F6'

  return (
    <div style={{ padding: '0 8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>Formación</h2>
          <p style={{ fontSize: '0.75rem', color: '#666', margin: '4px 0 0' }}>Cursos y contenido formativo para tus clientes</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingCurso(null); setForm({ title: '', description: '', thumbnailUrl: '', category: 'general' }) }}
          style={{ background: showForm ? 'rgba(255,255,255,0.05)' : `${color}20`, border: `1px solid ${showForm ? '#333' : `${color}40`}`, borderRadius: 10, color: showForm ? '#888' : color, padding: '8px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo Curso'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', marginBottom: 12 }}>{editingCurso ? 'Editar Curso' : 'Nuevo Curso'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Nombre del curso"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1F1F1F', borderRadius: 10, color: '#fff', padding: '10px 14px', fontSize: '0.85rem', outline: 'none' }} />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción del curso" rows={3}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1F1F1F', borderRadius: 10, color: '#fff', padding: '10px 14px', fontSize: '0.85rem', outline: 'none', resize: 'vertical' }} />
            <input value={form.thumbnailUrl} onChange={e => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="URL de imagen/thumbnail (opcional)"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1F1F1F', borderRadius: 10, color: '#fff', padding: '10px 14px', fontSize: '0.85rem', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setForm({ ...form, category: cat })}
                  style={{ background: form.category === cat ? `${color}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${form.category === cat ? `${color}40` : '#1F1F1F'}`, borderRadius: 8, color: form.category === cat ? color : '#666', padding: '5px 12px', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                  {cat}
                </button>
              ))}
            </div>
            <button onClick={saveCurso}
              style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)`, border: 'none', borderRadius: 10, color: '#fff', padding: '10px 20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, alignSelf: 'flex-start' }}>
              {editingCurso ? 'Guardar cambios' : 'Crear Curso'}
            </button>
          </div>
        </div>
      )}

      {/* Courses Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>Cargando cursos...</div>
      ) : cursos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎓</div>
          <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: 6 }}>Sin cursos todavía</div>
          <div style={{ fontSize: '0.7rem', color: '#555' }}>Crea tu primer curso para empezar a subir contenido formativo</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {cursos.map(curso => (
            <div key={curso.id}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = `${color}40`}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
              {/* Thumbnail */}
              <div style={{ height: 140, background: `linear-gradient(135deg, ${color}15, ${color}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                onClick={() => navigate(`formacion/${curso.id}`)}>
                {curso.thumbnail_url ? (
                  <img src={curso.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '2.5rem' }}>🎬</span>
                )}
                <div style={{ position: 'absolute', top: 8, right: 8, background: `${color}20`, border: `1px solid ${color}30`, borderRadius: 6, padding: '2px 8px', fontSize: '0.55rem', color, fontWeight: 600, textTransform: 'capitalize' }}>
                  {curso.category || 'general'}
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: 4 }} onClick={() => navigate(`formacion/${curso.id}`)}>{curso.title}</div>
                {curso.description && <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: 8, lineHeight: 1.4 }}>{curso.description.slice(0, 100)}{curso.description.length > 100 ? '...' : ''}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => navigate(`formacion/${curso.id}`)}
                    style={{ background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 8, color, padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600 }}>
                    Ver vídeos →
                  </button>
                  <button onClick={() => startEdit(curso)}
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1F1F1F', borderRadius: 8, color: '#666', padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem' }}>
                    Editar
                  </button>
                  <button onClick={() => deleteCurso(curso.id)}
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#EF4444', padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem', marginLeft: 'auto' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
