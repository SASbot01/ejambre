import { useState, useEffect, useContext } from 'react'
import { useParams } from 'react-router-dom'
import { ClientContext } from '../../contexts/ClientContext'
import { supabase } from '../../utils/supabase'

function extractEmbedUrl(url) {
  if (!url) return ''
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`
  // Already an embed or other URL
  return url
}

export default function CursoDetail() {
  const { cursoId } = useParams()
  const { clientId, clientConfig } = useContext(ClientContext)
  const [curso, setCurso] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', videoUrl: '', position: 0 })
  const [activeVideo, setActiveVideo] = useState(null)

  useEffect(() => { if (cursoId) loadData() }, [cursoId])

  async function loadData() {
    setLoading(true)
    const [{ data: cursoData }, { data: videosData }] = await Promise.all([
      supabase.from('formacion_cursos').select('*').eq('id', cursoId).single(),
      supabase.from('formacion_videos').select('*').eq('curso_id', cursoId).order('position', { ascending: true }),
    ])
    setCurso(cursoData)
    setVideos(videosData || [])
    if (videosData?.length > 0 && !activeVideo) setActiveVideo(videosData[0])
    setLoading(false)
  }

  async function saveVideo() {
    if (!form.title.trim() || !form.videoUrl.trim()) return
    const embedUrl = extractEmbedUrl(form.videoUrl)
    if (editingVideo) {
      await supabase.from('formacion_videos').update({
        title: form.title, description: form.description,
        video_url: form.videoUrl, embed_url: embedUrl,
        position: form.position,
      }).eq('id', editingVideo)
    } else {
      await supabase.from('formacion_videos').insert({
        curso_id: cursoId, client_id: clientId,
        title: form.title, description: form.description,
        video_url: form.videoUrl, embed_url: embedUrl,
        position: videos.length,
      })
    }
    setForm({ title: '', description: '', videoUrl: '', position: 0 })
    setShowForm(false)
    setEditingVideo(null)
    loadData()
  }

  async function deleteVideo(id) {
    if (!confirm('Eliminar este vídeo?')) return
    await supabase.from('formacion_videos').delete().eq('id', id)
    if (activeVideo?.id === id) setActiveVideo(null)
    loadData()
  }

  function startEditVideo(video) {
    setEditingVideo(video.id)
    setForm({ title: video.title, description: video.description || '', videoUrl: video.video_url || '', position: video.position || 0 })
    setShowForm(true)
  }

  async function moveVideo(videoId, direction) {
    const idx = videos.findIndex(v => v.id === videoId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= videos.length) return
    await Promise.all([
      supabase.from('formacion_videos').update({ position: swapIdx }).eq('id', videos[idx].id),
      supabase.from('formacion_videos').update({ position: idx }).eq('id', videos[swapIdx].id),
    ])
    loadData()
  }

  const color = clientConfig?.primaryColor || '#3B82F6'

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Cargando...</div>
  if (!curso) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Curso no encontrado</div>

  return (
    <div style={{ padding: '0 8px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 6, padding: '2px 8px' }}>{curso.category || 'general'}</span>
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: '8px 0 4px' }}>{curso.title}</h2>
        {curso.description && <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>{curso.description}</p>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Video Player */}
        <div style={{ flex: '1 1 400px', minWidth: 300 }}>
          {activeVideo ? (
            <div>
              <div style={{ aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
                <iframe src={activeVideo.embed_url || extractEmbedUrl(activeVideo.video_url)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', marginBottom: 4 }}>{activeVideo.title}</div>
              {activeVideo.description && <div style={{ fontSize: '0.75rem', color: '#666', lineHeight: 1.5 }}>{activeVideo.description}</div>}
            </div>
          ) : (
            <div style={{ aspectRatio: '16/9', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: '2rem' }}>🎬</span>
              <span style={{ fontSize: '0.8rem', color: '#555' }}>Selecciona un vídeo o añade el primero</span>
            </div>
          )}
        </div>

        {/* Video List */}
        <div style={{ flex: '0 0 280px', minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>Vídeos ({videos.length})</div>
            <button onClick={() => { setShowForm(!showForm); setEditingVideo(null); setForm({ title: '', description: '', videoUrl: '', position: videos.length }) }}
              style={{ background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 8, color, padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600 }}>
              + Añadir
            </button>
          </div>

          {/* Add/Edit form */}
          {showForm && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Título del vídeo"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid #1F1F1F', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: '0.78rem', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
              <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="URL del vídeo (YouTube, Vimeo, Loom...)"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid #1F1F1F', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: '0.78rem', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción (opcional)" rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid #1F1F1F', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: '0.78rem', outline: 'none', marginBottom: 8, resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={saveVideo}
                  style={{ background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 8, color, padding: '6px 14px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>
                  {editingVideo ? 'Guardar' : 'Añadir vídeo'}
                </button>
                <button onClick={() => { setShowForm(false); setEditingVideo(null) }}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1F1F1F', borderRadius: 8, color: '#666', padding: '6px 14px', cursor: 'pointer', fontSize: '0.7rem' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Video items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {videos.map((video, idx) => (
              <div key={video.id}
                onClick={() => setActiveVideo(video)}
                style={{ background: activeVideo?.id === video.id ? `${color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${activeVideo?.id === video.id ? `${color}30` : 'rgba(255,255,255,0.05)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.65rem', color: '#555', fontFamily: "'JetBrains Mono', monospace", minWidth: 16 }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: activeVideo?.id === video.id ? '#fff' : '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</div>
                  </div>
                  {activeVideo?.id === video.id && <span style={{ fontSize: '0.6rem', color }}>▶</span>}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button onClick={e => { e.stopPropagation(); moveVideo(video.id, 'up') }} disabled={idx === 0}
                    style={{ background: 'transparent', border: '1px solid #1a1a1a', borderRadius: 4, color: idx === 0 ? '#333' : '#666', padding: '1px 5px', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.55rem' }}>↑</button>
                  <button onClick={e => { e.stopPropagation(); moveVideo(video.id, 'down') }} disabled={idx === videos.length - 1}
                    style={{ background: 'transparent', border: '1px solid #1a1a1a', borderRadius: 4, color: idx === videos.length - 1 ? '#333' : '#666', padding: '1px 5px', cursor: idx === videos.length - 1 ? 'default' : 'pointer', fontSize: '0.55rem' }}>↓</button>
                  <button onClick={e => { e.stopPropagation(); startEditVideo(video) }}
                    style={{ background: 'transparent', border: '1px solid #1a1a1a', borderRadius: 4, color: '#666', padding: '1px 5px', cursor: 'pointer', fontSize: '0.55rem' }}>✏️</button>
                  <button onClick={e => { e.stopPropagation(); deleteVideo(video.id) }}
                    style={{ background: 'transparent', border: '1px solid #1a1a1a', borderRadius: 4, color: '#EF4444', padding: '1px 5px', cursor: 'pointer', fontSize: '0.55rem', marginLeft: 'auto' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
