import { useState, useEffect } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'

const SERVICE_TYPES = [
  { value: 'diy', label: 'Do It Yourself', desc: 'El cliente construye su tienda con guía paso a paso' },
  { value: 'dwy', label: 'Done With You', desc: 'Construimos juntos — asistencia y mentoría directa' },
  { value: 'dfy', label: 'Done For You', desc: 'Nosotros construimos la tienda completa para el cliente' },
]

export default function StoreCreationModal({ contact, onClose, onCreated }) {
  const { getTeam, createStoreWithClient } = useClientData()
  const [team] = useAsync(getTeam, [])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    serviceType: 'dfy',
    clientPassword: '',
    gestorId: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    capitalDisponible: '',
    brandName: '',
    productName: '',
  })

  // Pre-fill from CRM contact if provided
  useEffect(() => {
    if (contact) {
      setForm(prev => ({
        ...prev,
        ownerName: contact.name || '',
        ownerEmail: contact.email || '',
        ownerPhone: contact.phone || '',
        capitalDisponible: contact.capitalDisponible || contact.budget || '',
      }))
    }
  }, [contact])

  const gestors = team.filter(m => m.isGestor && m.active !== false)

  const selectedGestor = gestors.find(g => g.id === form.gestorId)
  const gestorStoreCount = selectedGestor ? (selectedGestor.storeCount || 0) : 0
  const gestorCapacity = selectedGestor?.gestorCapacity || 8

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.clientPassword || !form.gestorId || !form.ownerName || !form.ownerEmail) return
    setSaving(true)
    try {
      const gestor = gestors.find(g => g.id === form.gestorId)
      const result = await createStoreWithClient({
        storeData: {
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          ownerPhone: form.ownerPhone,
          brandName: form.brandName,
          productName: form.productName,
          serviceType: form.serviceType,
          capitalDisponible: form.capitalDisponible ? parseFloat(form.capitalDisponible) : null,
          crmContactId: contact?.id || null,
        },
        clientPassword: form.clientPassword,
        gestorId: gestor.id,
        gestorName: gestor.name,
      })
      onCreated?.(result)
      onClose()
    } catch (err) {
      console.error('Error creating store:', err)
      alert('Error al crear tienda. Revisa la consola.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="store-creation-modal" onClick={e => e.stopPropagation()}>
        <div className="store-creation-modal__header">
          <h2>Crear Tienda</h2>
          <button className="store-creation-modal__close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Service Type */}
          <div className="store-creation-modal__section">
            <label className="store-creation-modal__label">Tipo de Servicio</label>
            <div className="store-creation-modal__service-types">
              {SERVICE_TYPES.map(st => (
                <label
                  key={st.value}
                  className={`store-service-card${form.serviceType === st.value ? ' store-service-card--selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="serviceType"
                    value={st.value}
                    checked={form.serviceType === st.value}
                    onChange={() => setForm({ ...form, serviceType: st.value })}
                  />
                  <span className="store-service-card__name">{st.label}</span>
                  <span className="store-service-card__desc">{st.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Client Info */}
          <div className="store-creation-modal__section">
            <label className="store-creation-modal__label">Datos del Cliente</label>
            <div className="store-creation-modal__grid">
              <div className="store-creation-modal__field">
                <label>Nombre</label>
                <input value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} required />
              </div>
              <div className="store-creation-modal__field">
                <label>Email</label>
                <input type="email" value={form.ownerEmail} onChange={e => setForm({ ...form, ownerEmail: e.target.value })} required />
              </div>
              <div className="store-creation-modal__field">
                <label>Teléfono</label>
                <input value={form.ownerPhone} onChange={e => setForm({ ...form, ownerPhone: e.target.value })} />
              </div>
              <div className="store-creation-modal__field">
                <label>Contraseña del Portal</label>
                <input type="text" value={form.clientPassword} onChange={e => setForm({ ...form, clientPassword: e.target.value })} placeholder="Contraseña para acceder al portal" required />
              </div>
              <div className="store-creation-modal__field">
                <label>Marca / Brand</label>
                <input value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} placeholder="Nombre de la marca" />
              </div>
              <div className="store-creation-modal__field">
                <label>Capital Disponible</label>
                <input type="number" step="0.01" value={form.capitalDisponible} onChange={e => setForm({ ...form, capitalDisponible: e.target.value })} placeholder="€" />
              </div>
            </div>
          </div>

          {/* Gestor Assignment */}
          <div className="store-creation-modal__section">
            <label className="store-creation-modal__label">Asignar Gestor</label>
            <select value={form.gestorId} onChange={e => setForm({ ...form, gestorId: e.target.value })} required className="store-creation-modal__select">
              <option value="">Seleccionar gestor...</option>
              {gestors.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.storeCount || 0}/{g.gestorCapacity || 8} tiendas)
                </option>
              ))}
            </select>
            {selectedGestor && gestorStoreCount >= gestorCapacity && (
              <span className="store-creation-modal__warning">Este gestor ha alcanzado su capacidad máxima</span>
            )}
          </div>

          <div className="store-creation-modal__actions">
            <button type="button" className="btn-action btn-action--secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-action" disabled={saving}>
              {saving ? 'Creando...' : 'Crear Tienda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
