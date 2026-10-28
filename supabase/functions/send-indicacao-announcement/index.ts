// Comunicado da campanha "Indique e ganhe" para quem usa a Áion Edu (gestores, administradores e atendentes ativos).
// Só aceita a chave de serviço. mode "test": só para o endereço informado. "count": conta. "all": envia uma vez por e-mail
// (announcement_sends impede repetição). O valor do prêmio vem de platform_settings (referral_prize).
import { createClient } from 'npm:@supabase/supabase-js@2'

const RELEASE = 'indicacao-usuarios-2026-10'
const LINK = 'https://aionedu.com.br/login'
const WA = 'https://wa.me/5583993444383'
const SITE = 'https://www.aionedu.com.br'
const F = `'Helvetica Neue',Helvetica,Arial,sans-serif`
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const PASSOS: [string, string][] = [
  ['Você indica', 'Informe o nome e o WhatsApp do gestor de uma escola que ainda não usa a Áion Edu.'],
  ['Nós falamos com ele', 'Nossa equipe faz o contato e conta que foi você quem indicou.'],
  ['Você ganha', 'Quando a escola pagar a implantação, o prêmio é seu, por Pix.'],
]
const passo = (n: number, t: string, d: string) => `<tr><td valign="top" style="padding:0 14px 16px 0;width:34px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:32px;height:32px;background:#05907B;border-radius:10px;color:#FFFFFF;font-family:${F};font-size:15px;font-weight:800;">${n}</td></tr></table></td><td valign="top" style="padding:0 0 16px;font-family:${F};"><div style="font-size:15.5px;font-weight:800;color:#00382B;">${t}</div><div style="font-size:14px;color:#46605A;line-height:1.5;margin-top:2px;">${d}</div></td></tr>`
export const subject = (p: number) => `Indique uma escola e ganhe ${brl(p)}`
export const html = (nome: string, p: number) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#E6EFEB;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#E6EFEB;">Conhece o gestor de uma escola que ainda não usa a Áion Edu? Indique pelo sistema e receba por Pix.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E6EFEB;padding:20px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;">
<tr><td bgcolor="#003D2E" style="background:#003D2E;background-image:linear-gradient(135deg,#00523C 0%,#002A20 100%);padding:28px 32px 34px;font-family:${F};">
<img src="${SITE}/raiox/logo-branca.png" alt="Áion Edu" width="120" style="display:block;width:120px;height:auto;margin-bottom:30px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#19D3B5;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:800;letter-spacing:.06em;color:#00352A;">NOVO NA ÁION</td></tr></table>
<h1 style="margin:16px 0 12px;font-size:32px;line-height:1.15;color:#FFFFFF;font-weight:800;">Indique uma escola e ganhe ${brl(p)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#BFE8DF;">Conhece o gestor de uma escola que ainda não usa a Áion Edu? Indique pelo sistema, acompanhe cada passo e receba por Pix quando ela contratar.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#19D3B5;border-radius:12px;"><a href="${LINK}" style="display:inline-block;padding:15px 30px;font-family:${F};font-size:16px;font-weight:800;color:#00352A;text-decoration:none;">Indicar uma escola</a></td></tr></table>
</td></tr>
<tr><td style="padding:30px 32px 6px;font-family:${F};color:#1A2B4A;font-size:15.5px;line-height:1.6;">
<p style="margin:0 0 12px;font-size:17px;font-weight:700;color:#00382B;">Olá${nome ? `, ${nome}` : ''}!</p>
<p style="margin:0 0 18px;">Quem usa a Áion Edu conhece escolas que também precisam organizar a captação e a matrícula. Agora, cada indicação sua vale <b>${brl(p)}</b>, e qualquer pessoa da equipe da escola pode indicar.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${PASSOS.map(([t, d], i) => passo(i + 1, t, d)).join('')}</table>
</td></tr>
<tr><td style="padding:4px 32px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F8F5;border-left:4px solid #00A896;border-radius:10px;"><tr><td style="padding:14px 16px;font-family:${F};font-size:14px;line-height:1.55;color:#33504A;"><b style="color:#00382B;">Onde fica:</b> entre na Áion Edu e abra <b>Indique e ganhe</b> no menu. Lá você cadastra a sua chave Pix, indica e vê o andamento de cada indicação e quanto já tem a receber.</td></tr></table></td></tr>
<tr><td style="padding:22px 32px 8px;font-family:${F};color:#1A2B4A;font-size:14px;line-height:1.6;">
<p style="margin:0 0 20px;color:#46605A;">A indicação vale quando o gestor ainda não estava em contato com a Áion. O prêmio é liberado depois que a escola indicada paga a implantação.</p>
<p style="margin:0 0 0;font-size:15px;">Dúvidas? <a href="${WA}" style="color:#007D71;font-weight:800;">Fale com a Áion no WhatsApp</a>, (83) 99344-4383.</p>
<p style="margin:16px 0 26px;font-size:15px;">Um abraço,<br><b>Equipe Áion Soluções Tecnológicas</b></p>
</td></tr>
<tr><td bgcolor="#F4F8F6" align="center" style="background:#F4F8F6;padding:18px 28px;font-family:${F};font-size:12px;line-height:1.5;color:#6A817B;">Áion Soluções Tecnológicas · aionedu.com.br<br>Não quer receber novidades? Avise pelo WhatsApp e retiramos o seu e-mail.</td></tr>
</table></td></tr></table></body></html>`

async function brevo(key: string, to: string, name: string, p: number) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({ sender: { name: 'Áion Edu', email: 'noreply@aionedu.com.br' }, to: [{ email: to }], subject: subject(p), htmlContent: html(name, p), tags: [RELEASE] }),
  })
  if (!r.ok) throw new Error(`brevo ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

Deno.serve(async (req) => {
  let role = ''
  try { role = JSON.parse(atob((req.headers.get('authorization') || '').replace('Bearer ', '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role } catch { /* nada */ }
  if (role !== 'service_role') return new Response('forbidden', { status: 403 })
  const key = Deno.env.get('BREVO_API_KEY')
  if (!key) return new Response(JSON.stringify({ error: 'BREVO_API_KEY ausente' }), { status: 500 })
  const { mode, to } = await req.json().catch(() => ({})) as { mode?: string; to?: string }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cfg } = await admin.from('platform_settings').select('value').eq('key', 'referral_prize').maybeSingle()
  const prize = Number(cfg?.value) || 500
  if (mode === 'test') {
    if (!to) return new Response(JSON.stringify({ error: 'informe to' }), { status: 400 })
    await brevo(key, to, 'Victor', prize)
    return new Response(JSON.stringify({ ok: true, sent: 1, test: true }))
  }
  const { data, error } = await admin.from('users').select('email, full_name, active').eq('user_type', 'school_user').not('institution_id', 'is', null)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
  const rows = (data ?? []).filter((u: any) => u.active !== false)
  if (mode === 'count') return new Response(JSON.stringify({ ok: true, destinatarios: new Set(rows.map((u: any) => (u.email || '').trim().toLowerCase()).filter((e: string) => re.test(e))).size }))
  if (mode !== 'all') return new Response(JSON.stringify({ error: 'mode inválido' }), { status: 400 })
  const seen = new Set<string>(), res = { sent: 0, skipped: 0, failed: [] as string[] }
  for (const u of rows as any[]) {
    const email = (u.email || '').trim().toLowerCase()
    if (!re.test(email) || seen.has(email)) { res.skipped++; continue }
    seen.add(email)
    const { error: ins } = await admin.from('announcement_sends').insert({ release: RELEASE, email })
    if (ins) { res.skipped++; continue }
    try { await brevo(key, email, (u.full_name || '').trim().split(/\s+/)[0], prize); res.sent++ }
    catch (e) { res.failed.push(`${email}: ${(e as Error).message}`); await admin.from('announcement_sends').delete().eq('release', RELEASE).eq('email', email) }
  }
  return new Response(JSON.stringify({ ok: true, ...res }))
})
