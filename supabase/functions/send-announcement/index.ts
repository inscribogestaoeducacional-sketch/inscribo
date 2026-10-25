// Envia o comunicado "A Áion está de cara nova" por e-mail (Brevo) para os usuários das escolas.
// Só aceita a chave de serviço do projeto (chamada pelo banco). modo "test": envia só para o endereço informado. modo "all": envia uma vez por e-mail
// (a tabela announcement_sends impede repetição).
import { createClient } from 'npm:@supabase/supabase-js@2'

const RELEASE = 'cara-nova-2026-10'
const SUBJECT = 'A Áion está de cara nova (e agora cabe no seu bolso)'
const LOGIN = 'https://aionedu.com.br/login'
const WA = 'https://wa.me/5583985556393'
const F = `'Helvetica Neue',Helvetica,Arial,sans-serif`

const li = (t: string) => `<li style="margin:0 0 9px;">${t}</li>`
const h2 = (t: string) => `<p style="margin:22px 0 8px;font-size:13px;font-weight:800;letter-spacing:.08em;color:#00523C;">${t}</p>`
const html = (nome: string) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:${F};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#00523C;padding:22px 28px;"><img src="https://www.aionedu.com.br/aion-logo-full.png" alt="Áion Edu" height="34" style="display:block;height:34px;"></td></tr>
<tr><td style="padding:28px 28px 8px;color:#1A2B4A;font-size:15px;line-height:1.55;">
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#00523C;">A Áion está de cara nova</h1>
<p style="margin:0 0 12px;">Olá${nome ? `, ${nome}` : ''}!</p>
<p style="margin:0 0 12px;">Vocês pediram, a gente ouviu: a Áion Edu agora funciona de verdade no celular, com um visual novo, mais simples e rápido, e com ajuda sempre à mão.</p>
${h2('O QUE MUDOU')}
<ul style="margin:0;padding-left:20px;">
${li('<b>Celular de verdade:</b> todas as telas foram refeitas para o celular. Você atende, agenda visitas, vê leads e acompanha a campanha com uma mão só.')}
${li('<b>Leads:</b> botão "Novo lead" no topo, filtros em cartão e destaque para as famílias que estão esperando resposta.')}
${li('<b>Contatos:</b> ficha em tela cheia e "Revisar duplicados" para juntar contatos repetidos com segurança.')}
${li('<b>Visitas e WhatsApp:</b> agenda no padrão novo e mensagens com fotos, localização, contatos, edições e apagadas aparecendo corretamente.')}
${li('<b>Transmissões, Base de alunos e Campanha:</b> envios em massa, visão por série, conferência e números da campanha organizados.')}
${li('<b>Pesquisas, Usuários e Configurações:</b> refeitas, inclusive a pesquisa de satisfação dos colaboradores.')}
</ul>
${h2('NOVIDADES QUE VOCÊ VAI GOSTAR')}
<ul style="margin:0;padding-left:20px;">
${li('<b>Avisos no celular:</b> receba na hora quando entrar um lead novo, quando uma família estiver esperando resposta e quando houver visita marcada.')}
${li('<b>Instale a Áion no celular:</b> é só abrir o sistema pelo navegador e seguir o passo a passo que aparece na tela. Fica como um aplicativo, com ícone na tela inicial.')}
${li('<b>Academia Áion Edu:</b> aulas curtas e o botão "Fazer comigo", que mostra na tela, passo a passo, onde clicar.')}
${li('<b>Ajuda com IA:</b> toque no "?" no topo e converse com a assistente da Áion. Ela tira dúvidas, explica o passo a passo e, se precisar, chama a nossa equipe.')}
${li('<b>Integrações:</b> agora a Áion se integra com o Activesoft, e outras integrações virão em seguida. Se a sua escola usa outro sistema, nos conte qual: assim a gente prioriza o seu.')}
</ul>
${h2('COMO ENTRAR')}
<p style="margin:0 0 16px;">Acesse com o seu e-mail e senha de sempre. Na primeira vez, vai aparecer uma tela rápida com as novidades: é só passar pelos passos e tocar em "Estou ciente".</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:#00A896;border-radius:12px;"><a href="${LOGIN}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:800;font-size:15px;text-decoration:none;">Entrar na Áion</a></td></tr></table>
<p style="margin:0 0 12px;">Precisa de ajuda? Toque no "?" dentro do sistema ou <a href="${WA}" style="color:#00A896;font-weight:700;">fale com a gente pelo WhatsApp</a>.</p>
<p style="margin:0 0 12px;">A Áion veio para ajudar a tornar a vida do gestor mais fácil. Continuem falando com a gente: cada sugestão de vocês vira melhoria.</p>
<p style="margin:0 0 24px;">Um abraço,<br>Equipe Áion Soluções Tecnológicas</p>
</td></tr>
<tr><td style="background:#F8FAFC;padding:16px 28px;color:#64748B;font-size:12px;text-align:center;">Áion Soluções Tecnológicas · aionedu.com.br</td></tr>
</table></td></tr></table></body></html>`

async function brevo(key: string, to: string, name: string) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({ sender: { name: 'Áion Edu', email: 'noreply@aionedu.com.br' }, to: [{ email: to }], subject: SUBJECT, htmlContent: html(name), tags: ['cara-nova'] }),
  })
  if (!r.ok) throw new Error(`brevo ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

Deno.serve(async (req) => {
  // só quem tem a chave de serviço (o banco) pode disparar
  // (o gateway já conferiu a assinatura do JWT; aqui exigimos que seja o papel service_role)
  let role = ''
  try { role = JSON.parse(atob((req.headers.get('authorization') || '').replace('Bearer ', '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role } catch { /* nada */ }
  if (role !== 'service_role') return new Response('forbidden', { status: 403 })
  const key = Deno.env.get('BREVO_API_KEY')
  if (!key) return new Response(JSON.stringify({ error: 'BREVO_API_KEY ausente' }), { status: 500 })
  const { mode, to } = await req.json().catch(() => ({})) as { mode?: string; to?: string }
  if (mode === 'test') {
    if (!to) return new Response(JSON.stringify({ error: 'informe to' }), { status: 400 })
    await brevo(key, to, 'Victor')
    return new Response(JSON.stringify({ ok: true, sent: 1, test: true }))
  }
  if (mode !== 'all') return new Response(JSON.stringify({ error: 'mode inválido' }), { status: 400 })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: users, error } = await admin.from('users').select('email, full_name, active').eq('user_type', 'school_user').not('institution_id', 'is', null)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  const seen = new Set<string>(), results = { sent: 0, skipped: 0, failed: [] as string[] }
  for (const u of (users ?? []) as { email: string | null; full_name: string | null; active: boolean | null }[]) {
    const email = (u.email || '').trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || u.active === false || seen.has(email)) { results.skipped++; continue }
    seen.add(email)
    // reserva o envio antes (não repete se rodar de novo)
    const { error: ins } = await admin.from('announcement_sends').insert({ release: RELEASE, email })
    if (ins) { results.skipped++; continue }
    try { await brevo(key, email, (u.full_name || '').trim().split(/\s+/)[0]); results.sent++ }
    catch (e) { results.failed.push(`${email}: ${(e as Error).message}`); await admin.from('announcement_sends').delete().eq('release', RELEASE).eq('email', email) }
  }
  return new Response(JSON.stringify({ ok: true, ...results }))
})
