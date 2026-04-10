import Anthropic from '@anthropic-ai/sdk'
import { supabase, resolveClientId } from './lib/supabase.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { clientSlug } = req.body
    if (!clientSlug) return res.status(400).json({ error: 'clientSlug required' })

    const clientId = await resolveClientId(clientSlug)
    if (!clientId) return res.status(404).json({ error: 'Client not found' })

    // 1. Get all active pipeline contacts
    const { data: contacts } = await supabase
      .from('crm_contacts')
      .select('id, name, company, status, deal_value, assigned_closer, assigned_setter, updated_at, created_at, product, source, notes')
      .eq('client_id', clientId)
      .not('status', 'in', '("won","lost")')
      .order('updated_at', { ascending: true })

    // 2. Get recent activities
    const { data: activities } = await supabase
      .from('crm_activities')
      .select('contact_id, type, notes, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(100)

    // 3. Get won/lost stats for probability calculation
    const { data: closedDeals } = await supabase
      .from('crm_contacts')
      .select('status, deal_value, product, updated_at, created_at')
      .eq('client_id', clientId)
      .in('status', ['won', 'lost'])

    // 4. Get team info
    const { data: team } = await supabase
      .from('team')
      .select('id, name, role')
      .eq('client_id', clientId)
      .eq('active', true)

    // Calculate stagnant deals (no update in 3+ days)
    const now = new Date()
    const stagnant = (contacts || []).filter(c => {
      const lastUpdate = new Date(c.updated_at)
      const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24)
      return daysSinceUpdate >= 3
    })

    // Calculate pipeline value
    const pipelineValue = (contacts || []).reduce((sum, c) => sum + (Number(c.deal_value) || 0), 0)

    // Win rate
    const wonCount = (closedDeals || []).filter(d => d.status === 'won').length
    const totalClosed = (closedDeals || []).length
    const winRate = totalClosed > 0 ? ((wonCount / totalClosed) * 100).toFixed(1) : 0

    // Revenue from won deals
    const wonRevenue = (closedDeals || []).filter(d => d.status === 'won').reduce((s, d) => s + (Number(d.deal_value) || 0), 0)

    // Build context for Claude
    const pipelineSummary = {
      total_active_deals: (contacts || []).length,
      pipeline_value: pipelineValue,
      stagnant_deals: stagnant.length,
      win_rate: winRate,
      won_revenue: wonRevenue,
      deals_by_stage: {},
      team_members: (team || []).length,
    }

    // Count by stage
    for (const c of (contacts || [])) {
      pipelineSummary.deals_by_stage[c.status] = (pipelineSummary.deals_by_stage[c.status] || 0) + 1
    }

    // Ask Claude for intelligence
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Eres el analista de ventas AI de BlackWolf. Analiza este pipeline y genera insights accionables.

PIPELINE:
${JSON.stringify(pipelineSummary, null, 2)}

DEALS ESTANCADOS (${stagnant.length}):
${JSON.stringify(stagnant.map(s => ({ name: s.name, company: s.company, status: s.status, deal_value: s.deal_value, days_stagnant: Math.floor((now - new Date(s.updated_at)) / 86400000), closer: s.assigned_closer })), null, 2)}

ACTIVIDAD RECIENTE (últimas 100):
${JSON.stringify((activities || []).slice(0, 30).map(a => ({ contact: a.contact_id, type: a.type, date: a.created_at })), null, 2)}

DEALS CERRADOS (historial):
Won: ${wonCount}, Lost: ${totalClosed - wonCount}, Win Rate: ${winRate}%
Revenue ganado: ${wonRevenue}€

Responde SOLO con JSON válido (sin markdown ni backticks):
{
  "health_score": <0-100>,
  "revenue_forecast": <número estimado para este mes>,
  "alerts": [{"type": "stagnant|risk|opportunity", "title": "...", "description": "...", "deal_name": "...", "action": "..."}],
  "next_actions": [{"priority": "high|medium|low", "deal_name": "...", "action": "...", "reason": "..."}],
  "summary": "<2-3 frases resumen del estado del pipeline>"
}`
      }],
    })

    // Parse Claude response
    let intelligence
    try {
      const text = response.content[0].text.trim()
      intelligence = JSON.parse(text)
    } catch {
      intelligence = {
        health_score: 50,
        revenue_forecast: pipelineValue * (winRate / 100),
        alerts: stagnant.map(s => ({
          type: 'stagnant',
          title: `${s.name} estancado`,
          description: `${Math.floor((now - new Date(s.updated_at)) / 86400000)} días sin actividad`,
          deal_name: s.name,
          action: 'Contactar inmediatamente',
        })),
        next_actions: [],
        summary: `Pipeline con ${(contacts || []).length} deals activos. ${stagnant.length} estancados. Win rate: ${winRate}%.`,
      }
    }

    // Add raw metrics
    intelligence.metrics = pipelineSummary

    return res.status(200).json(intelligence)
  } catch (err) {
    console.error('Pipeline intelligence error:', err)
    return res.status(500).json({ error: err.message })
  }
}
