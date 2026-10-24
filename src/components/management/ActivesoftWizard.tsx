// src/components/management/ActivesoftWizard.tsx
//
// Configurações → Integrações → "Sistema da escola (Activesoft)". Só admin.
// Quatro passos curtos, mesmo fluxo para toda escola:
//   1. Conectar: o admin digita o token AQUI (vai direto ao Vault; a tela só
//      mostra os 4 últimos caracteres). Nunca por chat ou arquivo.
//   2. Testar: uma chamada em cada rota de leitura permitida (edge function
//      erp-activesoft-sync, action test) e a forma de pedir o ano seguinte.
//      "Conferir períodos" (action periodos) conta por ano e situação SEM gravar.
//   3. Mapear: lê unidades, turmas, enturmações e alunos (25 por página, fila
//      que continua de onde parou) e mostra unidades e séries para conferir.
//   4. Carga: contagem do que vai mudar (não grava) → confirmação → grava.
// Nomes: caixa "Guardar nomes" só habilita com o aditivo LGPD registrado pelo
// Super Admin; o banco também confere.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { KeyRound, Loader2, CheckCircle2, XCircle, Trash2, PlayCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useGradeLevels } from '../../hooks/useGradeLevels'
import ErpTokenGuide from './ErpTokenGuide'
import { ERP_GUIDES, permissionHint } from '../../lib/erpGuides'

const GUIDE = ERP_GUIDES.activesoft

type Toast = (msg: string, ok?: boolean) => void
interface Conn {
  status: string; token_last4: string | null; token_expires_at: string | null; last_success_at: string | null; last_error: string | null
  api_base_url: string; auth_scheme: string | null; unit_filter: string[] | null; scopes_ok: Record<string, unknown>
  fields_seen: Record<string, string[]>; last_test_at: string | null
}
interface Run { id: string; kind: string; status: string; step: string | null; counts: Record<string, unknown>; error: string | null; queued_at: string }
interface Mapping {
  unidades: { id: string; nome: string; enturmacoes: number; incluida: boolean }[]
  series: { serie_key: string; serie_nome: string | null; curso_nome: string | null; enturmacoes: number; grade_level_id: string | null; como: string | null }[]
  anos: Record<string, number>; alunos: number; turmas: number; cursos: number
}
type Summary = Record<string, unknown> & {
  linhas_lidas: number; alunos_novos_na_base: number; cruzados_pela_matricula: number; atualizados: number; sem_mudanca: number
  alunos_novos_no_ano: number; divergencias: number; divergencias_amostra: { matricula: string; ano: number; antes: string; agora: string }[]
  series_nao_reconhecidas: Record<string, number>; situacoes_nao_reconhecidas: Record<string, number>; nomes_descartados: number
  cruzamento: { target_year: number; base_ano_anterior: number; rematriculados: number; a_rematricular: number; sairam: number; novatos: number; concluintes: number }[]
}

// Unidades: a documentação não diz a permissão; unidade_id e unidade já vêm em
// lista_turmas. Com 403, a rota aparece com selo cinza, não como erro.
const notNeeded = (k: string, r: { ok: boolean; status: number | null }) => k === 'unidades' && !r.ok && r.status === 403

const ROUTE_LABEL: Record<string, string> = {
  unidades: 'Unidades', cursos: 'Cursos', turmas: 'Turmas', enturmacao: 'Enturmação', alunos: 'Alunos',
  responsaveis: 'Responsáveis',
}
const STEP_LABEL: Record<string, string> = {
  unidades: 'unidades', cursos: 'cursos', turmas: 'turmas', enturmacao_A: 'enturmações ativas', enturmacao_I: 'enturmações inativas',
  enturmacao_P: 'pré-matrículas', enturmacao_S: 'enturmações (outras)', alunos: 'alunos', responsaveis: 'responsáveis', contagem: 'contagem',
}
// etapas por ano: turmas_2027, enturmacao_2027_P, enturmacao_2027_t413_P
const stepLabel = (k: string) => {
  const t = k.match(/^turmas_(\d{4})$/); if (t) return `turmas de ${t[1]}`
  const e = k.match(/^enturmacao_(\d{4})(?:_t\w+)?_([AIPS])$/); if (e) return `${STEP_LABEL['enturmacao_' + e[2]]} de ${e[1]}`
  return STEP_LABEL[k] ?? k
}

