// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')
const FROM_EMAIL = 'noreply@aionedu.com.br'
const FROM_NAME = 'Áion Edu'
const LOGO_URL = 'https://www.aionedu.com.br/aion-logo-full.png'
const SUPPORT_PHONE = '(83) 98556-6393'
const SUPPORT_WA = 'https://wa.me/5583985556393'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const wrap = (content: string, preheader = '') => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Áion Edu</title>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#00523C 0%,#00A896 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="Áion Edu" height="48" style="display:block;margin:0 auto;filter:brightness(0) invert(1);" />
              <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:13px;letter-spacing:0.5px;">Sistema de Gestão Educacional</p>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#1A2B4A;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
              <p style="color:rgba(255,255,255,0.9);font-size:13px;margin:0 0 8px;font-weight:600;">Áion Soluções Tecnológicas LTDA</p>
              <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0 0 16px;">CNPJ: 65.835.064/0001-58 · Patos/PB</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:0 8px;">
                    <a href="mailto:contato@aionedu.com.br" style="color:rgba(255,255,255,0.7);font-size:12px;text-decoration:none;">contato@aionedu.com.br</a>
                  </td>
                  <td style="color:rgba(255,255,255,0.3);font-size:12px;">|</td>
                  <td style="padding:0 8px;">
                    <a href="${SUPPORT_WA}" style="color:rgba(255,255,255,0.7);font-size:12px;text-decoration:none;">${SUPPORT_PHONE}</a>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:16px 0 0;">© ${new Date().getFullYear()} Áion Edu · Todos os direitos reservados</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

const btn = (text: string, url: string, color = '#00A896') => `
  <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr>
      <td style="background:${color};border-radius:12px;">
        <a href="${url}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">${text}</a>
      </td>
    </tr>
  </table>
`

const badge = (text: string, color = '#00A896') => `
  <span style="display:inline-block;background:${color}18;color:${color};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid ${color}40;">${text}</span>
`

const infoBox = (content: string, bgColor = '#F0FDF4', borderColor = '#BBF7D0', textColor = '#166534') => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:20px;">
        <p style="color:${textColor};margin:0;font-size:14px;line-height:1.7;">${content}</p>
      </td>
    </tr>
  </table>
`

const divider = () => `<hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">`

