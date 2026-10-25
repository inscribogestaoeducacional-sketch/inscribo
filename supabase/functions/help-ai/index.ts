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


// origem do site (a mesma de onde a pessoa chamou); só domínios da Áion
function siteOrigin(origin: string | null): string {
  try {
    if (origin) {
      const u = new URL(origin)
      if (u.protocol === 'https:' && (u.hostname === 'aionedu.com.br' || u.hostname.endsWith('.aionedu.com.br') || u.hostname.endsWith('.vercel.app'))) return u.origin
    }
  } catch { /* usa o padrão */ }
  return 'https://www.aionedu.com.br'
}

async function loadLessons(base: string): Promise<Lesson[]> {
  try {
    const r = await fetch(`${base}/academy-lessons.json`, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return []
    const j = await r.json()
    return Array.isArray(j?.lessons) ? j.lessons : []
  } catch { return [] }
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

  const base = siteOrigin(req.headers.get('origin'))
  const lessons = (await loadLessons(base)).filter(l => (!l.managerOnly || manager) && (!l.adminOnly || admRole) && (!l.attendantOnly || !manager))
  // a assistente conhece TODAS as aulas liberadas para esta pessoa (sem filtro por palavra): ela mesma acha a resposta
  const knowledge = lessons.map(l => `[${l.key}] ${l.title} (tela: ${l.to})\n${l.summary}\n${l.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${l.tip ? `\nDica: ${l.tip}` : ''}`).join('\n\n')

  const { data: hist } = await admin.from('support_messages').select('author_type, body').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(12)
  const msgs: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of (hist ?? []).reverse() as { author_type: string; body: string }[]) {
    const role = m.author_type === 'user' ? 'user' : 'assistant'
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + m.body
    else msgs.push({ role, content: m.body })
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()

  const nome1 = (me?.full_name || '').trim().split(/\s+/)[0]
  const hr = new Date(Date.now() - 3 * 3600_000).getUTCHours()
  const periodo = hr < 12 ? 'manhã (Bom dia)' : hr < 18 ? 'tarde (Boa tarde)' : 'noite (Boa noite)'
  const stable = `Você é a assistente de IA da Áion Edu, o sistema de gestão de matrículas e atendimento de escolas particulares. Você é o primeiro e principal suporte: a equipe da Áion é pequena e só deve ser chamada em último caso. Resolva você mesma, conversando como um chat de inteligência artificial.

Como conversar:
- Converse de forma natural, calorosa e paciente, em português do Brasil, com frases curtas e simples, para quem não é de tecnologia. Não repita sua apresentação: apresente-se no máximo uma vez, no início da conversa.
- Responda cumprimentos e agradecimentos como uma pessoa (se disserem "boa tarde", responda "boa tarde"), e logo ofereça ajuda.
- Leve em conta tudo o que já foi dito. Se a pessoa disser "e depois?" ou "não achei o botão", continue de onde parou.
- Se a pergunta estiver vaga, faça UMA pergunta curta para entender o que ela quer fazer, em vez de mandar para a equipe.
- Dê o passo a passo usando os nomes exatos dos botões, abas e telas como estão no conhecimento abaixo. Se for longo, dê 3 ou 4 passos e pergunte se quer continuar.
- Depois de explicar, confirme se deu certo ou se a pessoa quer ajuda com o próximo passo. Se algo não funcionou, tente entender o que apareceu na tela dela e ajude a resolver.
- Sugira a aula da Academia quando ajudar, escrevendo [[AULA:chave]] (a chave fica entre colchetes no conhecimento). Indique a tela com [[TELA:/caminho]] só quando o caminho aparecer no conhecimento. No máximo um de cada por resposta.
- Respostas de até 8 linhas, sem títulos nem markdown pesado; listas numeradas curtas são bem-vindas.
- Fale só do uso da Áion Edu. Assuntos fora disso, responda com educação em uma frase e volte ao que você pode ajudar.

O que NUNCA fazer:
- Nunca invente botão, tela, preço, prazo ou função que não esteja no conhecimento. Se não tiver certeza, diga isso com honestidade.
- Só chame a equipe quando você realmente tentou ajudar e não conseguiu, ou quando o assunto for cobrança/contrato/plano, erro ou defeito do sistema, acesso ou dados que só a equipe vê, ou pedido de nova função. Nesses casos, explique em uma frase o que vai acontecer e termine a resposta com [[EQUIPE]]. Ao ver [[EQUIPE]] o sistema avisa a equipe automaticamente.

CONHECIMENTO DO SISTEMA (aulas da Academia):
${knowledge || '(conhecimento indisponível agora: ajude com o que souber e, se não der, termine com [[EQUIPE]])'}`
  const dynamic = `Sobre esta conversa: agora é ${periodo} em Brasília. A pessoa ${nome1 ? `se chama ${nome1} e ` : ''}é ${manager ? (admRole ? 'administradora da escola' : 'gestora da escola') : 'atendente da escola'}. Tela em que ela está: ${route || 'não informada'}.`

  try {
    const r = await fetch(`${base}/api/ai`, {
      method: 'POST', signal: AbortSignal.timeout(28000),
      headers: { 'content-type': 'application/json', authorization: authH },
      body: JSON.stringify({ action: 'wa_help', payload: { system: stable, context: dynamic, messages: msgs.length ? msgs : [{ role: 'user', content: message }] } }),
    })
    if (!r.ok) throw new Error(`ai ${r.status}: ${(await r.text()).slice(0, 300)}`)
    const j = await r.json()
    const text: string = String(j.text ?? '').trim()
    if (!text) throw new Error('vazio')
    await admin.from('support_messages').insert({ thread_id: threadId, author_type: 'ai', body: text.slice(0, 5900) })
    await admin.from('support_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId)
    if (text.includes('[[EQUIPE]]')) await escalate()
    return json({ thread_id: threadId, answer: text })
  } catch (e) {
    console.error('help-ai', (e as Error).message)
    try { await admin.from('support_ai_errors').insert({ thread_id: threadId, message: (e as Error).message.slice(0, 500) }) } catch { /* ok */ }
    await escalate()
    return json({ thread_id: threadId, escalated: true, reason: 'ai_error' })
  }
})