const box: CSSProperties = { border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px' }
const input: CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', color: '#1A2B4A', boxSizing: 'border-box' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: '#05907B', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSec: CSSProperties = { ...btn, background: '#F1F5F9', color: '#475569' }
const off = (s: CSSProperties): CSSProperties => ({ ...s, opacity: 0.55, cursor: 'not-allowed' })
const small: CSSProperties = { fontSize: 12, color: '#64748B', margin: '4px 0 10px', lineHeight: 1.6 }

async function invoke(action: string, institutionId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('erp-activesoft-sync', { body: { action, institution_id: institutionId, ...extra } })
  if (error) {
    let msg = error.message
    try { const ctx = (error as { context?: Response }).context; if (ctx) msg = (await ctx.json())?.error || msg } catch { /* mantém */ }
    throw new Error(msg)
  }
  return data
}

export default function ActivesoftWizard({ institutionId, onToast }: { institutionId: string; onToast: Toast }) {
  const { gradeLevels } = useGradeLevels(institutionId)
  const [conn, setConn] = useState<Conn | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [namesAllowed, setNamesAllowed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState<number>(1)

  const load = useCallback(async () => {
    const [c, r, n] = await Promise.all([
      supabase.from('erp_connections')
        .select('status, token_last4, token_expires_at, last_success_at, last_error, api_base_url, auth_scheme, unit_filter, scopes_ok, fields_seen, last_test_at')
        .eq('institution_id', institutionId).eq('provider', 'activesoft').maybeSingle(),
      supabase.from('sync_runs').select('id, kind, status, step, counts, error, queued_at')
        .eq('institution_id', institutionId).eq('source', 'activesoft').order('queued_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.rpc('base_names_allowed', { p_institution_id: institutionId }),
    ])
    const cc = (c.data as Conn | null) ?? null
    const rr = (r.data as Run | null) ?? null
    setConn(cc); setRun(rr); setNamesAllowed(n.data === true); setLoaded(true)
    // abre o passo onde a escola parou
    setOpen(!cc?.token_last4 ? 1 : !cc.auth_scheme ? 2 : 3)
    return { conn: cc, run: rr }
  }, [institutionId])

  useEffect(() => { load() }, [load])

  if (!loaded) return <Loader2 size={18} className="animate-spin" />

  const tested = !!conn?.auth_scheme
  const steps = [
    { n: 1, title: 'Conectar', done: !!conn?.token_last4, sub: conn?.token_last4 ? `token ••••${conn.token_last4}` : 'cole o token do Activesoft' },
    { n: 2, title: 'Testar', done: tested && Object.entries(conn?.scopes_ok ?? {}).filter(([k]) => k in ROUTE_LABEL)
        .every(([k, v]) => v === true || (typeof v === 'object' && ((v as { ok?: boolean })?.ok === true
          || notNeeded(k, { ok: false, status: (v as { status?: number })?.status ?? null })))), sub: conn?.last_test_at ? `testado em ${new Date(conn.last_test_at).toLocaleString('pt-BR')}` : 'confere as rotas de leitura' },
    { n: 3, title: 'Mapear', done: run?.status === 'aguardando_confirmacao' || run?.status === 'ok' || run?.status === 'ok_com_avisos', sub: 'unidades, cursos, turmas e séries' },
    { n: 4, title: 'Carga', done: run?.status === 'ok' || run?.status === 'ok_com_avisos', sub: conn?.last_success_at ? `última carga ${new Date(conn.last_success_at).toLocaleString('pt-BR')}` : 'contar, conferir e gravar' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map(s => {
        const enabled = s.n === 1 || (s.n === 2 && !!conn?.token_last4) || (s.n >= 3 && tested)
        return (
          <div key={s.n} style={{ ...box, opacity: enabled ? 1 : 0.6 }}>
            <button onClick={() => enabled && setOpen(open === s.n ? 0 : s.n)}
              style={{ all: 'unset', cursor: enabled ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <span style={{ width: 24, height: 24, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: s.done ? '#05907B' : '#F1F5F9', color: s.done ? '#fff' : '#475569', fontSize: 12, fontWeight: 800 }}>
                {s.done ? '✓' : s.n}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>{s.title}</span>
              <span style={{ fontSize: 12, color: '#94A3B8', flex: 1 }}>{s.sub}</span>
              {enabled && (open === s.n ? <ChevronDown size={16} color="#94A3B8" /> : <ChevronRight size={16} color="#94A3B8" />)}
            </button>
            {open === s.n && enabled && (
              <div style={{ marginTop: 12 }}>
                {s.n === 1 && <StepConnect institutionId={institutionId} conn={conn} onDone={async () => { await load(); setOpen(2) }} onToast={onToast} />}
                {s.n === 2 && <StepTest institutionId={institutionId} conn={conn} onDone={async (accepted) => { await load(); setOpen(accepted ? 3 : 2) }} />}
                {s.n === 3 && <StepMap institutionId={institutionId} run={run} namesAllowed={namesAllowed} gradeLevels={gradeLevels}
                                onChanged={load} onReady={() => setOpen(4)} />}
                {s.n === 4 && <StepLoad institutionId={institutionId} run={run} onChanged={load} onToast={onToast} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 1. Conectar ──
function StepConnect({ institutionId, conn, onDone, onToast }: { institutionId: string; conn: Conn | null; onDone: () => void; onToast: Toast }) {
  const [token, setToken] = useState('')
  const [expires, setExpires] = useState(conn?.token_expires_at ?? '')
  const [url, setUrl] = useState(conn?.api_base_url ?? '')
  const [adv, setAdv] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (token.trim().length < 8) { onToast('Cole o token completo.', false); return }
    setSaving(true)
    const { error } = await supabase.rpc('erp_connection_save_token', {
      p_institution_id: institutionId, p_provider: 'activesoft', p_token: token.trim(), p_expires_at: expires || null,
    })
    setSaving(false); setToken('')
    if (error) { onToast('Não foi possível salvar: ' + error.message, false); return }
    onToast('Token guardado com segurança. Agora teste a conexão.')
    onDone()
  }
  const remove = async () => {
    if (!window.confirm('Desconectar o Activesoft? O token é apagado. Os alunos já carregados ficam.')) return
    const { error } = await supabase.rpc('erp_connection_remove', { p_institution_id: institutionId, p_provider: 'activesoft' })
    if (error) { onToast('Não foi possível desconectar: ' + error.message, false); return }
    onDone()
  }
  const saveUrl = async () => {
    const { error } = await supabase.rpc('base_erp_set_base_url', { p_institution_id: institutionId, p_url: url })
    if (error) { onToast('Endereço recusado: só endereços https do Activesoft.', false); return }
    onToast('Endereço salvo. Teste a conexão de novo.')
    onDone()
  }

  return (
    <div>
      <ErpTokenGuide guide={GUIDE} defaultOpen={!conn?.token_last4} />
      <p style={small}>
        Cole o token abaixo. Ele vai direto para o cofre de senhas; depois de salvo, nem a Áion vê o token inteiro.
        {conn?.token_last4 && <> Token atual: <strong>••••{conn.token_last4}</strong>.</>}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)}
          placeholder={conn?.token_last4 ? 'Colar um token novo (troca o atual)' : 'Colar o token'} style={{ ...input, width: 320 }} />
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Vale até (opcional)<br />
          <input type="date" value={expires ?? ''} onChange={e => setExpires(e.target.value)} style={{ ...input, marginTop: 4 }} />
        </label>
        <button onClick={save} disabled={saving} style={saving ? off(btn) : btn}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Salvar token
        </button>
        {conn?.token_last4 && <button onClick={remove} style={btnSec}><Trash2 size={14} /> Desconectar</button>}
      </div>
      {conn?.token_last4 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setAdv(!adv)} style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
            {adv ? '▾' : '▸'} Endereço da API (só mude se o Activesoft pedir)
          </button>
          {adv && (
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input value={url} onChange={e => setUrl(e.target.value)} style={{ ...input, width: 360 }} />
              <button onClick={saveUrl} style={btnSec}>Salvar endereço</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 2. Testar ──
// Resultado sempre visível: o da chamada que acabou de rodar ou, ao reabrir, o
// que ficou gravado em erp_connections (scopes_ok). Formato por rota:
// { ok, status, msg } (testes antigos gravavam true ou um texto).
type RouteResult = { ok: boolean; status: number | null; msg: string }
function readScopes(scopes: Record<string, unknown> | undefined): Record<string, RouteResult> {
  const out: Record<string, RouteResult> = {}
  for (const [k, v] of Object.entries(scopes ?? {})) {
    if (k.startsWith('_')) continue
    if (v === true) out[k] = { ok: true, status: null, msg: 'ok' }
    else if (v && typeof v === 'object') {
      const o = v as { ok?: boolean; status?: number; msg?: string }
      out[k] = { ok: o.ok === true, status: o.status ?? null, msg: o.msg ?? '' }
    } else if (typeof v === 'string') out[k] = { ok: false, status: null, msg: v }
  }
  return out
}

function StepTest({ institutionId, conn, onDone }: { institutionId: string; conn: Conn | null; onDone: (accepted: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fresh, setFresh] = useState<{ scopes: Record<string, unknown>; fields: Record<string, string[]>; scheme: string | null; shown?: string; base_url?: string } | null>(null)
  const [showFields, setShowFields] = useState(false)

  const test = async () => {
    setBusy(true); setError(''); setFresh(null)
    let accepted = false
    try {
      // rotas em paralelo (15 s cada) + períodos (até 45 s); 120 s é folga de sobra
      const r = await Promise.race([
        invoke('test', institutionId),
        new Promise((_, rej) => setTimeout(() => rej(new Error('O teste demorou mais de 2 minutos e foi interrompido. Tente de novo em alguns minutos.')), 120_000)),
      ]) as { ok?: boolean; any_ok?: boolean; scheme?: string | null; shown?: string; base_url?: string; scopes?: Record<string, unknown>; fields?: Record<string, string[]>; error?: string | null }
      if (!r || !r.scopes) throw new Error('A função de teste não devolveu resultado.')
      setFresh({ scopes: r.scopes, fields: r.fields ?? {}, scheme: r.scheme ?? null, shown: r.shown, base_url: r.base_url })
      if (r.error) setError(r.error)
      accepted = !!r.any_ok
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      onDone(accepted)
    }
  }

  const scopesRaw = fresh?.scopes ?? conn?.scopes_ok ?? {}
  const routes = readScopes(scopesRaw)
  const auth = (scopesRaw as { _auth?: { aceita?: string | null; mostrada?: string; endereco?: string } })._auth
  const scheme = fresh ? fresh.scheme : conn?.auth_scheme ?? null
  const fields = fresh?.fields ?? conn?.fields_seen ?? {}
  const savedError = !fresh && !busy ? conn?.last_error : null
  const hasResult = Object.keys(routes).length > 0
  // Só unidades sem permissão: não é erro (as unidades vêm das turmas)
  const failed = Object.entries(routes).filter(([k, r]) => k in ROUTE_LABEL && !r.ok && !notNeeded(k, r))
  const onlyOptional = hasResult && failed.length === 0

  return (
    <div>
      <p style={small}>Faz uma chamada de 1 registro em cada rota de leitura permitida. Nada é gravado; guardamos só os nomes dos campos que a API devolve.</p>
      <button onClick={test} disabled={busy} style={busy ? off(btn) : btn}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} {busy ? 'Testando…' : 'Testar conexão'}
      </button>
      {busy && <p style={small}>Testando as 6 rotas e os períodos… pode levar até um minuto.</p>}
      {!busy && !onlyOptional && (error || savedError) && (
        <p style={{ ...small, color: '#B91C1C' }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {error || savedError}</p>
      )}
      {!busy && !hasResult && conn?.last_test_at && !error && !savedError && (
        <p style={small}>O último teste não deixou resultado por rota. Clique em "Testar conexão" para ver o detalhe.</p>
      )}
      {!busy && hasResult && (
        <div style={{ marginTop: 12, border: '1px solid #F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
          {Object.keys(ROUTE_LABEL).filter(k => routes[k]).map(k => {
            const r = routes[k]
            return (
              <div key={k} style={{ padding: '6px 10px', borderTop: '1px solid #F1F5F9', fontSize: 12 }}>
                {notNeeded(k, r) ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, background: '#E2E8F0', display: 'inline-block' }} />
                    <span style={{ width: 190, color: '#64748B', fontWeight: 600 }}>{ROUTE_LABEL[k]}</span>
                    <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', borderRadius: 999, padding: '2px 8px' }}>
                      não necessário: as unidades vêm das turmas
                    </span>
                  </div>
                ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {r.ok ? <CheckCircle2 size={14} color="#047857" /> : <XCircle size={14} color="#B91C1C" />}
                  <span style={{ width: 190, color: '#1A2B4A', fontWeight: 600 }}>{ROUTE_LABEL[k]}</span>
                  <span style={{ width: 54, color: r.ok ? '#047857' : '#B91C1C', fontFamily: 'monospace' }}>{r.status ?? '—'}</span>
                  <span style={{ flex: 1, color: r.ok ? '#64748B' : '#B91C1C' }}>{r.msg}</span>
                </div>
                )}
                {!r.ok && r.status === 403 && !notNeeded(k, r) && permissionHint(GUIDE, k) && (
                  <div style={{ margin: '4px 0 2px 22px', color: '#B45309' }}>{ROUTE_LABEL[k]}: {permissionHint(GUIDE, k)}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!busy && hasResult && (
        <p style={{ ...small, marginTop: 8 }}>
          Autenticação aceita: <strong>{scheme ?? 'nenhuma'}</strong>
          {!scheme && (auth?.mostrada || fresh?.shown) && <> (resultado acima com {auth?.mostrada ?? fresh?.shown})</>}
          {' · '}endereço: <span style={{ fontFamily: 'monospace' }}>{fresh?.base_url ?? auth?.endereco ?? conn?.api_base_url}</span>
        </p>
      )}
      {!busy && hasResult && <PeriodSaved p={(scopesRaw as { _periodos?: SavedPeriods })._periodos} />}
      {!busy && scheme && <PeriodCheck institutionId={institutionId} />}
      {!busy && Object.keys(fields).length > 0 && (
        <div>
          <button onClick={() => setShowFields(!showFields)} style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
            {showFields ? '▾' : '▸'} Campos que a API devolve (só os nomes)
          </button>
          {showFields && Object.entries(fields).map(([k, v]) => (
            <p key={k} style={{ fontSize: 11, color: '#64748B', margin: '4px 0', fontFamily: 'monospace' }}><strong>{ROUTE_LABEL[k] ?? k}:</strong> {v.join(', ') || '—'}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 2b. Períodos ──
// Resumo gravado pelo teste (só a forma que funcionou, sem dados) e a
// conferência completa, que não grava nada.
type SavedPeriods = { atual?: string; seguinte?: string; modo?: string; valor?: string | null; detalhe?: string; falta_proximo_periodo?: boolean
  turmas?: Record<string, number>; erro?: string }
const MODO_LABEL: Record<string, string> = { sigla: 'período pela sigla', id: 'período pelo número (id)', turma: 'uma turma por vez', nenhum: 'só o ano atual' }

function PeriodSaved({ p }: { p?: SavedPeriods }) {
  if (!p) return <p style={small}>Períodos: ainda não testados. Teste a conexão de novo para a carga ler também o ano seguinte.</p>
  if (p.erro) return <p style={{ ...small, color: '#B91C1C' }}>Períodos: o teste falhou ({p.erro}). A carga lê só o ano atual.</p>
  const warn = p.falta_proximo_periodo || p.modo === 'nenhum'
  return (
    <p style={{ ...small, color: warn ? '#B45309' : '#334155' }}>
      Períodos: turmas {Object.entries(p.turmas ?? {}).map(([a, n]) => `${a}: ${n}`).join(' · ')}. A carga lê{' '}
      <strong>{p.modo === 'nenhum' ? `só ${p.atual}` : `${p.atual} e ${p.seguinte}`}</strong> ({MODO_LABEL[p.modo ?? 'nenhum']}
      {p.valor ? `: periodo=${p.valor}` : ''}). {p.detalhe}
    </p>
  )
}

type Tentativa = { forma: string; parametro: string; http: number; itens: number; total?: number; resultado: string; msg?: string
  turmas: { seguinte: number; atual: number; outras: number }; cru: Record<string, unknown>[]; envelope?: string[] }
type YearCount = { enturmacoes: number; alunos: number; parcial: boolean; por_situacao: Record<string, number>; por_status: Record<string, number>
  turmas_de_outro_ano: number; erros: string[] }
type PeriodsResult = SavedPeriods & {
  turmas: Record<string, { n: number; parcial: boolean; siglas: Record<string, number>; http: number; msg?: string }>
  tentativas: Tentativa[]; segundos: number
  contagem: { anos: Record<string, YearCount>; chamadas: number
    rematricula: { ano: string; base: number; rematriculados: number; pre_matriculados: number; sairam: number; a_rematricular: number; novatos: number } | null }
}
const RESULT_LABEL: Record<string, [string, string]> = {
  funciona: ['funciona', '#047857'], ignorou_o_filtro: ['ignorou o filtro (veio o ano atual)', '#B45309'], misturado: ['misturado', '#B45309'],
  vazio: ['vazio', '#64748B'], erro: ['erro', '#B91C1C'],
}
const STATUS_LABEL: Record<string, string> = { ativo: 'cursando', pre_matricula: 'pré-matrícula', concluido: 'concluído', transferido: 'transferido',
  cancelado: 'cancelado', desistente: 'desistente', remanejado: 'remanejado', desconhecido: 'não reconhecida' }

function PeriodCheck({ institutionId }: { institutionId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [r, setR] = useState<PeriodsResult | null>(null)
  const [raw, setRaw] = useState(false)
  const run = async () => {
    setBusy(true); setError(''); setR(null)
    try {
      const d = await Promise.race([
        invoke('periodos', institutionId),
        new Promise((_, rej) => setTimeout(() => rej(new Error('A conferência demorou mais de 3 minutos e foi interrompida.')), 180_000)),
      ]) as PeriodsResult
      if (!d?.contagem) throw new Error('A função não devolveu a contagem.')
      setR(d)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  const anos = r ? Object.entries(r.contagem.anos) : []
  const rm = r?.contagem.rematricula
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
      <p style={small}>Conferir os períodos: lê as turmas e enturmações deste ano e do seguinte e conta por situação.
        <strong> Nada é gravado</strong> (nem na base, nem na leitura em espera).</p>
      <button onClick={run} disabled={busy} style={busy ? off(btnSec) : btnSec}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} {busy ? 'Conferindo… (até 2 minutos)' : 'Conferir períodos (não grava nada)'}
      </button>
      {error && <p style={{ ...small, color: '#B91C1C' }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {error}</p>}
      {r && (
        <div style={{ marginTop: 10 }}>
          <p style={{ ...small, color: r.falta_proximo_periodo || r.modo === 'nenhum' ? '#B45309' : '#047857', fontWeight: 600 }}>{r.detalhe}</p>
          <div style={{ border: '1px solid #F1F5F9', borderRadius: 10, overflow: 'hidden', fontSize: 12 }}>
            {anos.map(([ano, y]) => (
              <div key={ano} style={{ padding: '8px 10px', borderTop: '1px solid #F1F5F9', color: '#334155', lineHeight: 1.6 }}>
                <strong style={{ color: '#1A2B4A' }}>{ano}</strong> · {r.turmas[ano]?.n ?? 0} turmas · {y.enturmacoes} enturmações · {y.alunos} alunos
                {y.parcial && <span style={{ color: '#B45309' }}> (parcial: o tempo acabou)</span>}
                <div>{Object.entries(y.por_status).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${STATUS_LABEL[k] ?? k}: ${n}`).join(' · ') || '—'}</div>
                {y.turmas_de_outro_ano > 0 && <div style={{ color: '#B45309' }}>{y.turmas_de_outro_ano} enturmação(ões) de turmas de outro ano ficaram de fora.</div>}
                {y.erros.length > 0 && <div style={{ color: '#B91C1C' }}>{y.erros.join('; ')}</div>}
              </div>
            ))}
            {r.seguinte && !r.contagem.anos[r.seguinte] && (
              <div style={{ padding: '8px 10px', borderTop: '1px solid #F1F5F9', color: '#B45309' }}><strong>{r.seguinte}</strong> · não lido ({MODO_LABEL.nenhum}).</div>
            )}
          </div>
          {rm && (
            <p style={{ fontSize: 12, color: '#1A2B4A', margin: '8px 0', lineHeight: 1.6 }}>
              <strong>Rematrícula {rm.ano}</strong> (base {r.atual}: {rm.base} alunos cursando, concluídos ou em pré-matrícula):{' '}
              {rm.rematriculados} rematriculados (cursando em {rm.ano}) · {rm.pre_matriculados} pré-matriculados · {rm.a_rematricular} a rematricular ·{' '}
              {rm.sairam} saíram · {rm.novatos} novatos
            </p>
          )}
          <p style={{ ...small, marginTop: 4 }}>{r.contagem.chamadas} chamadas de leitura · {r.segundos} s · contagem por aluno (concluintes da última série ainda aparecem como "a rematricular").</p>
          <button onClick={() => setRaw(!raw)} style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
            {raw ? '▾' : '▸'} Tentativas de período (resultado cru, sem dados pessoais)
          </button>
          {raw && r.tentativas.map((t, i) => {
            const [lbl, color] = RESULT_LABEL[t.resultado] ?? [t.resultado, '#64748B']
            return (
              <div key={i} style={{ border: '1px solid #F1F5F9', borderRadius: 8, padding: '6px 10px', marginTop: 6, fontSize: 11, color: '#475569' }}>
                <div><strong>{t.forma === 'id' ? 'periodo como id' : t.forma === 'sigla' ? 'periodo como sigla' : 'por turma'}</strong>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{t.parametro}</span> → HTTP {t.http || '—'} · <span style={{ color, fontWeight: 700 }}>{lbl}</span>
                  {' '}· {t.itens} na 1ª página{t.total !== undefined ? ` de ${t.total}` : ''} · turmas: {t.turmas.seguinte} de {r.seguinte}, {t.turmas.atual} de {r.atual}, {t.turmas.outras} outras
                  {t.msg ? ` · ${t.msg}` : ''}</div>
                {t.cru.length > 0 && <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 10.5, color: '#64748B' }}>{JSON.stringify(t.cru, null, 1)}</pre>}
                {t.envelope && <div style={{ color: '#94A3B8' }}>envelope: {t.envelope.join(', ')}</div>}
              </div>
            )
          })}
          {raw && Object.entries(r.turmas).map(([ano, t]) => (
            <div key={ano} style={{ fontSize: 11, color: '#64748B', marginTop: 4, fontFamily: 'monospace' }}>
              lista_turmas periodo_sigla={ano} → HTTP {t.http || '—'} · {t.n} turmas · siglas: {Object.entries(t.siglas).map(([s, n]) => `${s} (${n})`).join(', ') || '—'}{t.msg ? ` · ${t.msg}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 3. Mapear (lê os dados, mostra unidades e séries) ──
function StepMap({ institutionId, run, namesAllowed, gradeLevels, onChanged, onReady }: {
  institutionId: string; run: Run | null; namesAllowed: boolean; gradeLevels: { id: string; name: string }[]
  onChanged: () => Promise<{ conn: Conn | null; run: Run | null }>; onReady: () => void
}) {
  const [includeNames, setIncludeNames] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<string>('')
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const stopRef = useRef(false)
  const reading = !!run && ['na_fila', 'rodando'].includes(run.status)
  const waiting = run?.status === 'aguardando_confirmacao'

  const loadMapping = useCallback(async (runId: string) => {
    const { data, error: e } = await supabase.rpc('base_erp_mapping', { p_institution_id: institutionId, p_run_id: runId })
    if (e) { setError(e.message); return }
    setMapping(data as Mapping)
  }, [institutionId])

  useEffect(() => { if (waiting && run) loadMapping(run.id) }, [waiting, run, loadMapping])

  // fila: chama a edge function até terminar (cada chamada avança ~40 s e para)
  const drive = async (runId: string) => {
    stopRef.current = false
    setBusy(true); setError('')
    try {
      for (let i = 0; i < 400 && !stopRef.current; i++) {
        const r = await invoke('step', institutionId, { run_id: runId })
        if (r?.status === 'erro') { setError(r.error || 'Erro na leitura'); break }
        const label = r?.position?.label
        setProgress(label ? `Lendo ${stepLabel(label)} (passo ${Math.min(r.position.index + 1, r.position.total)} de ${r.position.total}) · ${r.pages ?? 0} páginas` : '')
        if (r?.status !== 'rodando' && r?.status !== 'na_fila') break
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false); setProgress(''); await onChanged() }
  }

  const start = async () => {
    const { data, error: e } = await supabase.rpc('base_erp_start', { p_institution_id: institutionId, p_include_names: includeNames && namesAllowed })
    if (e) { setError(e.message); return }
    await onChanged()
    drive(data as string)
  }
  const cancel = async () => {
    if (!run) return
    stopRef.current = true
    await supabase.rpc('base_erp_cancel', { p_institution_id: institutionId, p_run_id: run.id })
    setMapping(null); await onChanged()
  }
  const toggleUnit = async (id: string) => {
    if (!mapping) return
    const cur = mapping.unidades.filter(u => u.incluida).map(u => u.id)
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    const all = next.length === mapping.unidades.length
    await supabase.rpc('base_erp_set_units', { p_institution_id: institutionId, p_unit_ids: all ? null : next })
    if (run) loadMapping(run.id)
  }
  const setGrade = async (s: Mapping['series'][number], gradeId: string) => {
    await supabase.rpc('base_erp_set_grade', {
      p_institution_id: institutionId, p_serie_key: s.serie_key,
      p_serie_label: [s.curso_nome, s.serie_nome].filter(Boolean).join(' / '), p_grade_level_id: gradeId || null,
    })
    if (run) loadMapping(run.id)
  }

  return (
    <div>
      {!reading && !waiting && (
        <>
          <p style={small}>
            Lê do Activesoft as unidades, cursos, turmas, enturmações e alunos (de 25 em 25; se a página fechar, continua de onde parou).
            Nada entra na base de alunos neste passo.
          </p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: namesAllowed ? '#475569' : '#94A3B8', marginBottom: 12 }}>
            <input type="checkbox" checked={includeNames} disabled={!namesAllowed} onChange={e => setIncludeNames(e.target.checked)} style={{ marginTop: 2 }} />
            <span><strong>Guardar nomes</strong> de alunos e responsáveis.{' '}
              {namesAllowed ? 'Desmarcado, só matrícula, série e situação são lidos.' : 'Disponível depois do aditivo de proteção de dados (LGPD) assinado e registrado pela Áion.'}</span>
          </label>
          <button onClick={start} style={btn}><PlayCircle size={14} /> {run?.status === 'ok' || run?.status === 'ok_com_avisos' ? 'Ler de novo' : 'Ler dados do Activesoft'}</button>
        </>
      )}
      {(reading || busy) && (
        <div>
          <p style={{ ...small, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Loader2 size={14} className="animate-spin" /> {progress || 'Lendo…'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {!busy && run && <button onClick={() => drive(run.id)} style={btn}><PlayCircle size={14} /> Continuar leitura</button>}
            <button onClick={cancel} style={btnSec}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p style={{ ...small, color: '#B91C1C' }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {error}</p>}
      {run?.status === 'erro' && !error && <p style={{ ...small, color: '#B91C1C' }}>A última leitura parou com erro: {run.error}</p>}

      {waiting && mapping && (
        <div>
          <p style={small}>
            Lido: {mapping.unidades.length} unidade(s), {mapping.cursos} curso(s), {mapping.turmas} turma(s), {mapping.alunos} aluno(s).
            Anos: {Object.entries(mapping.anos).map(([a, n]) => `${a} (${n})`).join(', ') || '—'}.
          </p>
          {mapping.unidades.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>Unidades que entram</p>
              {mapping.unidades.map(u => (
                <label key={u.id} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#1A2B4A', marginBottom: 4 }}>
                  <input type="checkbox" checked={u.incluida} onChange={() => toggleUnit(u.id)} /> {u.nome || u.id}
                  <span style={{ color: '#94A3B8' }}>({u.enturmacoes} enturmações)</span>
                </label>
              ))}
            </div>
          )}
          <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>Séries do Activesoft → séries da escola</p>
          <div style={{ border: '1px solid #F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
            {mapping.series.map(s => (
              <div key={s.serie_key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 10px', borderTop: '1px solid #F1F5F9', fontSize: 13 }}>
                <span style={{ flex: 1, color: '#1A2B4A' }}>{[s.curso_nome, s.serie_nome].filter(Boolean).join(' / ') || s.serie_key}
                  <span style={{ color: '#94A3B8' }}> · {s.enturmacoes}</span></span>
                <select value={s.grade_level_id ?? ''} onChange={e => setGrade(s, e.target.value)}
                  style={{ ...input, padding: '5px 8px', borderColor: s.grade_level_id ? '#E2E8F0' : '#FCD34D' }}>
                  <option value="">{s.grade_level_id ? '(automático)' : 'Fica de fora'}</option>
                  {gradeLevels.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <span style={{ fontSize: 11, color: '#94A3B8', width: 70 }}>{s.como === 'escolhida' ? 'escolhida' : s.como === 'automatica' ? 'automática' : ''}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={onReady} style={btn}>Mapeamento conferido → contar</button>
            <button onClick={cancel} style={btnSec}>Descartar leitura</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 4. Carga: contar, conferir, gravar ──
function StepLoad({ institutionId, run, onChanged, onToast }: { institutionId: string; run: Run | null; onChanged: () => void; onToast: Toast }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [busy, setBusy] = useState<'' | 'contando' | 'gravando'>('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const waiting = run?.status === 'aguardando_confirmacao'

  const count = async () => {
    if (!run) return
    setBusy('contando'); setError(''); setConfirmed(false)
    const { data, error: e } = await supabase.rpc('base_erp_preview', { p_institution_id: institutionId, p_run_id: run.id })
    setBusy('')
    if (e) { setError(e.message); return }
    setSummary(data as Summary)
  }
  const apply = async () => {
    if (!run || !confirmed) return
    setBusy('gravando')
    const { data, error: e } = await supabase.rpc('base_erp_apply', { p_institution_id: institutionId, p_run_id: run.id })
    setBusy('')
    if (e) { setError(e.message); return }
    setSummary({ ...(data as Summary), previa: false })
    onToast('Carga do Activesoft gravada.')
    onChanged()
  }

  if (!waiting && !summary) {
    return <p style={small}>{run?.status === 'ok' || run?.status === 'ok_com_avisos'
      ? 'Última carga gravada. Para atualizar, leia os dados de novo no passo 3.'
      : 'Primeiro leia e confira o mapeamento no passo 3.'}</p>
  }
  const c = (summary?.cruzamento ?? []).filter(x => x.base_ano_anterior > 0 || x.novatos > 0)
  const unk = Object.entries(summary?.series_nao_reconhecidas ?? {})
  const unkSit = Object.entries(summary?.situacoes_nao_reconhecidas ?? {})
  return (
    <div>
      {run?.kind === 'dry_run_contagem' && waiting && (
        <p style={small}>Primeira carga: ela só conta. Nada é gravado até você conferir e confirmar.</p>
      )}
      {run && (waiting || summary) && run.counts?.alunos_lidos !== undefined && (
        <p style={{ ...small, color: '#334155' }}>
          {run.counts.responsaveis_lidos === true
            ? <>Famílias: <strong>{String(run.counts.alunos_com_responsavel ?? 0)}</strong> aluno(s) com responsável ligado e{' '}
                <strong>{String(run.counts.alunos_sem_responsavel ?? 0)}</strong> sem responsável (de {String(run.counts.alunos_lidos)} lidos).</>
            : <>Famílias: responsáveis não lidos nesta carga (nomes não liberados ou "Guardar nomes" desmarcada). {String(run.counts.alunos_lidos)} aluno(s) lidos.</>}
        </p>
      )}
      {waiting && !summary && (
        <button onClick={count} disabled={!!busy} style={busy ? off(btn) : btn}>
          {busy === 'contando' ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} Contar (não grava)
        </button>
      )}
      {error && <p style={{ ...small, color: '#B91C1C' }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {error}</p>}
      {summary && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>
            {summary.previa === false ? 'Gravado' : 'Contagem (nada gravado ainda)'} — {summary.linhas_lidas} enturmações ·{' '}
            {summary.cruzados_pela_matricula} alunos já existentes encontrados pela matrícula · {summary.alunos_novos_na_base} alunos novos na base ·{' '}
            {summary.atualizados} atualizações · {summary.sem_mudanca} sem mudança
          </p>
          {c.map(x => (
            <p key={x.target_year} style={{ fontSize: 12, color: '#475569', margin: '0 0 6px' }}>
              Rematrícula {x.target_year}: {x.rematriculados} rematriculados · {x.a_rematricular} a rematricular · {x.sairam} saíram ·{' '}
              {x.novatos} novatos · {x.concluintes} concluintes (base {x.target_year - 1}: {x.base_ano_anterior})
            </p>
          ))}
          {(summary.divergencias > 0 || unk.length > 0 || unkSit.length > 0) && (
            <div style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', margin: '8px 0', lineHeight: 1.6 }}>
              {summary.divergencias > 0 && (
                <div><strong>{summary.divergencias} divergência(s) com a planilha</strong> (vale o Activesoft; é só aviso):{' '}
                  {summary.divergencias_amostra.slice(0, 8).map(d => `matrícula ${d.matricula} (${d.ano}): ${d.antes} → ${d.agora}`).join('; ')}
                  {summary.divergencias > 8 && '…'}</div>
              )}
              {unk.length > 0 && <div><strong>Séries fora</strong> (sem série da escola): {unk.map(([k, n]) => `${k} (${n})`).join(', ')}. Ajuste no passo 3.</div>}
              {unkSit.length > 0 && <div><strong>Situações não reconhecidas</strong>: {unkSit.map(([k, n]) => `${k} (${n})`).join(', ')}.</div>}
            </div>
          )}
          {summary.previa !== false && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1A2B4A' }}>
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                Conferi a contagem com o Activesoft e quero gravar.
              </label>
              <div>
                <button onClick={apply} disabled={!confirmed || !!busy} style={!confirmed || busy ? off(btn) : btn}>
                  {busy === 'gravando' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Gravar carga
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
