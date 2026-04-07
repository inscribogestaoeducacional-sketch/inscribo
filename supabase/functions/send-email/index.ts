// @ts-nocheck — Deno runtime (não é Node.js; erros de tipo são esperados no editor)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')

const base = (content: string) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,sans-serif;margin:0;background:#f5f5f5}
.c{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
.h{background:linear-gradient(135deg,#00523C,#00A896);padding:32px 40px;text-align:center}
.h h1{color:#fff;margin:0;font-size:22px}.h p{color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px}
.b{padding:40px}.btn{display:inline-block;background:#00A896;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:24px 0}
.m{background:#f0faf8;border-left:4px solid #00A896;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0}
.m strong{display:block;font-size:22px;color:#00523C}.m span{font-size:13px;color:#666}
.f{background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #eee}
.f p{color:#999;font-size:12px;margin:4px 0}.f a{color:#00A896;text-decoration:none}
</style></head><body><div class="c">
<div class="h"><h1>Áion Edu</h1><p>Inteligência em matrículas</p></div>
<div class="b">${content}</div>
<div class="f"><p>© 2026 Áion Edu · <a href="https://aionedu.com.br">aionedu.com.br</a></p>
<p><a href="https://aionedu.com.br/privacidade">Privacidade</a> · <a href="https://aionedu.com.br/termos">Termos</a></p>
</div></div></body></html>`

const templates: Record<string, (d: any) => { subject: string; html: string }> = {

  welcome: (d) => ({
    subject: `Bem-vindo à Áion Edu, ${d.school_name}!`,
    html: base(`
      <h2 style="color:#00523C">Bem-vindo, ${d.school_name}! 🎉</h2>
      <p>Sua escola está configurada. Agora você tem acesso à inteligência da Áion Edu para a campanha de matrículas ${d.year}.</p>
      <div class="m"><strong>${d.total_students} alunos</strong><span>histórico importado com sucesso</span></div>
      <p><strong>Próximos passos:</strong></p>
      <ol>
        <li>Explore os relatórios históricos da sua escola</li>
        <li>Aguarde a liberação do Gerador de Campanha pelo seu consultor</li>
        <li>Configure o WhatsApp Business da escola</li>
      </ol>
      <div style="text-align:center">
        <a href="https://aionedu.com.br/home" class="btn">Acessar meu painel →</a>
      </div>
    `)
  }),

  campaign_ready: (d) => ({
    subject: `🚀 Sua campanha ${d.year} foi liberada — ${d.school_name}`,
    html: base(`
      <h2 style="color:#00523C">Sua campanha ${d.year} está liberada!</h2>
      <p>Seu consultor liberou o Gerador de Campanha. Você já pode criar seu plano de matrículas para o ano letivo ${d.year}.</p>
      <div class="m">
        <strong>Agosto/${new Date().getFullYear()}</strong>
        <span>início sugerido da campanha</span>
      </div>
      <p>A IA vai gerar metas mensais, CPA sugerido e calendário de captação personalizado para ${d.school_name} com base no seu histórico real.</p>
      <div style="text-align:center">
        <a href="https://aionedu.com.br/relatorios" class="btn">Gerar meu plano de campanha →</a>
      </div>
    `)
  }),

}

const CORS = {
  'Access-Control-Allow-Origin': 'https://aionedu.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { type, to, data } = await req.json()
    const template = templates[type]
    if (!template) return new Response('Template não encontrado', { status: 400, headers: CORS })

    const { subject, html } = template(data)

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Áion Edu', email: 'noreply@aionedu.com.br' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
      status: res.ok ? 200 : 400,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: CORS,
    })
  }
})
