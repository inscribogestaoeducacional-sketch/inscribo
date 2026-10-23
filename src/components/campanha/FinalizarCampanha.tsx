// Finalizar campanha: janela de confirmação, relatório final da IA e encerramento do ciclo (fica só para consulta).
import { useEffect, useState } from 'react'
import { Flag, Loader2, Sparkles, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { aiFetch } from '../../lib/authHeaders'
import { AnalisePanel } from '../relatorios/shared'

type Cycle = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
interface Resumo { novos: number; novosMeta: number; rema: number; remaMeta: number; invest: number; pendentes: number; leads: number }
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const dmy = (d?: string | null) => (d ?? '').split('-').reverse().join('/')

export function FinalizarButton({ cycle, institutionId, institutionName, targetYear, onDone }: { cycle: Cycle; institutionId: string; institutionName: string; targetYear: number; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const [res, setRes] = useState<Resumo | null>(null)
  const from = cycle.start_date ?? `${targetYear - 1}-09-01`, to = cycle.end_date ?? `${targetYear}-03-31`

  const coletar = async () => {
    const [fn, inv, panel, tr, base] = await Promise.all([
      supabase.rpc('campaign_funnel', { p_inst: institutionId, p_from: from, p_to: to, p_source: null, p_grade: null, p_assigned: null }),
      supabase.rpc('report_investimento', { p_inst: institutionId, p_year: targetYear, p_from: from, p_to: to }),
      supabase.rpc('base_reenrollment_panel', { p_institution_id: institutionId, p_target_year: targetYear }),
      supabase.rpc('report_transferencias', { p_inst: institutionId, p_from: from, p_to: to }),
      supabase.rpc('campaign_investment_base', { p_inst: institutionId, p_year: targetYear, p_from: from, p_to: to }),
    ])
    const f = fn.data as { entraram: number; totais: Record<string, { n: number }> } | null
    const rows = (panel.data ?? []) as { grade_name: string; base_prev_year: number; graduates: number; reenrolled: number; pre_enrolled: number; pending: number; left_school: number; new_students: number }[]
    const sum = (k: 'reenrolled' | 'pending' | 'pre_enrolled' | 'left_school' | 'new_students') => rows.reduce((a, r) => a + (r[k] ?? 0), 0)
    const inv2 = inv.data as { total: number; por_categoria: unknown[]; por_canal: unknown[] } | null
    const b = base.data as { leads: number; novos: number; visits: number; by_origin: unknown[]; monthly: unknown[] } | null
    const tj = tr.data as { total: number; por_motivo: unknown[]; por_serie: unknown[] } | null
    const resumo: Resumo = { novos: b?.novos ?? 0, novosMeta: Number(cycle.target_new_students ?? 0), rema: sum('reenrolled'), remaMeta: Number(cycle.goal_reenrollments ?? 0), invest: inv2?.total ?? 0, pendentes: sum('pending'), leads: b?.leads ?? 0 }
    const dados = {
      campanha: cycle.label ?? `Campanha ${targetYear}`, periodo_da_campanha: `${dmy(from)} a ${dmy(to)}`,
      metas: { matriculas_novas: cycle.target_new_students, rematriculas: cycle.goal_reenrollments, total: cycle.goal_total, metas_mensais: cycle.monthly_targets },
      funil_da_campanha: f ? { leads: f.entraram, agendamentos: f.totais.scheduled?.n ?? 0, visitas: f.totais.visit?.n ?? 0, matriculas: f.totais.enrolled?.n ?? 0 } : null,
      resultados_pela_origem: b ? { leads: b.leads, visitas: b.visits, matriculas_novas: b.novos, por_origem: b.by_origin, por_mes: b.monthly } : null,
      rematricula_por_serie: rows.map(r => ({ serie: r.grade_name, ano_anterior: r.base_prev_year, concluintes: r.graduates, rematriculados: r.reenrolled, pre_matriculados: r.pre_enrolled, a_rematricular: r.pending, saiu: r.left_school, novos: r.new_students })),
      rematricula_total: { rematriculados: sum('reenrolled'), pre_matriculados: sum('pre_enrolled'), a_rematricular: sum('pending'), saiu: sum('left_school') },
      investimento: inv2 ? { total_reais: inv2.total, por_categoria: inv2.por_categoria, por_canal: inv2.por_canal, custo_por_lead: b?.leads ? inv2.total / b.leads : null, custo_por_matricula_nova: b?.novos ? inv2.total / b.novos : null } : null,
      saidas: tj ? { total: tj.total, motivos: tj.por_motivo, por_serie: tj.por_serie } : null,
    }
    return { resumo, dados }
  }

  useEffect(() => {
    if (!open || res) return
    coletar().then(r => setRes(r.resumo)).catch(() => setRes(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const finalizar = async () => {
    setBusy(true); setErr('')
    try {
      setMsg('Reunindo os números da campanha…')
      const { dados } = await coletar()
      setMsg('A IA está escrevendo o relatório final…')
      const resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action: 'report_module_analysis', payload: { module: 'campanha_final', moduleTitle: 'Relatório final da Campanha de Matrículas', institutionName, periodo: `${dmy(from)} a ${dmy(to)}`, data: dados } }) })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json.result) throw new Error(json?.error || `Erro ${resp.status}`)
      setMsg('Encerrando a campanha…')
      const { error } = await supabase.from('campaign_cycles').update({ status: 'completed', finished_at: new Date().toISOString(), final_report: json.result, final_report_at: new Date().toISOString() }).eq('id', cycle.id)
      if (error) throw new Error(error.message)
      setOpen(false); onDone()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível finalizar. A campanha continua ativa.') } finally { setBusy(false); setMsg('') }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setOk(false); setErr('') }} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13.5, color: '#fff', background: BRAND.primaryDark, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: 'inherit' }}><Flag size={15} /> Finalizar campanha</button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', width: 'min(480px, 100%)', maxHeight: '92vh', overflowY: 'auto', position: 'relative' }}>
            {!busy && <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ position: 'absolute', right: 14, top: 14, border: 'none', background: 'none', cursor: 'pointer', color: BRAND.muted }}><X size={18} /></button>}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 15, background: '#D1FAE5', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Flag size={26} color={BRAND.primaryDark} /></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.ink }}>Finalizar a {cycle.label ?? `Campanha ${targetYear}`}</div>
              <div style={{ fontSize: 13, color: BRAND.muted }}>A IA monta o relatório final e a campanha passa a ser só de consulta.</div>
            </div>
            <div style={{ background: BRAND.softer, border: '1px solid #E3E8F0', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: BRAND.ink, lineHeight: 1.8, minHeight: 60 }}>
              {!res ? <span style={{ color: BRAND.muted, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Loader2 size={14} className="animate-spin" /> Conferindo os números…</span> : <>
                <div>Matrículas novas: <b>{res.novos}{res.novosMeta ? ` de ${res.novosMeta} (meta)` : ''}</b></div>
                <div>Rematriculados: <b>{res.rema}{res.remaMeta ? ` de ${res.remaMeta} (meta)` : ''}</b></div>
                <div>Investimento total: <b>{brl(res.invest)}</b> · Leads no período: <b>{res.leads}</b></div>
                {res.pendentes > 0 && <div style={{ color: '#B45309' }}>Atenção: {res.pendentes} famílias ainda sem resposta de rematrícula.</div>}
              </>}
            </div>
            <div style={{ fontSize: 13, color: BRAND.ink, fontWeight: 700, margin: '12px 0 4px' }}>Ao finalizar:</div>
            <div style={{ fontSize: 13, color: BRAND.text, lineHeight: 1.7 }}>• Não dá para reabrir a campanha.<br />• O relatório final fica salvo na aba Relatório, com PDF.<br />• Os dados ficam de base para a próxima campanha.</div>
            <label style={{ display: 'flex', gap: 10, margin: '14px 0', fontSize: 13, color: BRAND.ink, cursor: 'pointer', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={ok} disabled={busy} onChange={e => setOk(e.target.checked)} style={{ width: 17, height: 17, marginTop: 1, accentColor: BRAND.primary }} />
              Li e confirmo o encerramento da {cycle.label ?? `Campanha ${targetYear}`}.
            </label>
            {err && <div style={{ color: '#B91C1C', fontSize: 13, marginBottom: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setOpen(false)} disabled={busy} style={{ flex: 1, padding: 11, borderRadius: 11, border: '1px solid #E3E8F0', background: '#fff', color: BRAND.muted, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={finalizar} disabled={!ok || busy} style={{ flex: 2, padding: 11, borderRadius: 11, border: 'none', background: ok && !busy ? BRAND.primaryDark : '#CBD5E1', color: '#fff', fontWeight: 700, cursor: ok && !busy ? 'pointer' : 'default', display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                {busy ? <><Loader2 size={15} className="animate-spin" /> {msg || 'Gerando…'}</> : <><Sparkles size={15} /> Confirmar e gerar relatório final</>}
              </button>
            </div>
            {busy && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 8 }}>Pode levar até um minuto. Não feche esta janela.</div>}
          </div>
        </div>
      )}
    </>
  )
}

export function RelatorioFinal({ cycle, institutionId, institutionName, targetYear }: { cycle: Cycle; institutionId: string; institutionName: string; targetYear: number }) {
  if (!cycle.final_report) return null
  const from = cycle.start_date ?? `${targetYear - 1}-09-01`, to = cycle.end_date ?? `${targetYear}-03-31`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="no-print" style={{ fontSize: 12.5, color: BRAND.muted }}>Campanha encerrada em {cycle.finished_at ? new Date(cycle.finished_at).toLocaleDateString('pt-BR') : '—'}. Este é o relatório final.</div>
      <AnalisePanel rep={cycle.final_report} err="" title="Relatório final da campanha" periodLabel={`${dmy(from)} a ${dmy(to)}`} institutionId={institutionId} institutionName={institutionName} />
    </div>
  )
}
