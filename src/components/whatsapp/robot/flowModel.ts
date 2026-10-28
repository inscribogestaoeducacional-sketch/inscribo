// Modelo do robô em "passos" (lista com ramificações) ⇄ grafo salvo em
// whatsapp_flows.bot_flow ({ nodes, edges }), o mesmo formato que o webhook
// executa e que o editor de caixinhas antigo abre. A conversão é sem perdas
// para fluxos em árvore; quando dois caminhos apontam para o mesmo passo, o
// segundo vira um passo "Ir para".

export type StepType =
  | 'message' | 'media' | 'question' | 'menu' | 'condition' | 'action' | 'lead'
  | 'transfer' | 'distribute' | 'wait' | 'end' | 'goto'

export interface Step {
  id: string
  type: StepType
  data: Record<string, any>
  /** menu: 'opt-0', 'opt-1'…; condition: 'yes' | 'no' */
  branches?: Record<string, Step[]>
}

export interface GraphNode { id: string; type: string; position: { x: number; y: number }; data: Record<string, any>; width?: number; height?: number }
export interface GraphEdge { id: string; fromNodeId: string; fromPortId: string; toNodeId: string; toPortId: string }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

export const genId = () => `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

/** Passos que encerram a lista (o que vem depois fica nos caminhos). */
export const BRANCHING: StepType[] = ['menu', 'condition']
export const TERMINAL: StepType[] = ['end', 'goto']

const normPort = (p?: string) => {
  const s = String(p || 'out')
  if (s === 'true') return 'yes'
  if (s === 'false') return 'no'
  if (/^opt_\d+$/.test(s)) return s.replace('_', '-')
  return s
}

export function branchKeys(step: Step): string[] {
  if (step.type === 'menu') return (step.data.options || []).map((_: unknown, i: number) => `opt-${i}`)
  if (step.type === 'condition') return ['yes', 'no']
  return []
}

// ── grafo → passos ───────────────────────────────────────────────────────────
export function graphToSteps(g: Graph | null | undefined): Step[] {
  if (!g?.nodes?.length) return []
  const byId = new Map(g.nodes.map(n => [n.id, n]))
  const out = (id: string, port: string) =>
    (g.edges || []).filter(e => e.fromNodeId === id && normPort(e.fromPortId) === port).map(e => (e as any).toNodeId ?? (e as any).to)
  const optPort = (n: GraphNode, i: number) => {
    const byIdx = out(n.id, `opt-${i}`)
    if (byIdx.length) return byIdx
    const optId = n.data?.options?.[i]?.id
    return optId ? out(n.id, optId) : []
  }
  const seen = new Set<string>()

  const walk = (startId: string | undefined): Step[] => {
    const list: Step[] = []
    let id = startId
    let guard = 0
    while (id && guard++ < 500) {
      const n = byId.get(id)
      if (!n || n.type === 'start') {
        if (n) { id = out(n.id, 'out')[0]; continue }
        break
      }
      if (seen.has(n.id)) { list.push({ id: genId(), type: 'goto', data: { target: n.id } }); break }
      seen.add(n.id)
      const step: Step = { id: n.id, type: (n.type as StepType), data: { ...(n.data || {}) } }
      list.push(step)
      if (n.type === 'menu') {
        step.branches = {}
        ;(n.data?.options || []).forEach((_: unknown, i: number) => { step.branches![`opt-${i}`] = walk(optPort(n, i)[0]) })
        break
      }
      if (n.type === 'condition') {
        step.branches = { yes: walk(out(n.id, 'yes')[0]), no: walk(out(n.id, 'no')[0]) }
        break
      }
      if (n.type === 'end') break
      id = out(n.id, 'out')[0]
    }
    return list
  }

  const start = g.nodes.find(n => n.type === 'start')
  const steps = walk(start ? out(start.id, 'out')[0] : g.nodes[0]?.id)
  return steps
}

// ── passos → grafo ───────────────────────────────────────────────────────────
export function stepsToGraph(steps: Step[]): Graph {
  const nodes: GraphNode[] = [{ id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {}, width: 240, height: 82 }]
  const edges: GraphEdge[] = []
  let row = 0
  const link = (from: string, port: string, to: string) =>
    edges.push({ id: `e_${from}_${port}_${to}`, fromNodeId: from, fromPortId: port, toNodeId: to, toPortId: 'in' })

  // devolve o id do primeiro passo da lista (ou alvo do "Ir para")
  const place = (list: Step[], depth: number): string | null => {
    let firstId: string | null = null
    let prev: { id: string; port: string } | null = null
    for (const s of list) {
      if (s.type === 'goto') {
        const target = s.data.target as string
        if (target) {
          if (prev) link(prev.id, prev.port, target)
          if (!firstId) firstId = target
        }
        break
      }
      nodes.push({ id: s.id, type: s.type, position: { x: depth * 300, y: (++row) * 170 }, data: cleanData(s), width: 240, height: 140 })
      if (prev) link(prev.id, prev.port, s.id)
      if (!firstId) firstId = s.id
      if (s.type === 'menu' || s.type === 'condition') {
        for (const key of branchKeys(s)) {
          const child = place(s.branches?.[key] || [], depth + 1)
          if (child) link(s.id, key, child)
        }
        break
      }
      if (s.type === 'end') break
      prev = { id: s.id, port: 'out' }
    }
    return firstId
  }
  const first = place(steps, 1)
  if (first) link('start', 'out', first)
  return { nodes, edges }
}

function cleanData(s: Step): Record<string, any> {
  const d = { ...s.data }
  if (s.type === 'menu') d.options = (d.options || []).map((o: any, i: number) => ({ ...o, id: o.id || `opt_${i}`, number: i + 1 }))
  return d
}

// ── utilidades para editar a árvore ─────────────────────────────────────────
export function mapSteps(list: Step[], fn: (s: Step) => Step): Step[] {
  return list.map(s => {
    const n = fn(s)
    if (!n.branches) return n
    const b: Record<string, Step[]> = {}
    for (const k of Object.keys(n.branches)) b[k] = mapSteps(n.branches[k], fn)
    return { ...n, branches: b }
  })
}
export function removeStep(list: Step[], id: string): Step[] {
  return list.filter(s => s.id !== id).map(s => s.branches
    ? { ...s, branches: Object.fromEntries(Object.entries(s.branches).map(([k, v]) => [k, removeStep(v, id)])) }
    : s)
}
/** Insere `step` na lista identificada por `path` (ex.: 'root', 'n_x:opt-1') na posição `index`. */
export function insertStep(list: Step[], path: string, index: number, step: Step): Step[] {
  if (path === 'root') { const c = [...list]; c.splice(index, 0, step); return c }
  const [pid, key] = path.split('|')
  return list.map(s => {
    if (s.id === pid) {
      const b = { ...(s.branches || {}) }
      const arr = [...(b[key] || [])]; arr.splice(index, 0, step); b[key] = arr
      return { ...s, branches: b }
    }
    if (!s.branches) return s
    return { ...s, branches: Object.fromEntries(Object.entries(s.branches).map(([k, v]) => [k, insertStep(v, path, index, step)])) }
  })
}
export function moveStep(list: Step[], id: string, dir: -1 | 1): Step[] {
  const i = list.findIndex(s => s.id === id)
  if (i >= 0) {
    const j = i + dir
    if (j < 0 || j >= list.length) return list
    const c = [...list]; [c[i], c[j]] = [c[j], c[i]]; return c
  }
  return list.map(s => s.branches
    ? { ...s, branches: Object.fromEntries(Object.entries(s.branches).map(([k, v]) => [k, moveStep(v, id, dir)])) }
    : s)
}
export function allSteps(list: Step[]): Step[] {
  return list.flatMap(s => [s, ...(s.branches ? Object.values(s.branches).flatMap(allSteps) : [])])
}

// ── validação: o que faria o robô travar calado ─────────────────────────────
export interface Problem { stepId: string; text: string }
export function validate(steps: Step[], simple = false): Problem[] {
  const p: Problem[] = []
  const ids = new Set(allSteps(steps).map(s => s.id))
  if (!steps.length) p.push({ stepId: '', text: 'O robô está vazio — adicione pelo menos uma mensagem.' })
  for (const s of allSteps(steps)) {
    const d = s.data || {}
    if (s.type === 'menu') (d.options || []).forEach((o: any, i: number) => { if (String(o.text || '').length > 20) p.push({ stepId: s.id, text: `Opção ${i + 1} passa de 20 letras: o WhatsApp corta o botão.` }) })
    if ((s.type === 'message' && (!d.mediaType || d.mediaType === 'text')) && !String(d.text || '').trim()) p.push({ stepId: s.id, text: 'Mensagem sem texto.' })
    if (s.type === 'message' && d.mediaType && !['text', 'contact'].includes(d.mediaType) && !d.mediaUrl) p.push({ stepId: s.id, text: 'Mídia sem arquivo.' })
    if (s.type === 'question' && !String(d.text || '').trim()) p.push({ stepId: s.id, text: 'Pergunta sem texto.' })
    if (s.type === 'question' && !String(d.variable || '').trim()) p.push({ stepId: s.id, text: 'Pergunta sem nome para guardar a resposta.' })
    if (s.type === 'menu') {
      if (!(d.options || []).length) p.push({ stepId: s.id, text: 'Menu sem opções.' })
      ;(d.options || []).forEach((o: any, i: number) => {
        if (!String(o.text || '').trim()) p.push({ stepId: s.id, text: `Opção ${i + 1} sem nome.` })
        if (!(s.branches?.[`opt-${i}`] || []).length) p.push({ stepId: s.id, text: `Opção "${o.text || i + 1}" não leva a nenhum passo.` })
      })
    }
    if (s.type === 'transfer' && !simple) {
      const t = d.transferType || 'attendant'
      if (t === 'attendant' && !(d.assignee_id || d.assigneeId)) p.push({ stepId: s.id, text: 'Transferir: escolha a pessoa.' })
      if (t === 'group' && !d.group_id) p.push({ stepId: s.id, text: 'Transferir: escolha o setor.' })
    }
    if (s.type === 'goto' && !ids.has(d.target)) p.push({ stepId: s.id, text: '"Ir para" aponta para um passo que não existe mais.' })
  }
  return p
}

// ── modelos prontos ─────────────────────────────────────────────────────────
const m = (text: string): Step => ({ id: genId(), type: 'message', data: { mediaType: 'text', text } })
const tr = (message: string): Step => ({ id: genId(), type: 'transfer', data: { transferType: 'general', message } })
const menu = (text: string, opts: [string, Step[]][]): Step => ({
  id: genId(), type: 'menu', data: { menuText: text, options: opts.map(([t]) => ({ text: t })) },
  branches: Object.fromEntries(opts.map(([, st], i) => [`opt-${i}`, st])),
})

export const TEMPLATES: { id: string; label: string; desc: string; build: () => Step[] }[] = [
  { id: 'aion', label: 'Suporte, conhecer o sistema e consultor', desc: 'Menu com três caminhos: quem já é cliente, quem quer conhecer e quem quer falar com uma pessoa.', build: () => [
    menu('Olá! Bem-vindo à Áion EDU 👋 Como posso ajudar?', [
      ['Sou cliente: suporte', [m('Certo! Já vou chamar alguém do suporte.'), tr('Um momento, a nossa equipe já responde você.')]],
      ['Conhecer o sistema', [m('A Áion EDU ajuda a sua escola a captar e matricular mais alunos, com CRM, WhatsApp e campanhas.'), tr('Vou te conectar com um consultor para mostrar tudo.')]],
      ['Falar com consultor', [tr('Conectando você com um consultor.')]],
    ]),
  ] },
  { id: 'simples', label: 'Só saudação e atendente', desc: 'Uma mensagem de boas-vindas e a conversa já vai para a equipe.', build: () => [
    m('Olá! 👋 Obrigado por falar com a Áion EDU.'),
    tr('Já vou te passar para a nossa equipe.'),
  ] },
]
