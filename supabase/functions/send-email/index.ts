// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')
const FROM_EMAIL = 'noreply@aionedu.com.br'
const FROM_NAME = 'Áion Edu'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const header = `
  <div style="background:linear-gradient(135deg,#00523C,#00A896);padding:36px 32px;text-align:center">
    <span style="font-size:32px;font-weight:900;color:#fff;font-family:Arial,sans-serif">Á</span>
    <h1 style="color:#fff;margin:8px 0 0;font-size:22px;font-weight:800;font-family:Arial,sans-serif">Áion Edu</h1>
    <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;font-family:Arial,sans-serif">Sistema de Gestão Educacional</p>
  </div>
`

const footer = `
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center">
    <p style="color:#94A3B8;font-size:12px;margin:0;font-family:Arial,sans-serif">
      Áion Soluções Tecnológicas LTDA · CNPJ: 65.835.064/0001-58<br>
      Dúvidas? <strong>(83) 98556-6393</strong> · contato@aionedu.com.br
    </p>
  </div>
`

const wrap = (content: string) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    ${header}
    <div style="padding:36px 32px">${content}</div>
    ${footer}
  </div>
`

const templates: Record<string, (data: any) => { subject: string; html: string }> = {

  new_institution: (data) => ({
    subject: `✅ Sua conta está ativa — Bem-vindo ao Áion Edu!`,
    html: wrap(`
      <h2 style="color:#1A2B4A;font-size:20px;margin:0 0 16px">🎉 Sua conta está ativa!</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px">
        Olá! O pagamento da implantação de <strong>${data.institution_name}</strong> foi confirmado e sua conta já está liberada para acesso.
      </p>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#166534;font-weight:700;margin:0 0 10px">✅ O que você pode fazer agora:</p>
        <ul style="color:#15803D;margin:0;padding-left:20px;line-height:2.2">
          <li>Acessar o painel de gestão</li>
          <li>Cadastrar sua equipe</li>
          <li>Configurar o WhatsApp Business</li>
          <li>Criar sua primeira campanha de matrícula</li>
        </ul>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.login_url || 'https://app.aionedu.com.br/login'}"
           style="display:inline-block;background:linear-gradient(135deg,#00523C,#00A896);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px">
          Acessar o sistema →
        </a>
      </div>
    `)
  }),

  payment_link: (data) => ({
    subject: `💳 Link de pagamento — Implantação ${data.institution_name}`,
    html: wrap(`
      <h2 style="color:#1A2B4A;font-size:20px;margin:0 0 16px">Pagamento da implantação</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px">
        Olá! Sua escola <strong>${data.institution_name}</strong> foi cadastrada no sistema Áion Edu.
        Para ativar o acesso, realize o pagamento da taxa de implantação.
      </p>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#92400E;font-weight:700;margin:0 0 10px">📋 Detalhes do pagamento:</p>
        <p style="color:#78350F;margin:6px 0">💰 Valor: <strong>R$ ${data.value}</strong></p>
        <p style="color:#78350F;margin:6px 0">📅 Vencimento: <strong>${data.due_date}</strong></p>
        <p style="color:#78350F;margin:6px 0">💳 Forma: <strong>${data.billing_type || 'PIX/Boleto'}</strong></p>
      </div>
      ${data.payment_link ? `
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.payment_link}"
           style="display:inline-block;background:linear-gradient(135deg,#D97706,#F59E0B);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px">
          💳 Pagar agora →
        </a>
      </div>
      ` : ''}
      <p style="color:#475569;font-size:13px;line-height:1.6;margin:0">
        Após a confirmação do pagamento, você receberá os dados de acesso ao sistema por e-mail.
      </p>
    `)
  }),

  contract_sign: (data) => ({
    subject: `📝 Contrato para assinatura — ${data.institution_name}`,
    html: wrap(`
      <h2 style="color:#1A2B4A;font-size:20px;margin:0 0 16px">Contrato de prestação de serviços</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px">
        Olá, <strong>${data.signer_name}</strong>!<br>
        Segue o contrato da escola <strong>${data.institution_name}</strong> para assinatura digital.
      </p>
      <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#3730A3;font-weight:700;margin:0 0 8px">📋 Informações do contrato:</p>
        <p style="color:#4338CA;margin:4px 0">O documento tem validade jurídica e usa assinatura digital certificada.</p>
      </div>
      ${data.sign_url ? `
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.sign_url}"
           style="display:inline-block;background:linear-gradient(135deg,#6366F1,#7C3AED);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px">
          📝 Assinar contrato →
        </a>
      </div>
      ` : ''}
    `)
  }),

  suspended: (data) => ({
    subject: `⚠️ Acesso suspenso — ${data.institution_name}`,
    html: wrap(`
      <h2 style="color:#DC2626;font-size:20px;margin:0 0 16px">⚠️ Acesso suspenso</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px">
        Olá! O acesso da escola <strong>${data.institution_name}</strong> foi suspenso por falta de pagamento
        ${data.dias_atraso && data.dias_atraso !== '0' ? `(${data.dias_atraso} dias em atraso)` : ''}.
      </p>
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#991B1B;font-weight:700;margin:0 0 8px">Para reativar o acesso:</p>
        <p style="color:#B91C1C;margin:4px 0">Regularize o pagamento pendente e entre em contato com seu consultor.</p>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="https://wa.me/5583985556393"
           style="display:inline-block;background:linear-gradient(135deg,#16A34A,#15803D);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px">
          💬 Falar com suporte
        </a>
      </div>
    `)
  }),

  reactivated: (data) => ({
    subject: `✅ Acesso reativado — ${data.institution_name}`,
    html: wrap(`
      <h2 style="color:#16A34A;font-size:20px;margin:0 0 16px">✅ Acesso reativado!</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px">
        Olá! O acesso da escola <strong>${data.institution_name}</strong> foi reativado com sucesso.
      </p>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#166534;font-weight:700;margin:0 0 8px">✅ Seu acesso está liberado!</p>
        <p style="color:#15803D;margin:4px 0">Acesse o sistema normalmente com suas credenciais.</p>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.link_acesso || 'https://app.aionedu.com.br/login'}"
           style="display:inline-block;background:linear-gradient(135deg,#00523C,#00A896);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px">
          Acessar o sistema →
        </a>
      </div>
    `)
  }),

  overdue_1: (data) => ({
    subject: `⚠️ Pagamento em atraso — ${data.institution_name}`,
    html: wrap(`
      <h2 style="color:#D97706;font-size:20px;margin:0 0 16px">⚠️ Lembrete de pagamento</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px">
        Olá! Identificamos que a mensalidade da escola <strong>${data.institution_name}</strong>
        está com <strong>${data.dias_atraso} dias</strong> de atraso.
      </p>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#92400E;margin:0">Para evitar a suspensão do sistema, realize o pagamento o quanto antes.</p>
      </div>
      ${data.payment_link ? `
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.payment_link}"
           style="display:inline-block;background:linear-gradient(135deg,#D97706,#F59E0B);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px">
          💳 Pagar agora →
        </a>
      </div>
      ` : ''}
    `)
  }),

  overdue_2: (data) => ({
    subject: `🔴 Urgente — Pagamento em atraso ${data.institution_name}`,
    html: wrap(`
      <h2 style="color:#DC2626;font-size:20px;margin:0 0 16px">🔴 2º aviso — Pagamento urgente</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px">
        Olá! A mensalidade da escola <strong>${data.institution_name}</strong> está com
        <strong>${data.dias_atraso} dias</strong> de atraso. Regularize imediatamente para evitar a suspensão.
      </p>
      ${data.payment_link ? `
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.payment_link}"
           style="display:inline-block;background:linear-gradient(135deg,#DC2626,#B91C1C);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px">
          💳 Regularizar agora →
        </a>
      </div>
      ` : ''}
    `)
  }),

  overdue_3: (data) => ({
    subject: `🚨 Aviso de suspensão — ${data.institution_name}`,
    html: wrap(`
      <h2 style="color:#DC2626;font-size:20px;margin:0 0 16px">🚨 Aviso final antes da suspensão</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px">
        Olá! O acesso da escola <strong>${data.institution_name}</strong> será suspenso em
        <strong>${data.data_suspensao || 'breve'}</strong> por falta de pagamento.
      </p>
      ${data.payment_link ? `
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.payment_link}"
           style="display:inline-block;background:linear-gradient(135deg,#DC2626,#B91C1C);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px">
          💳 Evitar suspensão →
        </a>
      </div>
      ` : ''}
    `)
  }),

}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { type, to, data } = await req.json()

    if (!type || !to) throw new Error('type e to são obrigatórios')
    if (!BREVO_KEY) throw new Error('BREVO_API_KEY não configurada nos secrets do Supabase')

    const template = templates[type]
    if (!template) throw new Error(`Template "${type}" não encontrado. Templates disponíveis: ${Object.keys(templates).join(', ')}`)

    const { subject, html } = template(data || {})

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY,
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })

    const resBody = await res.json()

    if (!res.ok) {
      console.error('[send-email] brevo error:', JSON.stringify(resBody))
      throw new Error(resBody?.message || `Erro Brevo: ${res.status}`)
    }

    console.log('[send-email] enviado para:', to, 'tipo:', type)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[send-email] erro:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS
    })
  }
})
