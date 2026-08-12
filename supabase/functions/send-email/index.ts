// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')
const FROM_EMAIL = 'noreply@aionedu.com.br'
const FROM_NAME = 'Aion Edu'
const LOGO_URL = 'https://www.aionedu.com.br/aion-logo-full.png'
const SUPPORT_PHONE = '(83) 98556-6393'
const SUPPORT_WA = 'https://wa.me/5583985556393'
// Numero comercial (vendas/demo) — mesmo usado em RaioXPage.tsx, Landing.tsx e Footer.tsx.
const SALES_WA = 'https://wa.me/5583993444383'

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
  <title>Aion Edu</title>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#00523C 0%,#00A896 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="Aion Edu" height="48" style="display:block;margin:0 auto;filter:brightness(0) invert(1);" />
              <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:13px;letter-spacing:0.5px;">Sistema de Gestao Educacional</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#1A2B4A;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
              <p style="color:rgba(255,255,255,0.9);font-size:13px;margin:0 0 8px;font-weight:600;">Aion Solucoes Tecnologicas LTDA</p>
              <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0 0 16px;">CNPJ: 65.835.064/0001-58 &middot; Patos/PB</p>
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
              <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:16px 0 0;">&copy; ${new Date().getFullYear()} Aion Edu &middot; Todos os direitos reservados</p>
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

const badge = (text: string, bgColor = '#00A896', textColor?: string) => {
  const tc = textColor || bgColor
  const bg = textColor ? bgColor : bgColor + '18'
  const border = textColor ? bgColor : bgColor + '40'
  return `<span style="display:inline-block;background:${bg};color:${tc};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid ${border};">${text}</span>`
}

const h1 = (text: string, color = '#1A2B4A') =>
  `<h1 style="color:${color};font-size:24px;font-weight:800;margin:16px 0 8px;">${text}</h1>`

const p = (text: string) =>
  `<p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">${text}</p>`

const box = (content: string, bgColor = '#F0FDF4', borderColor = '#BBF7D0', textColor = '#166534') => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:20px;color:${textColor};font-size:14px;line-height:1.7;">
        ${content}
      </td>
    </tr>
  </table>
`

const infoBox = box

const divider = () => `<hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">`

const supportLine = () =>
  `<p style="color:#94A3B8;font-size:13px;text-align:center;margin:0;">Duvidas? <a href="${SUPPORT_WA}" style="color:#00A896;text-decoration:none;font-weight:600;">Fale com seu consultor via WhatsApp</a></p>`

