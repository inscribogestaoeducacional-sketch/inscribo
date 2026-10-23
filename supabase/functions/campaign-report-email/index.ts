// @ts-nocheck
// Envia por e-mail o link do relatório mensal da Campanha de Matrículas.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const F = `'Helvetica Neue',Helvetica,Arial,sans-serif`
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { to, school_name, month_label, link, resumo, novos, rematriculas } = await req.json()
    if (!to || !link) throw new Error('to e link são obrigatórios')
    if (!BREVO_KEY) throw new Error('BREVO_API_KEY não configurada')
    if (!/^https:\/\/[^\s]+$/.test(link)) throw new Error('link inválido')
    const html = `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#F0F4F8;font-family:${F};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#00523C,#00A896);border-radius:16px 16px 0 0;padding:28px 36px;color:#fff;">
<div style="font-size:12px;font-weight:700;opacity:.85;letter-spacing:.5px;">CAMPANHA DE MATRÍCULAS</div>
<div style="font-size:24px;font-weight:800;margin-top:4px;">Relatório de ${esc(month_label)}</div></td></tr>
<tr><td style="background:#fff;padding:32px 36px;border:1px solid #E2E8F0;border-top:0;">
<p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 18px;">O relatório do mês da Campanha de Matrículas de <strong>${esc(school_name)}</strong> está pronto: números contra a meta, compensação, funil, investimento e próximos passos.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;"><tr><td style="padding:16px 20px;font-size:14px;color:#166534;line-height:1.9;">
Alunos novos no mês: <strong>${esc(novos)}</strong><br>Rematrículas no mês: <strong>${esc(rematriculas)}</strong></td></tr></table>
${resumo ? `<p style="color:#475569;font-size:14.5px;line-height:1.7;margin:18px 0 0;">${esc(resumo)}</p>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 8px;"><tr><td style="background:#00A896;border-radius:10px;"><a href="${esc(link)}" style="display:inline-block;padding:14px 34px;color:#fff;font-size:16px;font-weight:700;text-decoration:none;">Abrir o relatório completo</a></td></tr></table>
<p style="color:#94A3B8;font-size:12.5px;text-align:center;margin:12px 0 0;">Para abrir é preciso estar logado no sistema.</p>
</td></tr>
<tr><td style="background:#1A2B4A;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;color:rgba(255,255,255,.6);font-size:12px;">Aion Soluções Tecnológicas LTDA · Patos/PB</td></tr>
</table></td></tr></table></body></html>`
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({ sender: { name: 'Aion Edu', email: 'noreply@aionedu.com.br' }, to: [{ email: to }], subject: `Relatório de ${month_label} da Campanha de Matrículas - ${school_name}`, htmlContent: html }),
    })
    const b = await r.json()
    if (!r.ok) throw new Error(b?.message || `Erro Brevo ${r.status}`)
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
