import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  X, Plus, Trash2, ChevronUp, ChevronDown, MessageSquare, ListOrdered, HelpCircle, GitBranch, UserRound,
  Tag, Timer, StopCircle, CornerDownRight, Image as ImageIcon, Loader2, Check, AlertTriangle, Play, RotateCcw, Sparkles, LayoutGrid,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { BRAND, GRAD as BRAND_GRAD } from '../../../lib/brand'
import {
  type Step, type StepType, genId, graphToSteps, stepsToGraph, mapSteps, removeStep, insertStep, moveStep,
  allSteps, validate, branchKeys, BRANCHING, TERMINAL, TEMPLATES,
} from './flowModel'

// Editor do robô em passos. Salva no mesmo formato que o webhook executa
// (whatsapp_flows.bot_flow), então funciona igual no WhatsApp oficial e no
// não oficial. O editor de caixinhas antigo continua abrindo o mesmo fluxo.

const C = { ink: BRAND.ink, muted: BRAND.muted, line: BRAND.line, bg: BRAND.bg, primary: BRAND.primary, mid: BRAND.primaryDark, blue: BRAND.primary, soft: BRAND.soft }
const GRAD = BRAND_GRAD

const META: Record<StepType, { label: string; icon: typeof MessageSquare; color: string; hint: string }> = {
  message:    { label: 'Mensagem',            icon: MessageSquare,    color: '#05907B', hint: 'Texto, imagem, vídeo, documento, áudio ou contato.' },
  media:      { label: 'Mídia',               icon: ImageIcon,        color: '#05907B', hint: 'Arquivo (formato antigo).' },
  question:   { label: 'Pergunta',            icon: HelpCircle,       color: '#7C3AED', hint: 'Pergunta e guarda a resposta (ex.: nome).' },
  menu:       { label: 'Menu de opções',      icon: ListOrdered,      color: '#D97706', hint: 'Opções numeradas; cada uma abre um caminho.' },
  condition:  { label: 'Condição (se…)',      icon: GitBranch,        color: '#DC2626', hint: 'Dentro do horário, palavra-chave, etiqueta…' },
  action:     { label: 'Ação',                icon: Tag,              color: '#DB2777', hint: 'Etiqueta, cliente no CRM, encerrar.' },
  lead:       { label: 'Cliente no CRM',      icon: Tag,              color: '#65A30D', hint: 'Cria ou atualiza o cliente.' },
  transfer:   { label: 'Passar para a equipe', icon: UserRound,       color: '#0E7490', hint: 'Uma pessoa, um setor (revezando) ou a fila.' },
  distribute: { label: 'Distribuir',          icon: UserRound,        color: '#EA580C', hint: 'Revezamento (formato antigo).' },
  wait:       { label: 'Aguardar',            icon: Timer,            color: '#64748B', hint: 'Pausa curta entre mensagens.' },
  end:        { label: 'Encerrar',            icon: StopCircle,       color: '#334155', hint: 'Fecha a conversa (e envia a avaliação, se ligada).' },
  goto:       { label: 'Ir para',             icon: CornerDownRight,  color: '#475569', hint: 'Volta para outro passo (ex.: menu principal).' },
}
// O robô do WhatsApp da Áion (simples) só executa: mensagem de texto, menu, passar para a equipe e encerrar.
// O das escolas executa também pergunta, condição, ação e espera. Oferecer só o que de fato roda evita
// um passo que o robô pularia calado.
const ADDABLE_SIMPLE: StepType[] = ['message', 'menu', 'transfer', 'end', 'goto']
const ADDABLE_FULL: StepType[] = ['message', 'question', 'menu', 'condition', 'transfer', 'action', 'wait', 'end', 'goto']
export type RobotOwner = 'institution' | 'platform'

const COND_TYPES = [
  { id: 'business_hours', label: 'Está dentro do horário de atendimento' },
  { id: 'lunch_break', label: 'Está no horário de almoço' },
  { id: 'keyword', label: 'A mensagem contém a palavra…' },
  { id: 'first_message', label: 'É a primeira mensagem do cliente' },
  { id: 'has_tag', label: 'A conversa tem a etiqueta…' },
]
const ACTION_TYPES = [
  { id: 'upsert_lead', label: 'Criar/atualizar cliente no CRM' },
  { id: 'add_conversation_tag', label: 'Pôr etiqueta na conversa' },
  { id: 'remove_conversation_tag', label: 'Tirar etiqueta da conversa' },
  { id: 'add_tag', label: 'Pôr etiqueta no cliente (CRM)' },
  { id: 'close_conversation', label: 'Encerrar a conversa' },
]
const VARS = ['{{nome}}', '{{empresa}}', '{horario}']

const input = { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: C.ink, background: '#fff' }
const lbl = { fontSize: 12, fontWeight: 700 as const, color: '#334155', display: 'block', marginBottom: 5 }