const templates: Record<string, (data: any) => { subject: string; html: string }> = {

  new_institution: (data) => ({
    subject: `Conta ativa - Bem-vindo ao Aion Edu, ${data.institution_name}!`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Acesso liberado', '#16A34A', '#166534')}</p>
      ${h1('Sua conta esta ativa!', '#166534')}
      ${p(`Ola! O pagamento da implantacao de <strong>${data.institution_name}</strong> foi confirmado e sua conta ja esta liberada para acesso completo ao sistema.`)}
      ${box(`
        <strong style="display:block;margin-bottom:12px;">O que voce pode fazer agora:</strong>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;">Acessar o painel de gestao</td></tr>
          <tr><td style="padding:4px 0;">Cadastrar sua equipe</td></tr>
          <tr><td style="padding:4px 0;">Configurar o WhatsApp Business</td></tr>
          <tr><td style="padding:4px 0;">Criar sua primeira campanha de matricula</td></tr>
        </table>
      `)}
      ${btn('Acessar o sistema', data.login_url || 'https://app.aionedu.com.br/login')}
      ${divider()}
      ${supportLine()}
    `)
  }),

  payment_link: (data) => ({
    subject: `Link de pagamento - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Pagamento pendente', '#FFFBEB', '#A16207')}</p>
      ${h1('Taxa de implantacao')}
      ${p(`Ola! Sua escola <strong>${data.institution_name}</strong> foi cadastrada no sistema Aion Edu. Para liberar o acesso completo, realize o pagamento da taxa de implantacao.`)}
      ${box(`
        <strong style="display:block;margin-bottom:12px;">Detalhes do pagamento:</strong>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:6px 0;font-size:14px;">Valor</td>
            <td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;">R$ ${data.value}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;">Vencimento</td>
            <td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;">${data.due_date}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;">Forma</td>
            <td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;">${data.billing_type || 'PIX / Boleto'}</td>
          </tr>
        </table>
      `, '#FFFBEB', '#FDE68A', '#92400E')}
      ${data.payment_link ? btn('Pagar agora', data.payment_link, '#D97706') : ''}
      ${p('Apos a confirmacao, voce recebera os dados de acesso por e-mail.')}
      ${supportLine()}
    `)
  }),

  monthly_payment: (data) => ({
    subject: `Mensalidade disponivel - ${data.institution_name}`,
    html: wrap(`
      ${badge('Mensalidade', '#FEF9C3', '#A16207')}
      ${h1('Link de pagamento disponivel')}
      ${p(`Ola! O link de pagamento da mensalidade de <strong>${data.institution_name}</strong> ja esta disponivel.`)}
      ${box(`
        <strong style="display:block;margin-bottom:12px;">Detalhes:</strong>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:5px 0;font-size:14px;">Referencia</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;">${data.description || 'Mensalidade'}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;">Valor</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;">R$ ${data.value}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;">Vencimento</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;">${data.due_date}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;">Forma</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;">${data.billing_type || 'PIX / Boleto'}</td>
          </tr>
        </table>
      `, '#FFFBEB', '#FDE68A', '#92400E')}
      ${data.payment_link ? btn('Pagar mensalidade', data.payment_link, '#D97706') : ''}
      ${p('Apos o pagamento, o status sera atualizado automaticamente no sistema.')}
      ${supportLine()}
    `)
  }),

  contract_sign: (data) => ({
    subject: `Contrato para assinatura - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Assinatura necessaria', '#EEF2FF', '#3730A3')}</p>
      ${h1('Contrato de prestacao de servicos')}
      ${p(`Ola, <strong>${data.signer_name}</strong>! Segue o contrato da escola <strong>${data.institution_name}</strong> para assinatura digital com validade juridica.`)}
      ${box(`
        <strong style="display:block;margin-bottom:8px;">Assinatura digital certificada</strong>
        <span style="font-size:13px;">O documento possui validade juridica e e processado pela plataforma Autentique, certificada pelo ICP-Brasil.</span>
      `, '#EEF2FF', '#C7D2FE', '#3730A3')}
      ${data.sign_url ? btn('Assinar contrato', data.sign_url, '#6366F1') : ''}
      ${supportLine()}
    `)
  }),

  suspended: (data) => ({
    subject: `Acesso suspenso - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Acesso suspenso', '#FEF2F2', '#DC2626')}</p>
      ${h1('Acesso temporariamente suspenso', '#DC2626')}
      ${p(`Ola! O acesso da escola <strong>${data.institution_name}</strong> foi suspenso por falta de pagamento${data.dias_atraso && data.dias_atraso !== '0' ? ` (${data.dias_atraso} dias em atraso)` : ''}.`)}
      ${box(`
        <strong style="display:block;margin-bottom:8px;">Para reativar o acesso:</strong>
        <span style="font-size:14px;">Regularize o pagamento pendente e entre em contato com seu consultor para reativacao imediata.</span>
      `, '#FEF2F2', '#FECACA', '#991B1B')}
      ${btn('Falar com suporte', SUPPORT_WA, '#DC2626')}
    `)
  }),

  reactivated: (data) => ({
    subject: `Acesso reativado - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Acesso reativado', '#16A34A', '#166534')}</p>
      ${h1('Acesso reativado com sucesso!', '#16A34A')}
      ${p(`Ola! O acesso da escola <strong>${data.institution_name}</strong> foi reativado. Voce ja pode acessar o sistema normalmente.`)}
      ${box(`
        <strong style="display:block;margin-bottom:8px;">Tudo certo!</strong>
        <span style="font-size:14px;">Seu pagamento foi confirmado e o acesso esta liberado. Bem-vindo de volta!</span>
      `)}
      ${btn('Acessar o sistema', data.link_acesso || 'https://app.aionedu.com.br/login')}
    `)
  }),

  overdue_1: (data) => ({
    subject: `Lembrete - Pagamento em atraso - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Pagamento em atraso', '#FFFBEB', '#D97706')}</p>
      ${h1('Lembrete de pagamento', '#D97706')}
      ${p(`Ola! Identificamos que a mensalidade da escola <strong>${data.institution_name}</strong> esta com <strong>${data.dias_atraso} dias</strong> de atraso.`)}
      ${box(`<span style="font-size:14px;">Para evitar a suspensao do sistema, regularize o pagamento o quanto antes.</span>`, '#FFFBEB', '#FDE68A', '#92400E')}
      ${data.payment_link ? btn('Pagar agora', data.payment_link, '#D97706') : ''}
      ${supportLine()}
    `)
  }),

  overdue_2: (data) => ({
    subject: `2o aviso - Pagamento urgente - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('2o aviso urgente', '#FEF2F2', '#DC2626')}</p>
      ${h1('Pagamento urgente', '#DC2626')}
      ${p(`Ola! A mensalidade da escola <strong>${data.institution_name}</strong> esta com <strong>${data.dias_atraso} dias</strong> de atraso. Regularize imediatamente para evitar a suspensao.`)}
      ${data.payment_link ? btn('Regularizar agora', data.payment_link, '#DC2626') : ''}
      ${supportLine()}
    `)
  }),

  overdue_3: (data) => ({
    subject: `Aviso final - Suspensao em breve - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Aviso final', '#FEF2F2', '#DC2626')}</p>
      ${h1('Aviso final antes da suspensao', '#DC2626')}
      ${p(`Ola! O acesso da escola <strong>${data.institution_name}</strong> sera suspenso em <strong>${data.data_suspensao || 'breve'}</strong> por falta de pagamento.`)}
      ${box(`<span style="font-size:14px;font-weight:600;">Esta e sua ultima chance de evitar a suspensao do sistema.</span>`, '#FEF2F2', '#FECACA', '#991B1B')}
      ${data.payment_link ? btn('Evitar suspensao', data.payment_link, '#DC2626') : ''}
    `)
  }),

  overdue_4: (data) => ({
    subject: `Mensalidade em atraso - regularize o quanto antes - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Pagamento em atraso', '#FFFBEB', '#D97706')}</p>
      ${h1('Mensalidade em atraso', '#D97706')}
      ${p(`Ola! A mensalidade da escola <strong>${data.institution_name}</strong> esta com <strong>${data.dias_atraso} dias</strong> de atraso. Pedimos que regularize o quanto antes para manter tudo em dia.`)}
      ${box(`<span style="font-size:14px;">Se precisar de ajuda ou ja efetuou o pagamento, fale com seu consultor.</span>`, '#FFFBEB', '#FDE68A', '#92400E')}
      ${data.payment_link ? btn('Pagar agora', data.payment_link, '#D97706') : ''}
      ${supportLine()}
    `)
  }),

  proposal: (data) => ({
    subject: `Proposta Comercial Aion Edu — ${data.school_name || 'sua escola'}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Proposta Comercial', '#00523C', '#ffffff')}</p>
      ${h1(`Proposta para ${data.school_name || 'sua escola'}`, '#00523C')}
      ${p(`Ola, <strong>${data.client_name || 'prezado(a)'}</strong>! Preparamos uma proposta exclusiva para a sua escola. Confira os valores e condicoes especiais abaixo.`)}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:12px;overflow:hidden;border:1px solid #BBF7D0;">
        <tr style="background:#00523C;">
          <th style="padding:12px 16px;text-align:left;color:#ffffff;font-size:13px;font-weight:700;">Item</th>
          <th style="padding:12px 16px;text-align:right;color:#ffffff;font-size:13px;font-weight:700;">Normal</th>
          <th style="padding:12px 16px;text-align:right;color:#00FFD0;font-size:13px;font-weight:700;">Especial</th>
        </tr>
        <tr style="background:#F0FDF4;">
          <td style="padding:12px 16px;font-size:14px;color:#166534;">Implantacao</td>
          <td style="padding:12px 16px;text-align:right;font-size:14px;color:#64748B;text-decoration:line-through;">${data.implementation_normal_fmt || 'R$ 999,00'}</td>
          <td style="padding:12px 16px;text-align:right;font-size:15px;font-weight:700;color:#00523C;">${data.implementation_special_fmt || 'R$ 499,00'}</td>
        </tr>
        <tr style="background:#ffffff;">
          <td style="padding:12px 16px;font-size:14px;color:#166534;">Mensalidade</td>
          <td style="padding:12px 16px;text-align:right;font-size:14px;color:#64748B;text-decoration:line-through;">${data.monthly_normal_fmt || 'R$ 749,00'}</td>
          <td style="padding:12px 16px;text-align:right;font-size:15px;font-weight:700;color:#00523C;">${data.monthly_special_fmt || 'R$ 570,00'}</td>
        </tr>
      </table>
      ${data.validity_days ? `<p style="color:#94A3B8;font-size:13px;text-align:center;margin:0 0 4px;">Proposta valida por ${data.validity_days} dias</p>` : ''}
      ${btn('Ver Proposta Online', data.proposal_url || '#', '#00A896')}
      ${divider()}
      <p style="color:#475569;font-size:14px;margin:0 0 4px;"><strong>Seu consultor:</strong></p>
      <p style="color:#475569;font-size:14px;margin:0 0 4px;">${data.consultant_name || 'Equipe Aion Edu'}</p>
      ${data.consultant_phone ? `<p style="color:#475569;font-size:14px;margin:0;"><a href="https://wa.me/55${data.consultant_phone.replace(/\D/g,'')}" style="color:#00A896;text-decoration:none;">WhatsApp: ${data.consultant_phone}</a></p>` : ''}
    `, `Nova proposta da Aion Edu para ${data.school_name}`)
  }),

  nota_fiscal_emitida: (data) => ({
    subject: `Nota Fiscal emitida - ${data.institution_name}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Nota Fiscal', '#16A34A', '#166534')}</p>
      ${h1('Sua nota fiscal foi emitida', '#166534')}
      ${p(`Ola! A nota fiscal referente ao pagamento de <strong>${data.institution_name}</strong> foi emitida. Segue os dados abaixo.`)}
      ${box(`
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:5px 0;font-size:14px;">Numero</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;">${data.invoice_number || '—'}</td>
          </tr>
          ${data.invoice_series ? `<tr><td style="padding:5px 0;font-size:14px;">Serie</td><td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;">${data.invoice_series}</td></tr>` : ''}
          <tr>
            <td style="padding:5px 0;font-size:14px;">Referente a</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;">${data.description || 'Pagamento'}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;">Valor</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;">R$ ${data.value}</td>
          </tr>
        </table>
      `, '#F0FDF4', '#BBF7D0', '#166534')}
      ${data.invoice_url_pdf ? btn('Baixar Nota Fiscal (PDF)', data.invoice_url_pdf, '#16A34A') : ''}
      ${p('Guarde este e-mail para sua contabilidade.')}
      ${supportLine()}
    `)
  }),

  raio_x_boas_vindas: (data) => ({
    subject: `Seu Raio-X Estrategico da ${data.escola || 'sua escola'} chegou!`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Raio-X Estrategico', '#00523C', '#ffffff')}</p>
      ${h1(`Ola, ${data.diretor || 'diretor(a)'}!`, '#00523C')}
      ${p(`Seu Raio-X Estrategico da <strong>${data.escola || 'sua escola'}</strong> ja foi baixado com sucesso - obrigado por participar! Esperamos que os dados tenham te ajudado a enxergar melhor a posicao da sua escola no mercado.`)}
      ${p(`Se quiser aprofundar essa analise e entender como transformar isso em mais matriculas para 2027, e so responder este e-mail ou chamar a gente no WhatsApp.`)}
      ${btn('Chamar no WhatsApp', SALES_WA, '#25D366')}
      ${p('Um abraco,<br>Equipe Aion Edu')}
    `, `Seu Raio-X Estrategico da ${data.escola} chegou!`)
  }),

}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { type, to, data, custom_params } = await req.json()

    if (!type || !to) throw new Error('type e to sao obrigatorios')
    if (!BREVO_KEY) throw new Error('BREVO_API_KEY nao configurada nos secrets do Supabase')

    const template = templates[type]
    if (!template) throw new Error(`Template "${type}" nao encontrado. Disponiveis: ${Object.keys(templates).join(', ')}`)

    const { subject, html } = template(data || {})

    const brevoBody: any = {
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }
    if (custom_params) brevoBody.params = custom_params
    if (type === 'proposal' && data?.proposal_id) {
      brevoBody.params = { ...(brevoBody.params || {}), proposal_id: data.proposal_id }
      brevoBody.tags = ['proposal']
    }
    // Nota Fiscal — Brevo busca o arquivo pela URL e anexa de verdade ao
    // e-mail (além do link clicavel já no corpo do template, redundância
    // proposital caso o fetch da Brevo falhe por algum motivo).
    if (type === 'nota_fiscal_emitida' && data?.invoice_url_pdf) {
      brevoBody.attachment = [{ url: data.invoice_url_pdf, name: `NF-${data.invoice_number || 'documento'}.pdf` }]
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY,
      },
      body: JSON.stringify(brevoBody),
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