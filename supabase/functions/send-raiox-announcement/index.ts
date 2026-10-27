// Envia o comunicado do Raio-X Estratégico por e-mail (Brevo).
// audience "gestores": administradores/gestores ativos das escolas (usuários da Áion Edu).
// audience "leads": e-mails dos leads do CRM da Áion.
// Só aceita a chave de serviço (chamada pelo banco). mode "test": envia só para o endereço informado.
// mode "all": envia uma vez por e-mail (announcement_sends impede repetição).
import { createClient } from 'npm:@supabase/supabase-js@2'

const LINK = 'https://aionedu.com.br/raio-x'
const WA = 'https://wa.me/5583993444383'
const F = `'Helvetica Neue',Helvetica,Arial,sans-serif`
const li = (t: string) => `<li style="margin:0 0 9px;">${t}</li>`
const h2 = (t: string) => `<p style="margin:22px 0 8px;font-size:13px;font-weight:800;letter-spacing:.08em;color:#00523C;">${t}</p>`
const ITENS = [
  '<b>Sua posição na cidade</b>, por etapa de ensino, entre as escolas particulares.',
  '<b>Crescimento em 5 anos</b> da escola e da cidade, e onde os alunos saem entre uma etapa e outra.',
  '<b>Mapa de bairros</b>: onde estão as crianças, a renda das famílias e as concorrentes.',
  '<b>ENEM, nascimentos e estrutura</b> frente às concorrentes mais próximas.',
  '<b>Inteligência de marketing do Instagram</b>: nota de 0 a 100, melhor formato, melhor dia para postar e os 3 ajustes que mais mudam o resultado.',
  '<b>Nota de atendimento</b> (5 perguntas rápidas) e um <b>diagnóstico escrito por IA</b> com as 3 maiores oportunidades.',
]
type Aud = 'gestores' | 'leads'
const COPY: Record<Aud, { release: string; subject: string; titulo: string; intro: string[]; fecho: string[]; cta: string }> = {
  gestores: {
    release: 'raiox-gestores-2026-10',
    subject: 'Novo na Áion: o Raio-X Estratégico da sua escola, grátis',
    titulo: 'Conheça o Raio-X Estratégico',
    intro: [
      'Acabamos de lançar o <b>Raio-X Estratégico</b>: um relatório em PDF com a inteligência de mercado e de marketing da escola, feito só com dados públicos oficiais (INEP, IBGE e Ministério da Saúde) e comparando apenas escolas particulares.',
      'É grátis, leva poucos minutos e está disponível para a sua escola agora. Gere o da sua unidade e leve os números para a próxima reunião de matrículas.',
    ],
    fecho: ['Para a parte do Instagram, basta informar o @ da escola (perfil profissional e público). Páginas sem dado público para a sua cidade não aparecem.', 'Gerou o seu? Conte para a gente o que achou: cada sugestão vira melhoria.'],
    cta: 'Gerar o Raio-X da minha escola',
  },
  leads: {
    release: 'raiox-leads-2026-10',
    subject: 'Você já planejou as matrículas 2027? Seu Raio-X grátis',
    titulo: 'Você já planejou as matrículas 2027?',
    intro: [
      'A Áion Edu criou o <b>Raio-X Estratégico</b>: um relatório gratuito, em PDF, que mostra como a sua escola está posicionada no mercado e onde ela pode crescer. Usa só dados públicos oficiais (INEP, IBGE e Ministério da Saúde) e compara apenas escolas particulares.',
      'Gere o da sua escola em poucos minutos, sem cartão.',
    ],
    fecho: ['Para a parte do Instagram, basta informar o @ da escola (perfil profissional e público). Páginas sem dado público para a sua cidade não aparecem.'],
    cta: 'Gerar meu Raio-X grátis',
  },
}
const html = (a: Aud, nome: string) => { const c = COPY[a]; return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:${F};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#00523C;padding:22px 28px;"><img src="https://www.aionedu.com.br/aion-logo-full.png" alt="Áion Edu" height="34" style="display:block;height:34px;"></td></tr>
<tr><td style="padding:28px 28px 8px;color:#1A2B4A;font-size:15px;line-height:1.55;">
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#00523C;">${c.titulo}</h1>
<p style="margin:0 0 12px;">Olá${nome ? `, ${nome}` : ''}!</p>
${c.intro.map(p => `<p style="margin:0 0 12px;">${p}</p>`).join('\n')}
${h2('O QUE VEM NO RELATÓRIO')}
<ul style="margin:0 0 16px;padding-left:20px;">${ITENS.map(li).join('\n')}</ul>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:#00A896;border-radius:12px;"><a href="${LINK}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:800;font-size:15px;text-decoration:none;">${c.cta}</a></td></tr></table>
${c.fecho.map(p => `<p style="margin:0 0 12px;">${p}</p>`).join('\n')}
<p style="margin:0 0 12px;">Prefere conversar? <a href="${WA}" style="color:#00A896;font-weight:700;">Fale com a Áion no WhatsApp</a>, (83) 99344-4383.</p>
<p style="margin:0 0 24px;">Um abraço,<br>Equipe Áion Soluções Tecnológicas</p>
</td></tr>
<tr><td style="background:#F8FAFC;padding:16px 28px;color:#64748B;font-size:12px;text-align:center;">Áion Soluções Tecnológicas · aionedu.com.br<br>Não quer receber novidades? Avise pelo WhatsApp e retiramos o seu e-mail.</td></tr>
</table></td></tr></table></body></html>` }

async function brevo(key: string, a: Aud, to: string, name: string) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({ sender: { name: 'Áion Edu', email: 'noreply@aionedu.com.br' }, to: [{ email: to }], subject: COPY[a].subject, htmlContent: html(a, name), tags: [COPY[a].release] }),
  })
  if (!r.ok) throw new Error(`brevo ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

Deno.serve(async (req) => {
  let role = ''
  try { role = JSON.parse(atob((req.headers.get('authorization') || '').replace('Bearer ', '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role } catch { /* nada */ }
  if (role !== 'service_role') return new Response('forbidden', { status: 403 })
  const key = Deno.env.get('BREVO_API_KEY')
  if (!key) return new Response(JSON.stringify({ error: 'BREVO_API_KEY ausente' }), { status: 500 })
  const { mode, to, audience } = await req.json().catch(() => ({})) as { mode?: string; to?: string; audience?: string }
  if (audience !== 'gestores' && audience !== 'leads') return new Response(JSON.stringify({ error: 'audience inválida' }), { status: 400 })
  if (mode === 'test') {
    if (!to) return new Response(JSON.stringify({ error: 'informe to' }), { status: 400 })
    await brevo(key, audience, to, 'Victor')
    return new Response(JSON.stringify({ ok: true, sent: 1, test: true }))
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let rows: { email: string | null; nome: string | null; ok: boolean }[] = []
  if (audience === 'gestores') {
    const { data, error } = await admin.from('users').select('email, full_name, active, role').eq('user_type', 'school_user').in('role', ['admin', 'manager']).not('institution_id', 'is', null)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    rows = (data ?? []).map((u: any) => ({ email: u.email, nome: u.full_name, ok: u.active !== false }))
  } else {
    const { data, error } = await admin.from('crm_leads').select('email, name')
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    rows = (data ?? []).map((u: any) => ({ email: u.email, nome: u.name, ok: true }))
  }
  if (mode === 'count') {
    const set = new Set(rows.filter(r => r.ok).map(r => (r.email || '').trim().toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))
    return new Response(JSON.stringify({ ok: true, destinatarios: set.size }))
  }
  if (mode !== 'all') return new Response(JSON.stringify({ error: 'mode inválido' }), { status: 400 })
  const release = COPY[audience].release
  const seen = new Set<string>(), results = { sent: 0, skipped: 0, failed: [] as string[] }
  for (const u of rows) {
    const email = (u.email || '').trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !u.ok || seen.has(email)) { results.skipped++; continue }
    seen.add(email)
    const { error: ins } = await admin.from('announcement_sends').insert({ release, email })
    if (ins) { results.skipped++; continue }
    try { await brevo(key, audience, email, (u.nome || '').trim().split(/\s+/)[0]); results.sent++ }
    catch (e) { results.failed.push(`${email}: ${(e as Error).message}`); await admin.from('announcement_sends').delete().eq('release', release).eq('email', email) }
  }
  return new Response(JSON.stringify({ ok: true, ...results }))
})
