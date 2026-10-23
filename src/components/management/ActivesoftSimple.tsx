// Integração Activesoft — tela simples: "cadastrou o token, sincronizou".
// Escola já conectada e mapeada: um cartão com o estado, o botão "Sincronizar agora" (leitura leve,
// confere se veio completa e grava sozinha) e os avisos. O passo a passo antigo continua em "Avançado"
// (primeira conexão, mapeamento de séries, troca de token).
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ActivesoftWizard from './ActivesoftWizard'

type Toast = (msg: string, ok?: boolean) => void
interface Conn { status: string; token_last4: string | null; token_expires_at: string | null; last_success_at: string | null; last_error: string | null; last_error_at: string | null; auth_scheme: string | null; auto_state: string | null }
interface Run { id: string; status: string; counts: Record<string, unknown>; error: string | null; finished_at: string | null }

const card: React.CSSProperties = { border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 18px', background: '#fff' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }

const ago = (iso: string | null) => {
  if (!iso) return 'nunca'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora há pouco'
  if (m < 60) return `há ${m} min`
  if (m < 1440) return `há ${Math.round(m / 60)} h`
  return `há ${Math.round(m / 1440)} dia(s)`
}

async function invoke(institutionId: string, runId: string) {
  const { data, error } = await supabase.functions.invoke('erp-activesoft-sync', { body: { action: 'step', institution_id: institutionId, run_id: runId } })
  if (error) {
    let msg = error.message
    try { const ctx = (error as { context?: Response }).context; if (ctx) msg = (await ctx.json())?.error || msg } catch { /* mantém */ }
    throw new Error(msg)
  }
  return data
}

export default function ActivesoftSimple({ institutionId, onToast }: { institutionId: string; onToast: Toast }) {
  const [conn, setConn] = useState<Conn | null>(null)
  const [lastOk, setLastOk] = useState<Run | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [adv, setAdv] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.from('erp_connections').select('status, token_last4, token_expires_at, last_success_at, last_error, last_error_at, auth_scheme, auto_state')
        .eq('institution_id', institutionId).eq('provider', 'activesoft').maybeSingle(),
      supabase.from('sync_runs').select('id, status, counts, error, finished_at').eq('institution_id', institutionId).eq('source', 'activesoft')
        .in('status', ['ok', 'ok_com_avisos']).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    setConn((c.data as Conn | null) ?? null); setLastOk((r.data as Run | null) ?? null); setLoaded(true)
  }, [institutionId])
  useEffect(() => { load() }, [load])

  const ready = !!conn?.token_last4 && !!conn.auth_scheme && !!lastOk
  const sync = async () => {
    setBusy(true); setError(''); setMsg('Iniciando a leitura…')
    try {
      const { data: runId, error: e } = await supabase.rpc('base_erp_sync_now', { p_institution_id: institutionId, p_mode: 'leve' })
      if (e) throw new Error(e.message)
      let status = 'rodando'
      for (let i = 0; i < 400 && alive.current; i++) {
        const r = await invoke(institutionId, runId as string)
        if (r?.status === 'erro') throw new Error(r.error || 'Erro na leitura')
        const p = r?.position
        setMsg(p ? `Lendo o Activesoft… passo ${Math.min(p.index + 1, p.total)} de ${p.total}` : 'Lendo o Activesoft…')
        status = r?.status
        if (status !== 'rodando' && status !== 'na_fila') break
      }
      if (status === 'aguardando_confirmacao') {
        const { data: run } = await supabase.from('sync_runs').select('counts').eq('id', runId as string).maybeSingle()
        const read = Number((run?.counts as Record<string, unknown> | null)?.alunos_lidos ?? 0)
        const prev = Number(lastOk?.counts?.alunos_lidos ?? 0)
        if (prev > 0 && read < prev * 0.7) {
          await supabase.rpc('base_erp_cancel', { p_institution_id: institutionId, p_run_id: runId as string })
          throw new Error(`A leitura veio incompleta (${read} alunos contra ${prev} na anterior). Nada foi alterado; tente de novo.`)
        }
        setMsg('Gravando na Base de alunos e atualizando os Contatos…')
        const { error: ae } = await supabase.rpc('base_erp_apply', { p_institution_id: institutionId, p_run_id: runId as string })
        if (ae) throw new Error(ae.message)
        onToast('Sincronização concluída.')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false); setMsg('') }
  }

  if (!loaded) return <Loader2 size={18} className="animate-spin" />

  const days = conn?.token_expires_at ? Math.ceil((new Date(conn.token_expires_at).getTime() - Date.now()) / 86400000) : null
  const alerts: string[] = []
  if (conn?.status === 'token_invalido') alerts.push('O Activesoft recusou o token. Gere outro no Activesoft e troque em "Avançado".')
  if (days !== null && days <= 30) alerts.push(days < 0 ? 'O token venceu. Gere outro no Activesoft.' : `O token vence em ${days} dia(s). Gere outro antes disso.`)
  if (conn?.last_error && conn.status !== 'token_invalido' && (!conn.last_success_at || (conn.last_error_at && conn.last_error_at > conn.last_success_at))) alerts.push(`Último erro: ${conn.last_error}`)
  const c = (lastOk?.counts ?? {}) as Record<string, unknown>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ready && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <CheckCircle2 size={20} color="#00A896" />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1A2B4A' }}>Activesoft conectado</div>
              <div style={{ fontSize: 12.5, color: '#64748B' }}>
                Última sincronização {ago(conn?.last_success_at ?? null)} · {String(c.alunos_lidos ?? c.alunos ?? '—')} alunos lidos · token ••••{conn?.token_last4}
              </div>
            </div>
            <button onClick={sync} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Sincronizar agora
            </button>
          </div>
          {busy && msg && <p style={{ fontSize: 12.5, color: '#475569', margin: '10px 0 0' }}>{msg}</p>}
          {error && <p style={{ fontSize: 12.5, color: '#B91C1C', margin: '10px 0 0' }}>{error}</p>}
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '10px 0 0', lineHeight: 1.6 }}>
            A leitura é só de consulta: nada é alterado no Activesoft. Ao terminar, a Base de alunos e os Contatos (cartão “Relação com a escola”) são atualizados.
          </p>
        </div>
      )}
      {alerts.map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 12.5, color: '#92400E' }}>
          <AlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} /> <span>{a}</span>
        </div>
      ))}
      {!ready && <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Cole o token do Activesoft, faça o teste e a primeira leitura abaixo. Depois disso esta tela fica só com o botão “Sincronizar agora”.</p>}
      <div>
        <button onClick={() => setAdv(!adv)} style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>
          {adv || !ready ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Avançado (token, teste, mapeamento de séries)
        </button>
        {(adv || !ready) && <div style={{ marginTop: 10 }}><ActivesoftWizard institutionId={institutionId} onToast={onToast} /></div>}
      </div>
    </div>
  )
}
