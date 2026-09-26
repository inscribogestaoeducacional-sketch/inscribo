// Aba "Não recebem campanhas" de Transmissões (broadcast_suppressions).
// A escola vê tudo, suprime manualmente e libera só as MANUAIS — opt-out
// ("parar"/"sair") e erro permanente da Meta não são desfeitos pela escola
// (garantido pela RLS). Liberar mantém o histórico.
import React, { useEffect, useState } from 'react'
import { ShieldOff, Plus, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Badge, Btn, ErrorBox, Empty, Modal, cardStyle, hintStyle, inputStyle, labelStyle } from './ui'

interface Row {
  id: string; phone: string; scope: 'marketing' | 'all'; reason: string; meta_error_code: number | null
  note: string | null; created_at: string; lifted_at: string | null
}

const REASON: Record<string, { label: string; color: string; bg: string }> = {
  opt_out_keyword:      { label: 'Pediu pra sair',       color: '#B45309', bg: '#FEF3C7' },
  meta_permanent_error: { label: 'Meta recusou o número', color: '#991B1B', bg: '#FEE2E2' },
  manual:               { label: 'Manual',               color: '#475569', bg: '#F1F5F9' },
}

export default function SuppressionPanel({ institutionId, userId }: { institutionId: string; userId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [showLifted, setShowLifted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ phone: '', scope: 'marketing' as 'marketing' | 'all', note: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    let q = supabase.from('broadcast_suppressions').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(500)
    if (!showLifted) q = q.is('lifted_at', null)
    const { data } = await q
    setRows((data || []) as Row[])
    setLoading(false)
  }
  useEffect(() => { load() }, [institutionId, showLifted]) // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    let digits = form.phone.replace(/\D/g, '')
    if (digits.length === 10 || digits.length === 11) digits = '55' + digits
    if (!/^55[1-9][0-9](9[0-9]{8}|[2-9][0-9]{7})$/.test(digits)) { setError('Informe um celular brasileiro com DDD'); return }
    setSaving(true); setError(null)
    const { error: e } = await supabase.from('broadcast_suppressions').insert({
      institution_id: institutionId, phone: digits, scope: form.scope, reason: 'manual', note: form.note.trim() || null, created_by: userId,
    })
    setSaving(false)
    if (e) { setError(e.code === '23505' ? 'Esse número já está nessa lista' : e.message); return }
    setAdding(false); setForm({ phone: '', scope: 'marketing', note: '' }); load()
  }

  async function lift(r: Row) {
    if (!confirm(`Liberar ${r.phone} pra receber campanhas de novo?`)) return
    const { error: e } = await supabase.from('broadcast_suppressions').update({ lifted_at: new Date().toISOString() }).eq('id', r.id)
    if (e) alert(e.message)
    load()
  }

  return (
    <div style={cardStyle}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Não recebem campanhas</h3>
          <p style={{ ...hintStyle, marginTop: 4 }}>Quem pediu pra sair, números que a Meta recusou e bloqueios manuais. Ficam fora de toda campanha automaticamente.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showLifted} onChange={e => setShowLifted(e.target.checked)} /> Mostrar liberados
          </label>
          <Btn onClick={() => { setError(null); setAdding(true) }}><Plus size={14} /> Adicionar número</Btn>
        </div>
      </div>
      {loading ? <div style={{ padding: 20 }}><div style={{ height: 52, borderRadius: 10, background: '#f8fafc' }} className="animate-pulse" /></div>
        : rows.length === 0 ? <Empty icon={<ShieldOff size={24} color="#0284C7" />} title="Ninguém na lista" text="Quando alguém responder &quot;parar&quot; ou &quot;sair&quot; a uma campanha, ou a Meta recusar um número, ele aparece aqui." />
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Número', 'Motivo', 'Vale pra', 'Desde', ''].map(h => <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map(r => {
                  const rs = REASON[r.reason] || REASON.manual
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9', opacity: r.lifted_at ? 0.55 : 1 }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: '#1e293b' }}>{r.phone}{r.note && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.note}</div>}</td>
                      <td style={{ padding: '10px 16px' }}><Badge label={rs.label} color={rs.color} bg={rs.bg} /></td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#475569' }}>{r.scope === 'all' ? 'Todas as campanhas' : 'Campanhas de marketing'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748b' }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}{r.lifted_at && ` · liberado em ${new Date(r.lifted_at).toLocaleDateString('pt-BR')}`}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        {!r.lifted_at && r.reason === 'manual' && <Btn variant="secondary" onClick={() => lift(r)}><Undo2 size={13} /> Liberar</Btn>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      {adding && (
        <Modal title="Adicionar à lista" onClose={() => setAdding(false)}
          footer={<><Btn variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn><Btn loading={saving} onClick={add}>Adicionar</Btn></>}>
          <div style={{ display: 'grid', gap: 14 }}>
            <ErrorBox message={error} />
            <div>
              <label style={labelStyle}>Celular (com DDD)</label>
              <input style={inputStyle} value={form.phone} placeholder="(83) 99999-9999" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Vale pra</label>
              <select style={inputStyle} value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as any }))}>
                <option value="marketing">Campanhas de marketing (continua recebendo avisos de utilidade)</option>
                <option value="all">Todas as campanhas</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Observação (opcional)</label>
              <input style={inputStyle} value={form.note} maxLength={200} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