const templates: Record<string, (data: any) => { subject: string; html: string }> = {

  new_institution: (data) => ({
    subject: `🎉 Conta ativa — Bem-vindo ao Áion Edu, ${data.institution_name}!`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('✅ Acesso liberado', '#16A34A')}</p>
      <h1 style="color:#1A2B4A;font-size:24px;font-weight:800;margin:16px 0 8px;">Sua conta está ativa!</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá! O pagamento da implantação de <strong>${data.institution_name}</strong> foi confirmado
        e sua conta já está liberada para acesso completo ao sistema.
      </p>
      ${infoBox(`
        <strong style="color:#166534;display:block;margin-bottom:12px;">✅ O que você pode fazer agora:</strong>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;color:#15803D;">📊 &nbsp;Acessar o painel de gestão</td></tr>
          <tr><td style="padding:4px 0;color:#15803D;">👥 &nbsp;Cadastrar sua equipe</td></tr>
          <tr><td style="padding:4px 0;color:#15803D;">💬 &nbsp;Configurar o WhatsApp Business</td></tr>
          <tr><td style="padding:4px 0;color:#15803D;">🎯 &nbsp;Criar sua primeira campanha de matrícula</td></tr>
        </table>
      `)}
      ${btn('Acessar o sistema →', data.login_url || 'https://app.aionedu.com.br/login')}
      ${divider()}
      <p style="color:#94A3B8;font-size:13px;text-align:center;margin:0;">
        Seu consultor entrará em contato para agendar o kickoff de implantação.<br>
        Dúvidas? <a href="${SUPPORT_WA}" style="color:#00A896;text-decoration:none;font-weight:600;">Fale conosco via WhatsApp</a>
      </p>
    `, 'Sua conta Áion Edu está ativa! Acesse agora.')
  }),

  payment_link: (data) => ({
    subject: `💳 Link de pagamento — ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('💳 Pagamento pendente', '#D97706')}</p>
      <h1 style="color:#1A2B4A;font-size:24px;font-weight:800;margin:16px 0 8px;">Taxa de implantação</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá! Sua escola <strong>${data.institution_name}</strong> foi cadastrada no sistema Áion Edu.
        Para liberar o acesso completo, realize o pagamento da taxa de implantação.
      </p>
      ${infoBox(`
        <strong style="color:#92400E;display:block;margin-bottom:12px;">📋 Detalhes do pagamento:</strong>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:6px 0;color:#78350F;font-size:14px;">💰 Valor</td>
            <td style="padding:6px 0;color:#78350F;font-size:14px;font-weight:700;text-align:right;">R$ ${data.value}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#78350F;font-size:14px;">📅 Vencimento</td>
            <td style="padding:6px 0;color:#78350F;font-size:14px;font-weight:700;text-align:right;">${data.due_date}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#78350F;font-size:14px;">💳 Forma</td>
            <td style="padding:6px 0;color:#78350F;font-size:14px;font-weight:700;text-align:right;">${data.billing_type || 'PIX / Boleto'}</td>
          </tr>
        </table>
      `, '#FFFBEB', '#FDE68A', '#92400E')}
      ${data.payment_link ? btn('💳 Pagar agora →', data.payment_link, '#D97706') : ''}
      <p style="color:#475569;font-size:13px;line-height:1.6;text-align:center;margin:0;">
        Após a confirmação, você receberá os dados de acesso por e-mail.<br>
        <a href="${SUPPORT_WA}" style="color:#00A896;text-decoration:none;font-weight:600;">Dúvidas? Fale com seu consultor</a>
      </p>
    `, 'Pague a implantação e libere o acesso ao Áion Edu.')
  }),

  monthly_payment: (data) => ({
    subject: `💳 Mensalidade disponível — ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('💳 Mensalidade', '#D97706')}</p>
      <h1 style="color:#1A2B4A;font-size:24px;font-weight:800;margin:16px 0 8px;">Link de pagamento disponível</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá! O link de pagamento da mensalidade de <strong>${data.institution_name}</strong> já está disponível.
      </p>
      ${infoBox(`
        <strong style="color:#92400E;display:block;margin-bottom:12px;">📋 Detalhes:</strong>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:5px 0;color:#78350F;font-size:14px;">📄 Referência</td>
            <td style="padding:5px 0;color:#78350F;font-size:14px;font-weight:700;text-align:right;">${data.description || 'Mensalidade'}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#78350F;font-size:14px;">💰 Valor</td>
            <td style="padding:5px 0;color:#78350F;font-size:14px;font-weight:700;text-align:right;">R$ ${data.value}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#78350F;font-size:14px;">📅 Vencimento</td>
            <td style="padding:5px 0;color:#78350F;font-size:14px;font-weight:700;text-align:right;">${data.due_date}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#78350F;font-size:14px;">💳 Forma</td>
            <td style="padding:5px 0;color:#78350F;font-size:14px;font-weight:700;text-align:right;">${data.billing_type || 'PIX / Boleto'}</td>
          </tr>
        </table>
      `, '#FFFBEB', '#FDE68A', '#92400E')}
      ${data.payment_link ? btn('💳 Pagar mensalidade →', data.payment_link, '#D97706') : ''}
      <p style="color:#475569;font-size:13px;line-height:1.6;text-align:center;margin:0;">
        Após o pagamento, o status será atualizado automaticamente no sistema.<br>
        <a href="${SUPPORT_WA}" style="color:#00A896;text-decoration:none;font-weight:600;">Dúvidas? Fale com seu consultor</a>
      </p>
    `, `Mensalidade disponível — ${data.institution_name}`)
  }),

  contract_sign: (data) => ({
    subject: `📝 Contrato para assinatura — ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('📝 Assinatura necessária', '#6366F1')}</p>
      <h1 style="color:#1A2B4A;font-size:24px;font-weight:800;margin:16px 0 8px;">Contrato de prestação de serviços</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá, <strong>${data.signer_name}</strong>!<br>
        Segue o contrato da escola <strong>${data.institution_name}</strong> para assinatura digital com validade jurídica.
      </p>
      ${infoBox(`
        <strong style="color:#3730A3;display:block;margin-bottom:8px;">🔒 Assinatura digital certificada</strong>
        <span style="color:#4338CA;font-size:13px;">O documento possui validade jurídica e é processado pela plataforma Autentique, certificada pelo ICP-Brasil.</span>
      `, '#EEF2FF', '#C7D2FE', '#3730A3')}
      ${data.sign_url ? btn('📝 Assinar contrato →', data.sign_url, '#6366F1') : ''}
      <p style="color:#94A3B8;font-size:13px;text-align:center;margin:0;">
        Dúvidas sobre o contrato? <a href="${SUPPORT_WA}" style="color:#00A896;text-decoration:none;font-weight:600;">Fale conosco</a>
      </p>
    `, 'Assine seu contrato Áion Edu com validade jurídica.')
  }),

  suspended: (data) => ({
    subject: `⚠️ Acesso suspenso — ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('⚠️ Acesso suspenso', '#DC2626')}</p>
      <h1 style="color:#DC2626;font-size:24px;font-weight:800;margin:16px 0 8px;">Acesso temporariamente suspenso</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá! O acesso da escola <strong>${data.institution_name}</strong> foi suspenso por falta de pagamento
        ${data.dias_atraso && data.dias_atraso !== '0' ? `(${data.dias_atraso} dias em atraso)` : ''}.
      </p>
      ${infoBox(`
        <strong style="color:#991B1B;display:block;margin-bottom:8px;">Para reativar o acesso:</strong>
        <span style="color:#B91C1C;font-size:14px;">Regularize o pagamento pendente e entre em contato com seu consultor para reativação imediata.</span>
      `, '#FEF2F2', '#FECACA', '#991B1B')}
      ${btn('💬 Falar com suporte', SUPPORT_WA, '#DC2626')}
    `, 'Seu acesso foi suspenso. Regularize para reativar.')
  }),

  reactivated: (data) => ({
    subject: `✅ Acesso reativado — ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('✅ Acesso reativado', '#16A34A')}</p>
      <h1 style="color:#16A34A;font-size:24px;font-weight:800;margin:16px 0 8px;">Acesso reativado com sucesso!</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá! O acesso da escola <strong>${data.institution_name}</strong> foi reativado.
        Você já pode acessar o sistema normalmente.
      </p>
      ${infoBox(`
        <strong style="color:#166534;display:block;margin-bottom:8px;">✅ Tudo certo!</strong>
        <span style="color:#15803D;font-size:14px;">Seu pagamento foi confirmado e o acesso está liberado. Bem-vindo de volta!</span>
      `)}
      ${btn('Acessar o sistema →', data.link_acesso || 'https://app.aionedu.com.br/login')}
    `, 'Seu acesso ao Áion Edu foi reativado!')
  }),

  overdue_1: (data) => ({
    subject: `⚠️ Lembrete — Pagamento em atraso · ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('⚠️ Pagamento em atraso', '#D97706')}</p>
      <h1 style="color:#D97706;font-size:24px;font-weight:800;margin:16px 0 8px;">Lembrete de pagamento</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá! Identificamos que a mensalidade da escola <strong>${data.institution_name}</strong>
        está com <strong>${data.dias_atraso} dias</strong> de atraso.
      </p>
      ${infoBox(`
        <span style="color:#92400E;font-size:14px;">Para evitar a suspensão do sistema, regularize o pagamento o quanto antes.</span>
      `, '#FFFBEB', '#FDE68A', '#92400E')}
      ${data.payment_link ? btn('💳 Pagar agora →', data.payment_link, '#D97706') : ''}
      <p style="color:#94A3B8;font-size:13px;text-align:center;margin:0;">
        <a href="${SUPPORT_WA}" style="color:#00A896;text-decoration:none;font-weight:600;">Fale com seu consultor</a>
      </p>
    `, 'Você tem um pagamento em atraso. Regularize agora.')
  }),

  overdue_2: (data) => ({
    subject: `🔴 2º aviso — Pagamento urgente · ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('🔴 2º aviso urgente', '#DC2626')}</p>
      <h1 style="color:#DC2626;font-size:24px;font-weight:800;margin:16px 0 8px;">Pagamento urgente</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá! A mensalidade da escola <strong>${data.institution_name}</strong> está com
        <strong>${data.dias_atraso} dias</strong> de atraso. Regularize imediatamente para evitar a suspensão.
      </p>
      ${data.payment_link ? btn('💳 Regularizar agora →', data.payment_link, '#DC2626') : ''}
      <p style="color:#94A3B8;font-size:13px;text-align:center;margin:0;">
        <a href="${SUPPORT_WA}" style="color:#00A896;text-decoration:none;font-weight:600;">Fale com seu consultor</a>
      </p>
    `, 'Pagamento urgente — evite a suspensão do sistema.')
  }),

  overdue_3: (data) => ({
    subject: `🚨 Aviso final — Suspensão em breve · ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('🚨 Aviso final', '#DC2626')}</p>
      <h1 style="color:#DC2626;font-size:24px;font-weight:800;margin:16px 0 8px;">Aviso final antes da suspensão</h1>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Olá! O acesso da escola <strong>${data.institution_name}</strong> será suspenso em
        <strong>${data.data_suspensao || 'breve'}</strong> por falta de pagamento.
      </p>
      ${infoBox(`
        <span style="color:#991B1B;font-size:14px;font-weight:600;">⏰ Esta é sua última chance de evitar a suspensão do sistema.</span>
      `, '#FEF2F2', '#FECACA', '#991B1B')}
      ${data.payment_link ? btn('🚨 Evitar suspensão →', data.payment_link, '#DC2626') : ''}
    `, 'Suspensão iminente — regularize agora.')
  }),

}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { type, to, data } = await req.json()

    if (!type || !to) throw new Error('type e to são obrigatórios')
    if (!BREVO_KEY) throw new Error('BREVO_API_KEY não configurada nos secrets do Supabase')

    const template = templates[type]
    if (!template) throw new Error(`Template "${type}" não encontrado. Disponíveis: ${Object.keys(templates).join(', ')}`)

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
