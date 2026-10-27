// Envia o comunicado do Raio-X Estratégico por e-mail (Brevo).
// audience "gestores": administradores/gestores ativos das escolas (usuários da Áion Edu).
// audience "leads": e-mails dos leads do CRM da Áion.
// Só aceita a chave de serviço (chamada pelo banco). mode "test": envia só para o endereço informado.
// mode "all": envia uma vez por e-mail (announcement_sends impede repetição).
import { createClient } from 'npm:@supabase/supabase-js@2'

const LINK = 'https://aionedu.com.br/raio-x'
const WA = 'https://wa.me/5583993444383'
const F = `'Helvetica Neue',Helvetica,Arial,sans-serif`
const SITE = 'https://www.aionedu.com.br'
const ITENS: [string, string][] = [
  ['Sua posição na cidade', 'Ranking entre as escolas particulares, por etapa de ensino.'],
  ['Crescimento em 5 anos', 'Da sua escola e da cidade, e onde os alunos saem entre uma etapa e outra.'],
  ['Mapa de bairros', 'Onde estão as crianças, a renda das famílias e as concorrentes.'],
  ['ENEM, nascimentos e estrutura', 'Você frente às concorrentes mais próximas.'],
  ['Instagram, de 0 a 100', 'Nota do perfil, melhor formato, melhor dia para postar e 3 ajustes.'],
  ['Atendimento e diagnóstico por IA', 'Nota em 5 perguntas rápidas e as 3 maiores oportunidades.'],
]
type Aud = 'gestores' | 'leads'
export const COPY: Record<Aud, { release: string; subject: string; pre: string; tag: string; titulo: string; sub: string; intro: string[]; cta: string }> = {
  gestores: {
    release: 'raiox-gestores-2026-10',
    subject: 'Novo na Áion: o Raio-X Estratégico da sua escola, grátis',
    pre: 'Um relatório de 16 páginas com os números públicos da sua escola e da sua cidade.',
    tag: 'NOVIDADE NA ÁION',
    titulo: 'Raio-X Estratégico: veja a sua escola como o mercado vê',
    sub: 'Um relatório em PDF, grátis, feito só com dados públicos oficiais e comparando apenas escolas particulares.',
    intro: [
      'Acabamos de lançar o <b>Raio-X Estratégico</b>. Em poucos minutos você recebe a posição da sua escola na cidade, o que mudou nos últimos 5 anos e onde estão as oportunidades de matrícula.',
      'Gere o da sua unidade e leve os números para a próxima reunião de matrículas.',
    ],
    cta: 'Gerar o Raio-X da minha escola',
  },
  leads: {
    release: 'raiox-leads-2026-10',
    subject: 'Você já planejou as matrículas 2027? Seu Raio-X grátis',
    pre: 'Veja onde a sua escola está no mercado antes de definir as metas de 2027.',
    tag: 'GRÁTIS, EM POUCOS MINUTOS',
    titulo: 'Você já planejou as matrículas 2027?',
    sub: 'Gere o Raio-X Estratégico da sua escola: um relatório em PDF, feito só com dados públicos oficiais e comparando apenas escolas particulares.',
    intro: [
      'Antes de definir metas e campanhas, vale saber como a sua escola está posicionada e onde ela pode crescer. É isso que o <b>Raio-X Estratégico</b> mostra, sem cartão e sem compromisso.',
    ],
    cta: 'Gerar meu Raio-X grátis',
  },
}
const card = (t: string, d: string) => `<td width="50%" valign="top" style="padding:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F8F5;border-left:4px solid #00A896;border-radius:10px;"><tr><td style="padding:13px 14px;font-family:${F};"><div style="font-size:14px;font-weight:800;color:#00382B;line-height:1.25;">${t}</div><div style="font-size:12.5px;color:#46605A;line-height:1.45;margin-top:4px;">${d}</div></td></tr></table></td>`
const pg = (n: number, w: number) => `<td align="center" valign="top" style="padding:0 5px;"><img src="${SITE}/raiox/prev-${n}.jpg" width="${w}" alt="Página do Raio-X (exemplo com dados fictícios)" style="display:block;width:${w}px;height:auto;border-radius:6px;border:1px solid #D3E4DD;"></td>`
const btn = (txt: string, dark: boolean) => `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${dark ? '#19D3B5' : '#00523C'};border-radius:12px;"><a href="${LINK}" style="display:inline-block;padding:15px 30px;font-family:${F};font-size:16px;font-weight:800;color:${dark ? '#00352A' : '#FFFFFF'};text-decoration:none;">${txt}</a></td></tr></table>`
export const html = (a: Aud, nome: string) => { const c = COPY[a]; return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#E6EFEB;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#E6EFEB;">${c.pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E6EFEB;padding:20px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;">
<tr><td bgcolor="#003D2E" style="background:#003D2E;background-image:linear-gradient(135deg,#00523C 0%,#002A20 100%);padding:28px 32px 34px;font-family:${F};">
<img src="${SITE}/raiox/logo-branca.png" alt="Áion Edu" width="120" style="display:block;width:120px;height:auto;margin-bottom:30px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#19D3B5;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:800;letter-spacing:.06em;color:#00352A;">${c.tag}</td></tr></table>
<h1 style="margin:16px 0 12px;font-size:32px;line-height:1.15;color:#FFFFFF;font-weight:800;">${c.titulo}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#BFE8DF;">${c.sub}</p>
${btn(c.cta, true)}
</td></tr>
<tr><td bgcolor="#EAF4F0" align="center" style="background:#EAF4F0;padding:26px 16px 22px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${pg(1, 160)}${pg(8, 160)}${pg(6, 160)}</tr></table>
<div style="font-family:${F};font-size:11.5px;color:#5B7770;margin-top:12px;">Páginas de exemplo, com dados fictícios. O seu relatório traz os números reais da sua escola.</div></td></tr>
<tr><td style="padding:30px 32px 6px;font-family:${F};color:#1A2B4A;font-size:15.5px;line-height:1.6;">
<p style="margin:0 0 12px;font-size:17px;font-weight:700;color:#00382B;">Olá${nome ? `, ${nome}` : ''}!</p>
${c.intro.map(p => `<p style="margin:0 0 12px;">${p}</p>`).join('\n')}
</td></tr>
<tr><td style="padding:6px 27px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>${card(...ITENS[0])}${card(...ITENS[1])}</tr><tr>${card(...ITENS[2])}${card(...ITENS[3])}</tr><tr>${card(...ITENS[4])}${card(...ITENS[5])}</tr></table></td></tr>
<tr><td style="padding:22px 32px 8px;font-family:${F};color:#1A2B4A;font-size:14px;line-height:1.6;">
<p style="margin:0 0 20px;color:#46605A;">Fontes: INEP, IBGE e Ministério da Saúde. Para a parte do Instagram, basta informar o @ da escola (perfil profissional e público). Páginas sem dado público para a sua cidade não aparecem no relatório.</p>
${btn(c.cta, false)}
<p style="margin:22px 0 0;font-size:15px;">Prefere conversar? <a href="${WA}" style="color:#007D71;font-weight:800;">Fale com a Áion no WhatsApp</a>, (83) 99344-4383.</p>
<p style="margin:16px 0 26px;font-size:15px;">Um abraço,<br><b>Equipe Áion Soluções Tecnológicas</b></p>
</td></tr>
<tr><td bgcolor="#F4F8F6" align="center" style="background:#F4F8F6;padding:18px 28px;font-family:${F};font-size:12px;line-height:1.5;color:#6A817B;">Áion Soluções Tecnológicas · aionedu.com.br<br>Não quer receber novidades? Avise pelo WhatsApp e retiramos o seu e-mail.</td></tr>
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
