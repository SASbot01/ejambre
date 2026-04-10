import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

const SALES_FIELDS = [
  { key: 'date', label: 'Fecha', type: 'string' },
  { key: 'clientName', label: 'Nombre cliente', type: 'string' },
  { key: 'clientEmail', label: 'Email', type: 'string' },
  { key: 'clientPhone', label: 'Teléfono', type: 'string' },
  { key: 'instagram', label: 'Instagram', type: 'string' },
  { key: 'product', label: 'Producto', type: 'string' },
  { key: 'productoInteres', label: 'Producto interés', type: 'string' },
  { key: 'paymentType', label: 'Tipo de pago', type: 'string' },
  { key: 'installmentNumber', label: 'Número de cuota', type: 'string' },
  { key: 'paymentMethod', label: 'Método de pago', type: 'string' },
  { key: 'revenue', label: 'Revenue', type: 'number' },
  { key: 'cashCollected', label: 'Cash Collected', type: 'number' },
  { key: 'closer', label: 'Closer', type: 'string' },
  { key: 'setter', label: 'Setter', type: 'string' },
  { key: 'triager', label: 'Triager', type: 'string' },
  { key: 'gestorAsignado', label: 'Gestor asignado', type: 'string' },
  { key: 'utmSource', label: 'UTM Source', type: 'string' },
  { key: 'utmMedium', label: 'UTM Medium', type: 'string' },
  { key: 'utmCampaign', label: 'UTM Campaign', type: 'string' },
  { key: 'utmContent', label: 'UTM Content', type: 'string' },
  { key: 'pais', label: 'País', type: 'string' },
  { key: 'capitalDisponible', label: 'Capital disponible', type: 'string' },
  { key: 'situacionActual', label: 'Situación actual', type: 'string' },
  { key: 'expAmazon', label: 'Exp Amazon', type: 'string' },
  { key: 'decisorConfirmado', label: 'Decisor confirmado', type: 'string' },
  { key: 'fechaLlamada', label: 'Fecha llamada', type: 'string' },
  { key: 'status', label: 'Estado', type: 'string' },
  { key: 'notes', label: 'Notas', type: 'string' },
]

const REPORT_FIELDS = [
  { key: 'date', label: 'Fecha', type: 'string' },
  { key: 'role', label: 'Rol (setter/closer)', type: 'string' },
  { key: 'name', label: 'Nombre', type: 'string' },
  { key: 'conversationsOpened', label: 'Conversaciones', type: 'number' },
  { key: 'followUps', label: 'Follow Ups', type: 'number' },
  { key: 'offersLaunched', label: 'Ofertas', type: 'number' },
  { key: 'appointmentsBooked', label: 'Agendas', type: 'number' },
  { key: 'scheduledCalls', label: 'Llamadas agendadas', type: 'number' },
  { key: 'callsMade', label: 'Llamadas hechas', type: 'number' },
  { key: 'deposits', label: 'Depósitos', type: 'number' },
  { key: 'closes', label: 'Cierres', type: 'number' },
]

const CRM_FIELDS = [
  // Client data
  { key: 'name', label: 'Nombre', type: 'string' },
  { key: 'email', label: 'Email', type: 'string' },
  { key: 'phone', label: 'Teléfono', type: 'string' },
  { key: 'company', label: 'Empresa', type: 'string' },
  { key: 'country', label: 'País', type: 'string' },
  { key: 'address', label: 'Dirección', type: 'string' },
  { key: 'whatsapp', label: 'WhatsApp', type: 'string' },
  { key: 'instagram', label: 'Instagram', type: 'string' },
  { key: 'website', label: 'Website', type: 'string' },
  { key: 'source', label: 'Fuente', type: 'string' },
  { key: 'tags', label: 'Tags', type: 'string' },
  { key: 'notes', label: 'Notas', type: 'string' },
  // Team
  { key: 'assigned_closer', label: 'Closer', type: 'string' },
  { key: 'assigned_setter', label: 'Setter', type: 'string' },
  { key: 'assigned_cold_caller', label: 'Cold Caller', type: 'string' },
  { key: 'triager', label: 'Triager', type: 'string' },
  { key: 'gestor_asignado', label: 'Gestor asignado', type: 'string' },
  // Lead profile
  { key: 'situacion_actual', label: 'Situación actual', type: 'string' },
  { key: 'capital_disponible', label: 'Capital disponible', type: 'string' },
  { key: 'exp_amazon', label: 'Exp Amazon', type: 'string' },
  { key: 'decisor_confirmado', label: 'Decisor confirmado', type: 'string' },
  { key: 'producto_interes', label: 'Producto interés', type: 'string' },
  { key: 'fecha_llamada', label: 'Fecha llamada', type: 'string' },
  // UTMs
  { key: 'utm_source', label: 'UTM Source', type: 'string' },
  { key: 'utm_medium', label: 'UTM Medium', type: 'string' },
  { key: 'utm_campaign', label: 'UTM Campaign', type: 'string' },
  { key: 'utm_content', label: 'UTM Content', type: 'string' },
  // Payment
  { key: 'deal_value', label: 'Valor', type: 'number' },
  { key: 'product', label: 'Producto', type: 'string' },
  { key: 'payment_type', label: 'Tipo de pago', type: 'string' },
  { key: 'payment_method', label: 'Método de pago', type: 'string' },
  // Status
  { key: 'status', label: 'Estado', type: 'string' },
]

