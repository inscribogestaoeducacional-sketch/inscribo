// "Tire suas dúvidas": responde perguntas de uso da Áion Edu com base nas aulas da Academia.
// A IA usa a chave que já existe no Vercel (rota /api/ai, ação wa_help). Se a IA falhar ou passar do limite diário,
// a pergunta já está gravada e a equipe da Áion é chamada na hora (support_escalate).
import { createClient } from 'npm:@supabase/supabase-js@2'

const DAILY_LIMIT = 60
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } })

interface Lesson { key: string; module: string; title: string; summary: string; steps: string[]; tip: string | null; to: string; managerOnly: boolean; adminOnly: boolean; attendantOnly: boolean }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const STOP = new Set(['como', 'para', 'que', 'uma', 'um', 'de', 'do', 'da', 'no', 'na', 'os', 'as', 'eu', 'posso', 'faco', 'fazer', 'onde', 'qual', 'quais', 'com', 'por', 'meu', 'minha', 'esta', 'este', 'isso', 'nao', 'sim'])

async function loadLessons(origin: string | null): Promise<Lesson[]> {
  try {
    if (!origin) return []
    const u = new URL(origin)
    if (u.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) return []
    const r = await fetch(`${u.origin}/academy-lessons.json`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return []
    const j = await r.json()
    return Array.isArray(j?.lessons) ? j.lessons : []
  } catch { return [] }
}

function pick(lessons: Lesson[], question: string, route: string, manager: boolean, admin: boolean): Lesson[] {
  const words = norm(question).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w))
  const ok = lessons.filter(l => (!l.managerOnly || manager) && (!l.adminOnly || admin) && (!l.attendantOnly || !manager))
  return ok.map(l => {
    const hay = norm(`${l.title} ${l.summary} ${l.steps.join(' ')}`)
    let s = 0
    for (const w of words) if (hay.includes(w)) s += norm(l.title).includes(w) ? 4 : 1
    if (route && l.to.split('?')[0] === route) s += 2
    return { l, s }
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.l)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'método inválido' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const authH = req.headers.get('Authorization') || ''
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authH } } })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: au } = await asUser.auth.getUser()
  if (!au?.user) return json({ error: 'não autenticado' }, 401)
  const uid = au.user.id

  let body: { thread_id?: string | null; message?: string; route?: string }
  try { body = await req.json() } catch { return json({ error: 'pedido inválido' }, 400) }
  const message = (body.message || '').trim()
  if (!message || message.length > 2000) return json({ error: 'mensagem inválida' }, 400)
  const route = (body.route || '').split('?')[0].slice(0, 120)

  const { data: me } = await admin.from('users').select('role, institution_id, full_name').eq('id', uid).maybeSingle()
  const manager = me?.role === 'admin' || me?.role === 'manager'
  const admRole = me?.role === 'admin'

  // limite diário (fuso de Brasília)
  const since = new Date(Date.now() - 3 * 3600_000); since.setUTCHours(0, 0, 0, 0)
  const sinceIso = new Date(since.getTime() + 3 * 3600_000).toISOString()
  const { data: myThreads } = await admin.from('support_threads').select('id').eq('user_id', uid)
  const ids = (myThreads ?? []).map((t: { id: string }) => t.id)
  let used = 0
  if (ids.length) {
    const { count } = await admin.from('support_messages').select('id', { count: 'exact', head: true }).in('thread_id', ids).eq('author_type', 'user').gte('created_at', sinceIso)
    used = count ?? 0
  }

  // grava a pergunta (regras e RLS do banco)
  const { data: tid, error: sendErr } = await asUser.rpc('support_send', { p_thread: body.thread_id || null, p_body: message, p_route: route || null })
  if (sendErr || !tid) return json({ error: sendErr?.message || 'não foi possível enviar' }, 400)
  const threadId = tid as string

  const escalate = async () => { await asUser.rpc('support_escalate', { p_thread: threadId }) }

  const { data: th } = await admin.from('support_threads').select('status').eq('id', threadId).maybeSingle()
  if (th?.status === 'escalated') return json({ thread_id: threadId, escalated: true, waiting_staff: true })

  if (used >= DAILY_LIMIT) { await escalate(); return json({ thread_id: threadId, escalated: true, reason: 'limit' }) }

  const lessons = await loadLessons(req.headers.get('origin'))
  const chosen = pick(lessons, message, route, manager, admRole)
  const knowledge = chosen.map(l => `AULA "${l.title}" (tela: ${l.to})\n${l.summary}\n${l.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${l.tip ? `\nDica: ${l.tip}` : ''}`).join('\n\n')

  const { data: hist } = await admin.from('support_messages').select('author_type, body').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(10)
  const msgs: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of (hist ?? []).reverse() as { author_type: string; body: string }[]) {
    const role = m.author_type === 'user' ? 'user' : 'assistant'
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + m.body
    else msgs.push({ role, content: m.body })
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()

  const system = `Você é a assistente da Academia Áion Edu, o sistema de gestão de matrículas de escolas. Responda em português do Brasil, em frases curtas e simples, para quem não é de tecnologia.
Regras:
- Use SOMENTE as aulas abaixo. Cite os nomes exatos dos botões e abas entre aspas, como estão nas aulas.
- Nunca invente botão, tela ou função. Se a resposta não estiver nas aulas, diga que não tem certeza e termine com [[EQUIPE]].
- Se ajudar, indique a tela com [[TELA:/caminho]] (um por resposta, só caminhos que aparecem nas aulas).
- Pergunta sobre cobrança, contrato, erro do sistema, dados da escola ou algo que só a equipe resolve: termine com [[EQUIPE]].
- A pessoa é ${manager ? (admRole ? 'administradora da escola' : 'gestora da escola') : 'atendente da escola'}. Tela atual: ${route || 'não informada'}.
- No máximo 6 linhas. Não use markdown pesado: sem títulos; pode usar listas numeradas curtas.

AULAS:
${knowledge || '(nenhuma aula encontrada para esta pergunta)'}`

  try {
    // a chave da IA fica no Vercel (a mesma dos relatórios); a função chama /api/ai com a sessão da pessoa
    const r = await fetch('https://app.aionedu.com.br/api/ai', {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'content-type': 'application/json', authorization: authH },
      body: JSON.stringify({ action: 'wa_help', payload: { system, messages: msgs.length ? msgs : [{ role: 'user', content: message }] } }),
    })
    if (!r.ok) throw new Error(`ai ${r.status}`)
    const j = await r.json()
    const text: string = String(j.text ?? '').trim()
    if (!text) throw new Error('vazio')
    await admin.from('support_messages').insert({ thread_id: threadId, author_type: 'ai', body: text.slice(0, 5900) })
    await admin.from('support_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId)
    return json({ thread_id: threadId, answer: text })
  } catch (e) {
    console.error('help-ai', (e as Error).message)
    await escalate()
    return json({ thread_id: threadId, escalated: true, reason: 'ai_error' })
  }
})
