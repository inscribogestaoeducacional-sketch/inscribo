// Avisa por e-mail quando o WhatsApp de uma escola cai (chamado pelo banco: whatsapp_alert_owner).
// verify_jwt ligado: o banco chama com a chave de serviço.
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const key = Deno.env.get('BREVO_API_KEY')
  if (!key) return new Response(JSON.stringify({ error: 'BREVO_API_KEY ausente' }), { status: 500 })
  const { to, school, phone, status, minutes, repeat } = await req.json()
  if (!to) return new Response(JSON.stringify({ error: 'to obrigatório' }), { status: 400 })
  const subject = `${repeat ? 'Ainda desconectado' : 'WhatsApp caiu'} — ${school || 'escola'}`
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1A2B4A">
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:20px">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#B91C1C">${repeat ? 'Continua sem conexão' : 'WhatsApp desconectado'}</p>
      <h1 style="margin:0 0 10px;font-size:20px">${esc(school || 'Escola')}</h1>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6">O número <b>${esc(phone)}</b> está <b>${esc(status)}</b> na Meta${minutes > 0 ? ` há ${esc(minutes)} minutos` : ''}.</p>
      <p style="margin:0;font-size:15px;line-height:1.6">A escola não envia nem recebe mensagens até reconectar.</p>
    </div>
    <p style="font-size:14px;line-height:1.6;margin:18px 0 0">Veja em <b>Super Admin &rarr; Escolas &rarr; aba WhatsApp</b> e use &ldquo;Testar conex&atilde;o&rdquo;. Se o aviso continuar, repetimos a cada 30 minutos.</p>
    <p style="font-size:12px;color:#94A3B8;margin-top:18px">Aion Edu &middot; monitor de conex&atilde;o</p></div>`
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({ sender: { name: 'Aion Edu', email: 'noreply@aionedu.com.br' }, to: [{ email: to }], subject, htmlContent: html }),
  })
  return new Response(JSON.stringify({ ok: r.ok }), { status: r.ok ? 200 : 502, headers: { 'content-type': 'application/json' } })
})