function autoMap(fileHeaders, fields) {
  const mapping = {}
  const normalize = s => s.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '')
  fileHeaders.forEach(header => {
    const h = normalize(header)
    let best = null
    for (const f of fields) {
      const fNorm = normalize(f.label)
      const fKey = normalize(f.key)
      if (h === fNorm || h === fKey || h.includes(fNorm) || fNorm.includes(h)) {
        best = f.key
        break
      }
    }
    if (best) mapping[header] = best
  })
  return mapping
}

export default function ImportModal({ type, onImport, onClose }) {
  const fields = type === 'sales' ? SALES_FIELDS : type === 'crm' ? CRM_FIELDS : REPORT_FIELDS
  const typeLabel = type === 'sales' ? 'Ventas' : type === 'crm' ? 'Leads CRM' : 'Reportes'
  const [step, setStep] = useState('upload') // upload, map, preview
  const [fileData, setFileData] = useState([])
  const [fileHeaders, setFileHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [mapped, setMapped] = useState([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const isCSV = file.name.toLowerCase().endsWith('.csv')

    const processData = (wb) => {
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
      if (json.length === 0) return
      const headers = Object.keys(json[0])
      setFileHeaders(headers)
      setFileData(json)
      setMapping(autoMap(headers, fields))
      setStep('map')
    }

    if (isCSV) {
      // Read CSV as UTF-8 text to preserve accents
      const reader = new FileReader()
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'string', raw: false })
        processData(wb)
      }
      reader.readAsText(file, 'UTF-8')
    } else {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result)
        const wb = XLSX.read(data, { type: 'array', codepage: 65001, raw: false })
        processData(wb)
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const applyMapping = () => {
    const result = fileData.map(row => {
      const obj = { source: 'import' }
      Object.entries(mapping).forEach(([header, fieldKey]) => {
        if (!fieldKey) return
        const field = fields.find(f => f.key === fieldKey)
        let val = row[header]
        if (field && field.type === 'number') {
          // Handle European number format: 1.473,05 → 1473.05
          val = String(val || '').trim()
          if (val.includes(',')) {
            val = val.replace(/\./g, '').replace(',', '.')
          }
          val = parseFloat(val) || 0
        } else {
          val = String(val || '').trim()
        }
        obj[fieldKey] = val
      })
      // Defaults for unmapped fields
      fields.forEach(f => {
        if (!(f.key in obj)) {
          obj[f.key] = f.type === 'number' ? 0 : ''
        }
      })
      return obj
    })
    setMapped(result)
    setStep('preview')
  }

  const confirmImport = async () => {
    setImporting(true)
    setImportError(null)
    try {
      await onImport(mapped)
      onClose()
    } catch (err) {
      setImportError(err.message || 'Error al importar los datos')
      setImporting(false)
    }
  }

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-header">
          <h2>Importar {typeLabel}</h2>
          <button className="import-close" onClick={onClose}>&times;</button>
        </div>

        {step === 'upload' && (
          <div className="import-body import-upload">
            <p>Sube un archivo <strong>.xlsx</strong> o <strong>.csv</strong></p>
            <p className="import-hint">La primera fila debe contener los nombres de las columnas.</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <button className="btn-import-upload" onClick={() => fileRef.current.click()}>
              Seleccionar archivo
            </button>
          </div>
        )}

        {step === 'map' && (
          <div className="import-body">
            <p className="import-step-label">Mapea las columnas de tu archivo a los campos del sistema:</p>
            <div className="import-map-grid">
              {fileHeaders.map(header => (
                <div key={header} className="import-map-row">
                  <span className="import-map-file">{header}</span>
                  <span className="import-map-arrow">&rarr;</span>
                  <select
                    value={mapping[header] || ''}
                    onChange={e => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                    className="import-map-select"
                  >
                    <option value="">— No importar —</option>
                    {fields.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="import-actions">
              <button className="btn-import-secondary" onClick={() => setStep('upload')}>Atrás</button>
              <button className="btn-import-primary" onClick={applyMapping}>
                Ver preview ({fileData.length} filas)
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="import-body">
            <p className="import-step-label">Preview — {mapped.length} registros listos para importar:</p>
            <div className="import-preview-wrap">
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {Object.values(mapping).filter(Boolean).map(key => {
                      const f = fields.find(fi => fi.key === key)
                      return <th key={key}>{f ? f.label : key}</th>
                    })}
                  </tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      {Object.values(mapping).filter(Boolean).map(key => (
                        <td key={key}>{row[key] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {mapped.length > 10 && <p className="import-more">... y {mapped.length - 10} registros más</p>}
            </div>
            {importError && (
              <div style={{ color: 'var(--danger, #e74c3c)', background: 'rgba(231,76,60,0.1)', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
                {importError}
              </div>
            )}
            <div className="import-actions">
              <button className="btn-import-secondary" onClick={() => setStep('map')} disabled={importing}>Atrás</button>
              <button className="btn-import-primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'Importando...' : `Importar ${mapped.length} registros`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
