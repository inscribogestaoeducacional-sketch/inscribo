// Aviso "matriculados na integração que não estão no funil". Vale para qualquer
// API conectada em Integrações (hoje Activesoft). Nada entra sozinho: a pessoa
// vê a lista, marca e confirma.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, Plug, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

interface Gap {
  student_id: string; full_name: string; grade: string | null; enrolled_at: string | null
  guardian_name: string | null; guardian_phone: string | null; source: string | null
  match_lead_id: string | null; match_status: string | null; already_here: boolean | null
}
const STAGE: Record<string, string> = { new: 'Novo', contact: 'Em contato', scheduled: 'Visita agendada', visit: 'Visitou', proposal: 'Proposta', lost: 'Perdido', enrolled: 'Matriculado' }
const PROVIDER: Record<string, string> = { activesoft: 'Activesoft' }

export default function IntegrationGap({ institutionId, role, onDone, toast }: {
  institutionId: string; role?: string | null; onDone: () => void; toast: (msg: string, type: 'error' | 'success') => void
}) {
  const [rows, setRows] = useState<Gap[]>([])
  const [provider, setProvider] = useState('a integração')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const canImport = ['manager', 'admin', 'gestor', 'superadmin', 'super_admin'].includes(role ?? '')

  const load = useCallback(async () => {
    const [{ data, error }, { data: conn }] = await Promise.all([
      supabase.rpc('integration_enrolled_gap', { p_institution_id: institutionId }),
      supabase.from('erp_connections').select('provider').eq('institution_id', institutionId).limit(1).maybeSingle(),
    ])
    if (error) { console.error('[integration_enrolled_gap]', error); return }
    setRows((data ?? []) as Gap[])
    const p = (conn as { provider?: string } | null)?.provider
    if (p) setProvider(PROVIDER[p] ?? p)
  }, [institutionId])
  useEffect(() => { load() }, [load])

  const pending = useMemo(() => rows.filter(r => !r.already_here), [rows])
  const here = rows.length - pending.length
  useEffect(() => { setSel(new Set(pending.map(r => r.student_id))) }, [pending])

  if (!canImport || pending.length === 0) return null

  const doImport = async () => {
    setSaving(true)
    const { data, error } = await supabase.rpc('integration_import_enrolled', { p_institution_id: institutionId, p_student_ids: [...sel] })
    setSaving(false)
    if (error) { toast('Não consegui trazer os alunos: ' + error.message, 'error'); return }
    const r = (data as { created: number; updated: number }[] | null)?.[0]
    toast(`${r?.created ?? 0} lead${(r?.created ?? 0) === 1 ? '' : 's'} criado${(r?.created ?? 0) === 1 ? '' : 's'}${r?.updated ? ` e ${r.updated} atualizado${r.updated === 1 ? '' : 's'}` : ''}.`, 'success')
    setOpen(false); await load(); onDone()
  }

  return (
    <>
      <div className="ld-in" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plug size={18} color="#B45309" /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#92400E' }}>{pending.length} aluno{pending.length === 1 ? '' : 's'} novo{pending.length === 1 ? '' : 's'} já matriculado{pending.length === 1 ? '' : 's'} no {provider} não {pending.length === 1 ? 'está' : 'estão'} no funil</div>
          <div style={{ fontSize: 12, color: '#B45309' }}>{here > 0 ? `${here} já ${here === 1 ? 'está' : 'estão'} aqui · ` : ''}os números de matrícula ficam abaixo da realidade até trazer</div>
        </div>
        <button type="button" onClick={() => setOpen(true)} style={{ background: BRAND.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Ver e trazer para cá</button>
      </div>

      {open && (
        <div onClick={() => !saving && setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div onClick={e => e.stopPropagation()} className="ld-in" style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>Matriculados no {provider} que faltam aqui</div>
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>Cada um vira um lead na etapa Matriculado, com a matrícula registrada. Quem já existe em outra etapa é só movido.</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} color={BRAND.muted} /></button>
            </div>
            <div style={{ padding: '8px 18px', display: 'flex', gap: 12, fontSize: 12.5, borderBottom: `1px solid ${BRAND.line}` }}>
              <button type="button" onClick={() => setSel(new Set(pending.map(r => r.student_id)))} style={{ border: 'none', background: 'none', color: BRAND.primaryDark, fontWeight: 700, cursor: 'pointer' }}>Marcar todos</button>
              <button type="button" onClick={() => setSel(new Set())} style={{ border: 'none', background: 'none', color: BRAND.muted, fontWeight: 600, cursor: 'pointer' }}>Desmarcar</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {pending.map(r => (
                <label key={r.student_id} className="ld-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderBottom: '1px solid #F1F5F4', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sel.has(r.student_id)} onChange={e => setSel(prev => { const n = new Set(prev); if (e.target.checked) n.add(r.student_id); else n.delete(r.student_id); return n })} style={{ width: 17, height: 17, accentColor: BRAND.primary }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{r.full_name}</div>
                    <div style={{ fontSize: 12, color: BRAND.muted }}>{r.grade || 'Série não informada'}{r.guardian_name ? ` · ${r.guardian_name}` : ''}{r.guardian_phone ? ` · ${r.guardian_phone}` : ''}</div>
                  </div>
                  {r.match_status && <span style={{ fontSize: 11, fontWeight: 700, background: '#EEF2FF', color: '#4338CA', padding: '2px 9px', borderRadius: 99 }}>já é lead: {STAGE[r.match_status] ?? r.match_status}</span>}
                </label>
              ))}
            </div>
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.muted, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={doImport} disabled={saving || sel.size === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: sel.size === 0 ? '#CBD5E1' : BRAND.primary, color: '#fff', fontWeight: 800, cursor: sel.size === 0 ? 'not-allowed' : 'pointer' }}>
                <CheckCircle size={15} />{saving ? 'Trazendo...' : `Trazer ${sel.size} para o funil`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
