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
<div class="b"><div style="text-align:center;padding:24px 0 16px;background:#ffffff"><img src="https://aionedu.com.br/aion-logo-full.png" alt="Aion Edu" style="height:40px;width:auto;object-fit:contain"/></div>${content}</div>
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

  new_institution: (d) => ({
    subject: `🎉 Bem-vindo à Áion Edu — ${d.institution_name}`,
    html: base(`
      <h2 style="color:#00523C">Sua escola foi cadastrada na Áion Edu! 🎉</h2>
      <p>Olá! A escola <strong>${d.institution_name}</strong> foi configurada com sucesso na plataforma Áion Edu.</p>
      <p style="margin-top:16px">Abaixo estão os dados de acesso da sua instituição:</p>
      <div class="m">
        <strong>${d.institution_name}</strong>
        <span>Instituição cadastrada na plataforma</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;color:#666;width:40%">Plataforma</td>
          <td style="padding:10px 0;font-weight:600;color:#111">Áion Edu</td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;color:#666">Link de acesso</td>
          <td style="padding:10px 0;font-weight:600;color:#00A896"><a href="https://aionedu.com.br/login" style="color:#00A896">aionedu.com.br/login</a></td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;color:#666">Suporte</td>
          <td style="padding:10px 0;font-weight:600;color:#111">contato@aionedu.com.br</td>
        </tr>
        ${d.consultant_name ? `<tr><td style="padding:10px 0;color:#666">Seu consultor</td><td style="padding:10px 0;font-weight:600;color:#111">${d.consultant_name}</td></tr>` : ''}
      </table>
      <p style="color:#666;font-size:13px">Seu consultor entrará em contato para iniciar a implantação e configuração completa da plataforma.</p>
      <div style="text-align:center">
        <a href="https://aionedu.com.br/login" class="btn">Acessar a plataforma →</a>
      </div>
      <p style="font-size:12px;color:#999;margin-top:24px">Dúvidas? Fale com nossa equipe pelo WhatsApp: (83) 98556-6393</p>
    `)
  }),

  user_welcome: (d) => ({
    subject: `👋 Bem-vindo à ${d.school_name} — Suas credenciais de acesso`,
    html: base(`
      <h2 style="color:#00523C">Bem-vindo, ${d.user_name}! 👋</h2>
      <p>Você foi cadastrado na plataforma <strong>Áion Edu</strong> pela escola <strong>${d.school_name}</strong>.</p>
      <p style="margin-top:16px">Suas credenciais de acesso:</p>
      <div class="m">
        <strong>${d.user_name}</strong>
        <span>${d.role_label} · ${d.school_name}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;color:#666;width:40%">E-mail</td>
          <td style="padding:10px 0;font-weight:600;color:#111">${d.user_email}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;color:#666">Senha temporária</td>
          <td style="padding:10px 0;font-weight:700;color:#00523C;font-size:16px;letter-spacing:1px">${d.temp_password}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#666">Perfil de acesso</td>
          <td style="padding:10px 0;font-weight:600;color:#111">${d.role_label}</td>
        </tr>
      </table>
      <p style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;color:#92400E">
        ⚠️ <strong>Recomendamos alterar sua senha</strong> no primeiro acesso. Acesse seu perfil após entrar na plataforma.
      </p>
      <div style="text-align:center;margin-top:24px">
        <a href="https://aionedu.com.br/login" class="btn">Acessar a plataforma →</a>
      </div>
      <p style="font-size:12px;color:#999;margin-top:24px">Dúvidas? Entre em contato com o administrador da sua escola ou com o suporte: contato@aionedu.com.br</p>
    `)
  }),

  payment_link: (d) => ({
    subject: `💳 Link de pagamento — ${d.institution_name}`,
    html: base(`
      <h2 style="color:#00523C">Olá, ${d.institution_name}! 👋</h2>
      <p>Sua taxa de implantação na plataforma Áion Edu está disponível para pagamento. Utilize o link abaixo para realizar o pagamento com segurança.</p>
      <div class="m">
        <strong>${d.value}</strong>
        <span>Taxa de implantação · Vencimento: ${d.due_date}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;color:#666;width:40%">Valor</td>
          <td style="padding:10px 0;font-weight:600;color:#111">${d.value}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;color:#666">Vencimento</td>
          <td style="padding:10px 0;font-weight:600;color:#111">${d.due_date}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;color:#666">Forma de pagamento</td>
          <td style="padding:10px 0;font-weight:600;color:#111">${d.billing_type}</td>
        </tr>
      </table>
      ${d.payment_link ? `<div style="text-align:center"><a href="${d.payment_link}" class="btn">Pagar agora →</a></div>` : ''}
      <p style="font-size:12px;color:#999;margin-top:24px">Dúvidas? Fale com nossa equipe pelo WhatsApp: (83) 98556-6393</p>
    `)
  }),

  contract_sign: (d) => ({
    subject: `📝 Contrato para assinatura — ${d.institution_name}`,
    html: base(`
      <h2 style="color:#00523C">Olá, ${d.signer_name || d.institution_name}! 📝</h2>
      <p>Seu contrato com a <strong>Áion Edu</strong> está disponível para assinatura digital. Por favor, clique no botão abaixo para revisar e assinar.</p>
      <div class="m">
        <strong>${d.institution_name}</strong>
        <span>Contrato de prestação de serviços</span>
      </div>
      <p style="color:#6B7280;font-size:13px">Após a assinatura, seu acesso à plataforma será liberado automaticamente.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${d.sign_url}" class="btn">Assinar contrato →</a>
      </div>
      <p style="font-size:12px;color:#999;margin-top:24px">Dúvidas? Fale com nossa equipe pelo WhatsApp: (83) 98556-6393</p>
    `)
  }),

  password_reset: (d) => ({
    subject: `🔐 Redefinição de senha — Áion Edu`,
    html: base(`
      <h2 style="color:#00523C">Redefinição de senha</h2>
      <p>Olá${d.user_name ? `, <strong>${d.user_name}</strong>` : ''}! Recebemos uma solicitação para redefinir a senha da sua conta na Áion Edu.</p>
      <p style="margin-top:16px;color:#6B7280">Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>1 hora</strong>.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${d.reset_url}" class="btn">Redefinir minha senha →</a>
      </div>
      <p style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;color:#92400E">
        ⚠️ Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanecerá a mesma.
      </p>
      <p style="font-size:12px;color:#999;margin-top:24px">Por segurança, nunca compartilhe este link com ninguém. A equipe Áion Edu jamais solicitará sua senha.</p>
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