async function uploadMedia(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `flow-media/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('whatsapp-media').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('whatsapp-media').getPublicUrl(path).data.publicUrl
}

function summary(s: Step, people: Map<string, string>, groups: Map<string, string>, simple = false): string {
  const d = s.data || {}
  switch (s.type) {
    case 'message': return d.mediaType && d.mediaType !== 'text' ? `${({ image: 'Imagem', video: 'Vídeo', document: 'Documento', audio: 'Áudio', contact: 'Contato' } as Record<string, string>)[d.mediaType] || 'Arquivo'}${d.caption ? ` — ${d.caption}` : ''}` : (d.text || 'Mensagem vazia')
    case 'question': return `${d.text || 'Pergunta vazia'}${d.variable ? `  → guarda em {{${d.variable}}}` : ''}`
    case 'menu': return `${d.menuText || d.text || 'Menu'} · ${(d.options || []).length} opções`
    case 'condition': return (d.conditions || []).map((c: any) => COND_TYPES.find(t => t.id === c.conditionType)?.label + (c.keyword ? ` "${c.keyword}"` : '') + (c.tag ? ` "${c.tag}"` : '')).join(' / ') || 'Condição'
    case 'transfer': {
      if (simple) return d.message ? `Equipe assume a conversa — “${d.message}”` : 'Equipe assume a conversa'
      const t = d.transferType || 'attendant'
      return t === 'group' ? `Setor: ${groups.get(d.group_id) || '—'}` : t === 'general' ? 'Fila geral da equipe' : `Pessoa: ${people.get(d.assignee_id || d.assigneeId) || '—'}`
    }
    case 'action': return (d.actions || []).map((a: any) => ACTION_TYPES.find(t => t.id === a.actionType)?.label + (a.tag ? ` "${a.tag}"` : '')).join(' · ') || 'Ação'
    case 'wait': return `${d.seconds || 0} segundos`
    case 'end': return d.message || 'Encerra a conversa'
    case 'goto': return 'Volta para outro passo'
    default: return META[s.type]?.label || s.type
  }
}

// ── Editor de um passo ─────────────────────────────────────────────────────
function StepForm({ step, onChange, people, groups, tags, targets, simple }: {
  step: Step; onChange: (d: Record<string, any>) => void
  people: { id: string; full_name: string }[]; groups: { id: string; name: string }[]; tags: { id: string; name: string }[]
  targets: { id: string; label: string }[]; simple: boolean
}) {
  const d = step.data || {}
  const set = (patch: Record<string, any>) => onChange({ ...d, ...patch })
  const [uploading, setUploading] = useState(false)
  const insertVar = (field: string, v: string) => set({ [field]: `${d[field] || ''}${d[field] ? ' ' : ''}${v}` })
  const VarChips = ({ field }: { field: string }) => simple ? null : (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {VARS.map(v => <button key={v} type="button" onClick={() => insertVar(field, v)} style={{ fontSize: 12, color: C.primary, background: C.soft, border: 'none', borderRadius: 999, padding: '3px 9px', cursor: 'pointer' }}>+ {v}</button>)}
    </div>
  )

  if (step.type === 'message' || step.type === 'media') {
    const mt = d.mediaType || 'text'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(simple ? [['text', 'Texto']] : [['text', 'Texto'], ['image', 'Imagem'], ['video', 'Vídeo'], ['document', 'Documento'], ['audio', 'Áudio'], ['contact', 'Contato']]).map(([id, l]) => (
            <button key={id} type="button" onClick={() => set({ mediaType: id })}
              style={{ fontSize: 13, fontWeight: 600, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', border: mt === id ? `2px solid ${C.primary}` : `1px solid ${C.line}`, background: mt === id ? C.soft : '#fff', color: mt === id ? C.primary : C.ink }}>{l}</button>
          ))}
        </div>
        {mt === 'text' && <label><span style={lbl}>Texto</span><textarea rows={4} style={{ ...input, resize: 'vertical' }} value={d.text || ''} onChange={e => set({ text: e.target.value })} /><VarChips field="text" /></label>}
        {['image', 'video', 'document', 'audio'].includes(mt) && (
          <>
            <label style={{ ...input, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderStyle: 'dashed', cursor: 'pointer', color: C.primary, fontWeight: 600 }}>
              {uploading ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : d.mediaUrl ? 'Trocar arquivo' : 'Escolher arquivo'}
              <input type="file" style={{ display: 'none' }} accept={{ image: 'image/*', video: 'video/*', audio: 'audio/*', document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx' }[mt as 'image']}
                onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { set({ mediaUrl: await uploadMedia(f), ...(mt === 'document' ? { filename: f.name } : {}) }) } catch (err) { alert(`Falha no envio: ${(err as Error).message}`) } setUploading(false) }} />
            </label>
            {d.mediaUrl && <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {d.filename || d.mediaUrl.split('/').pop()}</div>}
            {mt !== 'audio' && <label><span style={lbl}>Legenda (opcional)</span><input style={input} value={d.caption || ''} onChange={e => set({ caption: e.target.value })} /></label>}
          </>
        )}
        {mt === 'contact' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label><span style={lbl}>Nome</span><input style={input} value={d.contactName || ''} onChange={e => set({ contactName: e.target.value })} /></label>
            <label><span style={lbl}>Telefone</span><input style={input} value={d.contactPhone || ''} placeholder="(83) 99999-9999" onChange={e => set({ contactPhone: e.target.value })} /></label>
            <label><span style={lbl}>Empresa (opcional)</span><input style={input} value={d.contactCompany || ''} onChange={e => set({ contactCompany: e.target.value })} /></label>
          </div>
        )}
      </div>
    )
  }
  if (step.type === 'question') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label><span style={lbl}>Pergunta</span><textarea rows={2} style={{ ...input, resize: 'vertical' }} value={d.text || ''} onChange={e => set({ text: e.target.value })} /><VarChips field="text" /></label>
      <label><span style={lbl}>Guardar a resposta como</span>
        <input style={input} value={d.variable || ''} placeholder="nome, email, cpf…" onChange={e => set({ variable: e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() })} /></label>
      <div style={{ fontSize: 12, color: C.muted }}>Depois use <strong>{`{{${d.variable || 'nome'}}}`}</strong> nas próximas mensagens.</div>
    </div>
  )
  if (step.type === 'menu') {
    const opts: any[] = d.options || []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label><span style={lbl}>Texto do menu</span><textarea rows={2} style={{ ...input, resize: 'vertical' }} value={d.menuText ?? d.text ?? ''} onChange={e => set({ menuText: e.target.value })} /></label>
        <span style={lbl}>Opções</span>
        {opts.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 26, textAlign: 'center', fontWeight: 800, color: '#D97706' }}>{i + 1}</span>
            <input style={{ ...input, borderColor: (o.text || '').length > 20 ? '#FCA5A5' : C.line }} value={o.text || ''} onChange={e => set({ options: opts.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} />
            <span style={{ fontSize: 11, width: 34, textAlign: 'right', color: (o.text || '').length > 20 ? '#DC2626' : C.muted }}>{(o.text || '').length}/20</span>
            <button type="button" aria-label="Remover opção" disabled={opts.length <= 1} onClick={() => set({ options: opts.filter((_, j) => j !== i), __removedOption: i })}
              style={{ border: `1px solid ${C.line}`, background: '#fff', borderRadius: 8, padding: 7, cursor: 'pointer', color: '#DC2626', opacity: opts.length <= 1 ? 0.4 : 1 }}><Trash2 size={14} /></button>
          </div>
        ))}
        {opts.length < 10 && <button type="button" onClick={() => set({ options: [...opts, { text: `Opção ${opts.length + 1}` }] })}
          style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>+ Adicionar opção</button>}
        <div style={{ fontSize: 12, color: C.muted }}>Vai como botões no WhatsApp. Cada opção aceita até 20 letras. A pessoa também pode responder com o número da opção.</div>
      </div>
    )
  }
  if (step.type === 'condition') {
    const conds: any[] = d.conditions?.length ? d.conditions : [{ conditionType: d.conditionType || 'business_hours', operator: 'AND' }]
    const setC = (i: number, patch: any) => set({ conditions: conds.map((c, j) => j === i ? { ...c, ...patch } : c) })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {conds.map((c, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {i > 0 && (
              <select style={{ ...input, width: 'auto', alignSelf: 'flex-start' }} value={conds[i - 1].operator || 'AND'} onChange={e => setC(i - 1, { operator: e.target.value })}>
                <option value="AND">e também</option><option value="OR">ou</option>
              </select>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <select style={input} value={c.conditionType} onChange={e => setC(i, { conditionType: e.target.value })}>
                {COND_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {conds.length > 1 && <button type="button" aria-label="Remover" onClick={() => set({ conditions: conds.filter((_, j) => j !== i) })} style={{ border: `1px solid ${C.line}`, background: '#fff', borderRadius: 8, padding: 7, color: '#DC2626', cursor: 'pointer' }}><Trash2 size={14} /></button>}
            </div>
            {c.conditionType === 'keyword' && <input style={input} placeholder="Palavra" value={c.keyword || ''} onChange={e => setC(i, { keyword: e.target.value })} />}
            {c.conditionType === 'has_tag' && (
              <select style={input} value={c.tag || ''} onChange={e => setC(i, { tag: e.target.value, tagScope: 'both' })}>
                <option value="">Escolha a etiqueta</option>{tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            )}
          </div>
        ))}
        <button type="button" onClick={() => set({ conditions: [...conds, { conditionType: 'keyword', operator: 'AND' }] })}
          style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>+ Outra condição</button>
      </div>
    )
  }
  if ((step.type === 'transfer' || step.type === 'distribute') && simple) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label><span style={lbl}>Mensagem ao passar para a equipe (opcional)</span><input style={input} value={d.message || ''} onChange={e => set({ message: e.target.value })} /></label>
      <div style={{ fontSize: 12, color: C.muted }}>O robô para de responder e a conversa aparece para a equipe da Áion no Inbox.</div>
    </div>
  )
  if (step.type === 'transfer' || step.type === 'distribute') {
    const t = d.transferType || (step.type === 'distribute' ? 'group' : 'attendant')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['attendant', 'Uma pessoa'], ['group', 'Um setor (revezando)'], ['general', 'Fila geral']].map(([id, l]) => (
            <button key={id} type="button" onClick={() => set({ transferType: id })}
              style={{ fontSize: 13, fontWeight: 600, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', border: t === id ? `2px solid ${C.primary}` : `1px solid ${C.line}`, background: t === id ? C.soft : '#fff', color: t === id ? C.primary : C.ink }}>{l}</button>
          ))}
        </div>
        {t === 'attendant' && <select style={input} value={d.assignee_id || d.assigneeId || ''} onChange={e => set({ assignee_id: e.target.value, assigneeId: e.target.value })}>
          <option value="">Escolha a pessoa</option>{people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>}
        {t === 'group' && <select style={input} value={d.group_id || ''} onChange={e => set({ group_id: e.target.value })}>
          <option value="">Escolha o setor</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
        <label><span style={lbl}>Mensagem ao transferir (opcional)</span><input style={input} value={d.message || ''} onChange={e => set({ message: e.target.value })} /></label>
        <div style={{ fontSize: 12, color: C.muted }}>Fora do horário, a conversa fica na fila e a mensagem de fora do horário é enviada.</div>
      </div>
    )
  }
  if (step.type === 'action' || step.type === 'lead') {
    const acts: any[] = d.actions?.length ? d.actions : [{ actionType: d.actionType || 'upsert_lead' }]
    const setA = (i: number, patch: any) => set({ actions: acts.map((a, j) => j === i ? { ...a, ...patch } : a) })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {acts.map((a, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <select style={input} value={a.actionType} onChange={e => setA(i, { actionType: e.target.value })}>
                {ACTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {acts.length > 1 && <button type="button" aria-label="Remover" onClick={() => set({ actions: acts.filter((_, j) => j !== i) })} style={{ border: `1px solid ${C.line}`, background: '#fff', borderRadius: 8, padding: 7, color: '#DC2626', cursor: 'pointer' }}><Trash2 size={14} /></button>}
            </div>
            {['add_conversation_tag', 'remove_conversation_tag', 'add_tag'].includes(a.actionType) && (
              <select style={input} value={a.tag || ''} onChange={e => setA(i, { tag: e.target.value })}>
                <option value="">Escolha a etiqueta</option>{tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            )}
          </div>
        ))}
        <button type="button" onClick={() => set({ actions: [...acts, { actionType: 'add_conversation_tag' }] })}
          style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>+ Outra ação</button>
      </div>
    )
  }
  if (step.type === 'wait') return (
    <label><span style={lbl}>Segundos (até 15)</span><input type="number" min={1} max={15} style={{ ...input, width: 120 }} value={d.seconds || 3} onChange={e => set({ seconds: Math.min(15, Math.max(1, Number(e.target.value) || 1)) })} /></label>
  )
  if (step.type === 'end') return (
    <label><span style={lbl}>Mensagem de despedida (opcional)</span><input style={input} value={d.message || ''} onChange={e => set({ message: e.target.value })} /></label>
  )
  if (step.type === 'goto') return (
    <select style={input} value={d.target || ''} onChange={e => set({ target: e.target.value })}>
      <option value="">Escolha o passo</option>{targets.filter(t => t.id !== step.id).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
    </select>
  )
  return null
}

// ── Simulador (prévia do celular) ─────────────────────────────────────────
interface Bubble { from: 'bot' | 'me' | 'sys'; text: string }
function useSimulator(steps: Step[], company: string, horario: string) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [wait, setWait] = useState<{ kind: 'menu' | 'question' | 'condition'; step: Step } | null>(null)
  const vars = useRef<Record<string, string>>({})
  const byId = useMemo(() => new Map(allSteps(steps).map(s => [s.id, s])), [steps])
  // localiza a lista e a posição de um passo
  const locate = (id: string): { list: Step[]; idx: number } | null => {
    const find = (list: Step[]): { list: Step[]; idx: number } | null => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return { list, idx: i }
        for (const b of Object.values(list[i].branches || {})) { const r = find(b); if (r) return r }
      }
      return null
    }
    return find(steps)
  }
  const fill = (t: string) => String(t || '').replace(/\{\{(\w+)\}\}/g, (_, k) => k === 'empresa' ? company : (vars.current[k] ?? (k === 'nome' ? 'Ana' : `{{${k}}}`))).replace(/\{\s*hor[aá]rios?\s*\}/gi, horario)

  const run = (list: Step[], idx: number, acc: Bubble[], guard = 0) => {
    for (let i = idx; i < list.length && guard < 60; i++, guard++) {
      const s = list[i]; const d = s.data || {}
      if (s.type === 'message' || s.type === 'media') acc.push({ from: 'bot', text: d.mediaType && d.mediaType !== 'text' ? `📎 ${d.mediaType === 'contact' ? `Contato: ${d.contactName || ''}` : (d.caption || d.filename || 'arquivo')}` : fill(d.text) })
      else if (s.type === 'wait') acc.push({ from: 'sys', text: `aguarda ${d.seconds || 0}s` })
      else if (s.type === 'action' || s.type === 'lead') acc.push({ from: 'sys', text: `⚙ ${summary(s, new Map(), new Map())}` })
      else if (s.type === 'transfer' || s.type === 'distribute') { if (d.message) acc.push({ from: 'bot', text: fill(d.message) }); acc.push({ from: 'sys', text: '→ Conversa passa para a equipe' }) }
      else if (s.type === 'end') { if (d.message) acc.push({ from: 'bot', text: fill(d.message) }); acc.push({ from: 'sys', text: '■ Conversa encerrada' }); setBubbles([...acc]); setWait(null); return }
      else if (s.type === 'goto') { const loc = locate(d.target); if (loc) return run(loc.list, loc.idx, acc, guard + 1); break }
      else if (s.type === 'question') { acc.push({ from: 'bot', text: fill(d.text) }); setBubbles([...acc]); setWait({ kind: 'question', step: s }); return }
      else if (s.type === 'menu') {
        acc.push({ from: 'bot', text: `${fill(d.menuText || d.text || '')}\n\n${(d.options || []).map((o: any, j: number) => `*${j + 1}.* ${o.text}`).join('\n')}` })
        setBubbles([...acc]); setWait({ kind: 'menu', step: s }); return
      }
      else if (s.type === 'condition') { setBubbles([...acc]); setWait({ kind: 'condition', step: s }); return }
    }
    acc.push({ from: 'sys', text: '… fim deste caminho (o robô aguarda o cliente)' })
    setBubbles([...acc]); setWait(null)
  }
  const start = () => { vars.current = {}; run(steps, 0, [{ from: 'me', text: 'Oi!' }]) }
  const answer = (text: string, branch?: string) => {
    if (!wait) return
    const acc = [...bubbles, ...(wait.kind === 'condition' ? [{ from: 'sys' as const, text: branch === 'yes' ? '✔ condição verdadeira' : '✘ condição falsa' }] : [{ from: 'me' as const, text }])]
    const s = wait.step
    if (wait.kind === 'question') {
      if (s.data.variable) vars.current[s.data.variable] = text
      const loc = locate(s.id); if (loc) run(loc.list, loc.idx + 1, acc)
    } else run(s.branches?.[branch!] || [], 0, acc)
  }
  useEffect(() => { start() }, [steps]) // eslint-disable-line react-hooks/exhaustive-deps
  return { bubbles, wait, answer, restart: start, byId }
}

// ── Componente principal ─────────────────────────────────────────────────
// ownerId: escola (institutions.id) ou, para o robô da Áion, platform_whatsapp.id.
export default function RobotEditor({ ownerId, ownerType = 'institution', onClose, onOpenCanvas }: { ownerId: string; ownerType?: RobotOwner; onClose: () => void; onOpenCanvas?: () => void }) {
  const simple = ownerType === 'platform'
  const ownerColumn = simple ? 'platform_whatsapp_id' : 'institution_id'
  const ADDABLE = simple ? ADDABLE_SIMPLE : ADDABLE_FULL
  const [steps, setSteps] = useState<Step[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ path: string; index: number } | null>(null)
  const [people, setPeople] = useState<{ id: string; full_name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])
  const [company, setCompany] = useState(simple ? 'Áion Edu' : 'sua escola')
  const [horario, setHorario] = useState('seg a sex, 8h às 18h')
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(() => window.innerWidth >= 1000)
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1000)

  useEffect(() => { const h = () => setNarrow(window.innerWidth < 1000); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])

  useEffect(() => {
    ;(async () => {
      const [{ data: fl }, us, gr, tg, co] = await Promise.all([
        supabase.from('whatsapp_flows').select('bot_flow, bot_enabled, working_start, working_end').eq(ownerColumn, ownerId).maybeSingle(),
        simple ? Promise.resolve({ data: [] }) : supabase.from('users').select('id, full_name').eq('institution_id', ownerId),
        simple ? Promise.resolve({ data: [] }) : supabase.from('whatsapp_groups').select('id, name').eq('institution_id', ownerId),
        simple ? Promise.resolve({ data: [] }) : supabase.from('whatsapp_tags').select('id, name').eq('institution_id', ownerId).order('name'),
        simple ? Promise.resolve({ data: null }) : supabase.from('institutions').select('name').eq('id', ownerId).maybeSingle(),
      ])
      setSteps(graphToSteps((fl as any)?.bot_flow))
      setEnabled(!!(fl as any)?.bot_enabled)
      if ((fl as any)?.working_start) setHorario(`${String((fl as any).working_start).slice(0, 5)} às ${String((fl as any).working_end || '').slice(0, 5)}`)
      setPeople((us.data || []) as any); setGroups((gr.data || []) as any); setTags((tg.data || []) as any)
      if ((co.data as any)?.name) setCompany((co.data as any).name)
      setLoading(false)
    })()
  }, [ownerId, ownerColumn, simple])

  const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p.full_name])), [people])
  const groupMap = useMemo(() => new Map(groups.map(g => [g.id, g.name])), [groups])
  const problems = useMemo(() => validate(steps, simple), [steps, simple])
  const problemIds = useMemo(() => new Set(problems.map(p => p.stepId)), [problems])
  const sim = useSimulator(steps, company, horario)
  const targets = useMemo(() => allSteps(steps).filter(s => s.type !== 'goto').map((s, i) => ({ id: s.id, label: `${i + 1}. ${META[s.type].label} — ${summary(s, peopleMap, groupMap, simple).slice(0, 40)}` })), [steps, peopleMap, groupMap])

  const change = (fn: (l: Step[]) => Step[]) => { setSteps(fn); setDirty(true) }
  const updateStep = (id: string, data: Record<string, any>) => change(l => mapSteps(l, s => {
    if (s.id !== id) return s
    const n: Step = { ...s, data: { ...data } }
    // menu: mantém um caminho por opção (removida → caminho sai junto)
    if (s.type === 'menu') {
      const removed = data.__removedOption as number | undefined
      delete n.data.__removedOption
      const old = s.branches || {}
      const b: Record<string, Step[]> = {}
      const len = (data.options || []).length
      for (let i = 0, j = 0; i < len; i++, j++) { if (removed !== undefined && j === removed) j++; b[`opt-${i}`] = old[`opt-${j}`] || [] }
      n.branches = b
    }
    return n
  }))
  const add = (type: StepType) => {
    if (!adding) return
    const s: Step = { id: genId(), type, data: {} }
    if (type === 'message') s.data = { mediaType: 'text', text: '' }
    if (type === 'menu') { s.data = { menuText: 'Escolha uma opção:', options: [{ text: 'Opção 1' }, { text: 'Opção 2' }] }; s.branches = { 'opt-0': [], 'opt-1': [] } }
    if (type === 'condition') { s.data = { conditions: [{ conditionType: 'business_hours', operator: 'AND' }] }; s.branches = { yes: [], no: [] } }
    if (type === 'transfer') s.data = { transferType: 'general' }
    if (type === 'action') s.data = { actions: [{ actionType: 'add_conversation_tag' }] }
    if (type === 'wait') s.data = { seconds: 3 }
    change(l => insertStep(l, adding.path, adding.index, s))
    setAdding(null); setOpenId(s.id)
  }

  const save = async () => {
    setSaving(true); setError(null)
    const graph = stepsToGraph(steps)
    const { data: existing } = await supabase.from('whatsapp_flows').select('id').eq(ownerColumn, ownerId).maybeSingle()
    const { error: err } = existing
      ? await supabase.from('whatsapp_flows').update({ bot_flow: graph, bot_enabled: enabled, ...(simple ? { is_active: enabled } : {}) }).eq(ownerColumn, ownerId)
      : await supabase.from('whatsapp_flows').insert({ [ownerColumn]: ownerId, bot_flow: graph, bot_enabled: enabled, is_active: true })
    setSaving(false)
    if (err) { setError(`Não foi possível salvar: ${err.message}`); return }
    setDirty(false); setSavedAt(Date.now())
  }
  const close = () => { if (dirty && !window.confirm('Sair sem salvar as mudanças?')) return; onClose() }

  // ── render da lista ──
  const AddButton = ({ path, index }: { path: string; index: number }) => {
    const open = adding?.path === path && adding.index === index
    return (
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
        <button type="button" onClick={() => setAdding(open ? null : { path, index })} aria-label="Adicionar passo"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: C.primary, background: open ? C.soft : '#fff', border: `1px dashed ${open ? C.primary : '#B8C6D6'}`, borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
          <Plus size={13} /> passo
        </button>
        {open && (
          <div className="aion-pop" style={{ position: 'absolute', top: 30, zIndex: 20, width: 300, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 16px 40px rgba(11,27,52,.16)', padding: 6 }}>
            {ADDABLE.map(t => { const M = META[t]; const Icon = M.icon; return (
              <button key={t} type="button" onClick={() => add(t)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Icon size={16} color={M.color} style={{ marginTop: 2, flexShrink: 0 }} />
                <span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: C.ink }}>{M.label}</span><span style={{ fontSize: 12, color: C.muted }}>{M.hint}</span></span>
              </button>) })}
          </div>
        )}
      </div>
    )
  }

  const renderList = (list: Step[], path: string, depth: number): ReactElement => {
    const last = list[list.length - 1]
    const closed = last && (BRANCHING.includes(last.type) || TERMINAL.includes(last.type))
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <AddButton path={path} index={0} />
        {list.map((s, i) => {
          const M = META[s.type] || META.message
          const Icon = M.icon
          const open = openId === s.id
          const bad = problemIds.has(s.id)
          return (
            <div key={s.id}>
              <div className="aion-pop" style={{ background: '#fff', border: `1px solid ${bad ? '#FCA5A5' : open ? BRAND.softLine : C.line}`, borderRadius: 14, boxShadow: open ? '0 8px 24px rgba(11,27,52,.08)' : 'none' }}>
                <div onClick={() => setOpenId(open ? null : s.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', cursor: 'pointer' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${M.color}18`, color: M.color }}><Icon size={16} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: M.color, textTransform: 'uppercase', letterSpacing: '.03em' }}>{M.label}</div>
                    <div style={{ fontSize: 13.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{summary(s, peopleMap, groupMap, simple)}</div>
                  </div>
                  {bad && <AlertTriangle size={16} color="#DC2626" />}
                  <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                    <button type="button" aria-label="Subir" onClick={() => change(l => moveStep(l, s.id, -1))} disabled={i === 0} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.muted, opacity: i === 0 ? 0.3 : 1, padding: 4 }}><ChevronUp size={15} /></button>
                    <button type="button" aria-label="Descer" onClick={() => change(l => moveStep(l, s.id, 1))} disabled={i === list.length - 1} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.muted, opacity: i === list.length - 1 ? 0.3 : 1, padding: 4 }}><ChevronDown size={15} /></button>
                    <button type="button" aria-label="Excluir passo" onClick={() => { if (!s.branches || window.confirm('Excluir este passo e os caminhos dele?')) change(l => removeStep(l, s.id)) }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', padding: 4 }}><Trash2 size={15} /></button>
                  </div>
                </div>
                {open && (
                  <div style={{ padding: '4px 12px 14px', borderTop: `1px solid ${C.line}` }}>
                    <div style={{ paddingTop: 10 }}>
                      <StepForm step={s} onChange={d => updateStep(s.id, d)} people={people} groups={groups} tags={tags} targets={targets} simple={simple} />
                    </div>
                  </div>
                )}
              </div>
              {s.branches && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, marginLeft: depth < 3 ? 18 : 8 }}>
                  {branchKeys(s).map((k, bi) => {
                    const title = s.type === 'menu' ? `${bi + 1}. ${s.data.options?.[bi]?.text || ''}` : k === 'yes' ? 'Se SIM' : 'Se NÃO'
                    const color = s.type === 'menu' ? '#D97706' : k === 'yes' ? '#16A34A' : '#DC2626'
                    return (
                      <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.bg, padding: '8px 10px' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color }}>{title}</div>
                        {renderList(s.branches![k] || [], `${s.id}|${k}`, depth + 1)}
                      </div>
                    )
                  })}
                </div>
              )}
              {i < list.length - 1 && !s.branches && <AddButton path={path} index={i + 1} />}
            </div>
          )
        })}
        {list.length > 0 && !closed && <AddButton path={path} index={list.length} />}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
      <style>{`@keyframes aionPop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.aion-pop{animation:aionPop .25s cubic-bezier(.2,.8,.2,1) both}.animate-spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
        <button onClick={close} aria-label="Fechar" style={{ border: `1px solid ${C.line}`, background: '#fff', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>Robô de atendimento</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>{dirty ? 'Mudanças não salvas' : savedAt ? 'Salvo ✓' : 'Monte o caminho da conversa e teste ao lado'}</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: enabled ? C.primary : C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); setDirty(true) }} style={{ width: 18, height: 18, accentColor: C.primary }} />
          {enabled ? 'Robô ligado' : 'Robô desligado'}
        </label>
        {narrow && <button onClick={() => setShowPreview(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: C.primary, background: C.soft, border: 'none', borderRadius: 10, padding: '9px 12px', cursor: 'pointer' }}><Play size={14} /> {showPreview ? 'Editar' : 'Testar'}</button>}
        {onOpenCanvas && !window.matchMedia?.('(pointer: coarse)').matches && <button onClick={() => { if (dirty && !window.confirm('Abrir o desenho sem salvar?')) return; onOpenCanvas() }} title="Ver como desenho (modo avançado)" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.muted, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer' }}><LayoutGrid size={14} /> Desenho</button>}
        <button onClick={save} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#fff', background: GRAD, border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
        </button>
      </div>

      {error && <div role="alert" style={{ margin: '10px 16px 0', fontSize: 13, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px' }}>{error}</div>}

      {loading ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={26} className="animate-spin" color={C.primary} /></div> : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 16 }}>
          {/* Passos */}
          {(!narrow || !showPreview) && (
            <div style={{ flex: '1 1 560px', minWidth: 0, overflowY: 'auto', paddingBottom: 80 }}>
              {problems.length > 0 && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#92400E' }}>
                  <strong>{problems.length} ponto{problems.length > 1 ? 's' : ''} para ajustar</strong> — o robô pode travar nesses passos:
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{problems.slice(0, 6).map((p, i) => <li key={i} style={{ cursor: p.stepId ? 'pointer' : 'default' }} onClick={() => p.stepId && setOpenId(p.stepId)}>{p.text}</li>)}</ul>
                </div>
              )}
              {steps.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} color={C.primary} /> Comece por um modelo</div>
                  <div data-tour="robo-modelos" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {TEMPLATES.map(t => (
                      <button key={t.id} type="button" onClick={() => { change(() => t.build()) }} style={{ textAlign: 'left', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{t.label}</div>
                        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted }}>ou monte do zero:</div>
                  {renderList([], 'root', 0)}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted, marginBottom: 4 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: C.soft, color: C.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>▶</span>
                    A pessoa manda a primeira mensagem
                  </div>
                  {renderList(steps, 'root', 0)}
                </>
              )}
            </div>
          )}

          {/* Prévia / teste */}
          {(!narrow || showPreview) && (
            <div style={{ flex: narrow ? '1 1 auto' : '0 0 360px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0 }}>
              <div style={{ width: '100%', maxWidth: 360, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 28, border: '8px solid #0B1B34', background: '#EFE7DD', overflow: 'hidden', boxShadow: '0 20px 50px rgba(11,27,52,.18)' }}>
                <div style={{ background: BRAND.primaryDark, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{company.slice(0, 1).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{company}</div><div style={{ fontSize: 11, opacity: .8 }}>teste do robô</div></div>
                  <button onClick={sim.restart} aria-label="Recomeçar teste" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><RotateCcw size={16} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sim.bubbles.map((b, i) => b.from === 'sys'
                    ? <div key={i} style={{ alignSelf: 'center', fontSize: 11.5, color: '#475569', background: 'rgba(255,255,255,.75)', borderRadius: 8, padding: '3px 8px' }}>{b.text}</div>
                    : <div key={i} className="aion-pop" style={{ alignSelf: b.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '85%', whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.4, color: '#111', background: b.from === 'me' ? '#D9FDD3' : '#fff', borderRadius: 10, padding: '7px 10px', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
                        {b.text.split(/(\*[^*]+\*)/g).map((part, j) => /^\*[^*]+\*$/.test(part) ? <strong key={j}>{part.slice(1, -1)}</strong> : part)}
                      </div>)}
                </div>
                <div style={{ background: '#F0F2F5', padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 52, alignItems: 'center' }}>
                  {sim.wait?.kind === 'menu' && (sim.wait.step.data.options || []).map((o: any, i: number) => (
                    <button key={i} onClick={() => sim.answer(String(o.text), `opt-${i}`)} style={{ fontSize: 13, fontWeight: 600, color: BRAND.primaryDark, background: '#fff', border: '1px solid #D1D7DB', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>{i + 1}. {o.text}</button>
                  ))}
                  {sim.wait?.kind === 'condition' && (<>
                    <span style={{ fontSize: 12, color: '#475569', width: '100%' }}>Simular condição: {summary(sim.wait.step, peopleMap, groupMap)}</span>
                    <button onClick={() => sim.answer('', 'yes')} style={{ fontSize: 13, fontWeight: 700, color: '#166534', background: '#DCFCE7', border: 'none', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>Sim</button>
                    <button onClick={() => sim.answer('', 'no')} style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', background: '#FEE2E2', border: 'none', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>Não</button>
                  </>)}
                  {sim.wait?.kind === 'question' && (
                    <form onSubmit={e => { e.preventDefault(); const f = e.currentTarget.elements.namedItem('ans') as HTMLInputElement; if (f.value.trim()) { sim.answer(f.value.trim()); f.value = '' } }} style={{ display: 'flex', gap: 6, width: '100%' }}>
                      <label style={{ flex: 1, display: 'flex' }}><span style={{ position: 'absolute', left: -9999 }}>Resposta</span>
                        <input name="ans" autoComplete="off" placeholder="Responda como se fosse a pessoa…" style={{ flex: 1, border: 'none', borderRadius: 999, padding: '9px 14px', fontSize: 13.5 }} /></label>
                      <button type="submit" style={{ border: 'none', borderRadius: 999, background: BRAND.primary, color: '#fff', fontWeight: 700, padding: '0 14px', cursor: 'pointer' }}>Enviar</button>
                    </form>
                  )}
                  {!sim.wait && <button onClick={sim.restart} style={{ fontSize: 13, fontWeight: 700, color: BRAND.primaryDark, background: '#fff', border: '1px solid #D1D7DB', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>↻ Testar de novo</button>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
