// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')
const FROM_EMAIL = 'noreply@aionedu.com.br'
const FROM_NAME = 'Aion Edu'
const BANNER_URL = 'https://aionedu.com.br/brand/email-banner.png'
const SUPPORT_WA = 'https://wa.me/5583985556393'
// Numero comercial (vendas/demo) — mesmo usado em RaioXPage.tsx, Landing.tsx e Footer.tsx.
const SALES_WA = 'https://wa.me/5583993444383'
const SITE_URL = 'https://aionedu.com.br'
const INSTAGRAM_URL = 'https://instagram.com/aioneduu'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fontes de marca (Bricolage Grotesque / Plus Jakarta Sans) nao carregam em
// e-mail — quase todo cliente bloqueia @font-face. Fallback de sistema visualmente
// proximo, ja usado no restante do sistema; peso tipografico (700/800) fica a
// cargo do font-weight, nao da fonte em si.
const FONT_STACK = `'Helvetica Neue',Helvetica,Arial,sans-serif`

const footerLink = (label: string, url: string) =>
  `<a class="em-link" href="${url}" style="font-family:${FONT_STACK};color:#05907B;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;">${label}</a>`

// Modelo unico dos e-mails da Aion Edu.
// - Cabecalho e uma IMAGEM pronta (logo sobre faixa verde): imagens nao sao invertidas por Gmail/Outlook no modo escuro
//   e nao dependem de filtro CSS (que a maioria dos clientes ignora).
// - Cores sempre com bgcolor/atributos inline (funciona em qualquer cliente) + um tema escuro desenhado de verdade
//   para quem suporta prefers-color-scheme (Apple Mail, iOS, Outlook) e [data-ogsc] (Outlook.com/app).
const wrap = (content: string, preheader = '') => `
<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="x-apple-disable-message-reformatting">
  <title>Aion Edu</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    img { -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) { .em-pad { padding: 28px 22px !important; } .em-wrap { padding: 0 !important; } }
    @media (prefers-color-scheme: dark) {
      .em-bg { background-color: #0B1220 !important; }
      .em-card { background-color: #111C2E !important; border-color: #1E2D45 !important; }
      .em-h { color: #F1F5F9 !important; }
      .em-t { color: #CBD5E1 !important; }
      .em-foot { background-color: #0D1626 !important; border-color: #1E2D45 !important; }
      .em-muted { color: #94A3B8 !important; }
      .em-link { color: #2DD4BF !important; }
      .em-line { border-top-color: #1E2D45 !important; }
    }
    [data-ogsc] .em-h { color: #F1F5F9 !important; } [data-ogsc] .em-t { color: #CBD5E1 !important; } [data-ogsc] .em-muted { color: #94A3B8 !important; } [data-ogsc] .em-link { color: #2DD4BF !important; }
    [data-ogsb] .em-bg { background-color: #0B1220 !important; } [data-ogsb] .em-card { background-color: #111C2E !important; } [data-ogsb] .em-foot { background-color: #0D1626 !important; }
  </style>
</head>
<body class="em-bg" bgcolor="#EEF4F3" style="margin:0;padding:0;background-color:#EEF4F3;font-family:${FONT_STACK};-webkit-text-size-adjust:100%;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-bg" bgcolor="#EEF4F3" style="background-color:#EEF4F3;">
    <tr>
      <td align="center" class="em-wrap" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td bgcolor="#00695F" style="background-color:#00695F;border-radius:20px 20px 0 0;line-height:0;font-size:0;">
              <img src="${BANNER_URL}" width="600" alt="Aion Edu" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;border-radius:20px 20px 0 0;background-color:#00695F;color:#ffffff;font-family:${FONT_STACK};font-size:20px;font-weight:700;line-height:1.4;">
            </td>
          </tr>
          <tr>
            <td class="em-card em-pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              ${content}
            </td>
          </tr>
          <tr>
            <td class="em-foot" bgcolor="#F5FAF9" style="background-color:#F5FAF9;border:1px solid #E2E8F0;border-radius:0 0 20px 20px;padding:24px 32px;text-align:center;">
              <p class="em-muted" style="font-family:${FONT_STACK};color:#334155;font-size:13px;margin:0 0 4px;font-weight:700;">Aion Solucoes Tecnologicas LTDA</p>
              <p class="em-muted" style="font-family:${FONT_STACK};color:#64748B;font-size:12px;margin:0 0 14px;">CNPJ: 65.835.064/0001-58 &middot; Patos/PB</p>
              <p style="margin:0;line-height:2;">
                ${footerLink('Suporte', SUPPORT_WA)} &nbsp;&middot;&nbsp; ${footerLink('Comercial', SALES_WA)} &nbsp;&middot;&nbsp; ${footerLink('aionedu.com.br', SITE_URL)} &nbsp;&middot;&nbsp; ${footerLink('@aioneduu', INSTAGRAM_URL)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

const btn = (text: string, url: string, color = '#05907B') => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto;">
    <tr>
      <td bgcolor="${color}" style="background-color:${color};border-radius:12px;">
        <a href="${url}" style="display:inline-block;font-family:${FONT_STACK};padding:15px 38px;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;border-radius:12px;">${text}</a>
      </td>
    </tr>
  </table>
`

const badge = (text: string, bgColor = '#00A896', textColor?: string) => {
  const tc = textColor || bgColor
  const bg = textColor ? bgColor : bgColor + '18'
  const border = textColor ? bgColor : bgColor + '40'
  return `<span style="display:inline-block;font-family:${FONT_STACK};background-color:${bg};color:${tc};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid ${border};">${text}</span>`
}

const h1 = (text: string, color = '#1A2B4A') =>
  `<h1 class="${color === '#1A2B4A' || color === '#00523C' || color === '#166534' ? 'em-h' : ''}" style="font-family:${FONT_STACK};color:${color};font-size:24px;font-weight:800;line-height:1.3;margin:16px 0 8px;">${text}</h1>`

const p = (text: string) =>
  `<p class="em-t" style="font-family:${FONT_STACK};color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">${text}</p>`

const box = (content: string, bgColor = '#F0FDF4', borderColor = '#BBF7D0', textColor = '#166534') => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background-color:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:20px;font-family:${FONT_STACK};color:${textColor};font-size:14px;line-height:1.7;">
        ${content}
      </td>
    </tr>
  </table>
`

const infoBox = box

const divider = () => `<hr class="em-line" style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">`

const supportLine = () =>
  `<p style="font-family:${FONT_STACK};color:#94A3B8;font-size:13px;text-align:center;margin:0;">Duvidas? <a href="${SUPPORT_WA}" style="color:#00A896;text-decoration:none;font-weight:600;">Fale com seu consultor via WhatsApp</a></p>`

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

  // Boas-vindas ao gestor ao concluir a configuracao inicial da campanha
  // (SchoolSetupModal.tsx) — pessoa ja esta logada nesse momento, por isso
  // NAO ha senha aqui (so credenciais quando data.temp_password vier
  // preenchido, util caso este template seja reaproveitado no futuro por um
  // fluxo de criacao de conta que gere senha provisoria).
  gestor_welcome: (data) => ({
    subject: `Tudo pronto, ${data.gestor_name || 'gestor(a)'}! Sua campanha ja esta rodando`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Configuracao concluida', '#16A34A', '#166534')}</p>
      ${h1(`Bem-vindo(a), ${data.gestor_name || 'gestor(a)'}!`, '#166534')}
      ${p(`A configuracao inicial da <strong>${data.school_name || 'sua escola'}</strong> foi concluida com sucesso. Sua campanha de matriculas ja esta pronta pra rodar na Aion Edu.`)}
      ${box(`
        <strong style="display:block;margin-bottom:12px;">Seus dados de acesso:</strong>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="padding:4px 0;font-size:14px;">E-mail</td><td style="padding:4px 0;font-size:14px;font-weight:700;text-align:right;">${data.email || ''}</td></tr>
          ${data.temp_password ? `<tr><td style="padding:4px 0;font-size:14px;">Senha provisoria</td><td style="padding:4px 0;font-size:14px;font-weight:700;text-align:right;">${data.temp_password}</td></tr>` : ''}
        </table>
      `)}
      ${box(`
        <strong style="display:block;margin-bottom:12px;">Primeiros passos:</strong>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;">Acompanhar o painel de gestao</td></tr>
          <tr><td style="padding:4px 0;">Cadastrar sua equipe de atendimento</td></tr>
          <tr><td style="padding:4px 0;">Configurar o WhatsApp Business</td></tr>
          <tr><td style="padding:4px 0;">Acompanhar os primeiros leads chegando</td></tr>
        </table>
      `)}
      ${btn('Acessar o sistema', data.login_url || 'https://app.aionedu.com.br/login')}
      ${divider()}
      ${supportLine()}
    `)
  }),

  // Boas-vindas ao atendente/consultor recem-criado em UserManagement.tsx
  // (equipe da escola) ou InitialSetup.tsx (admin da escola) — pessoa ainda
  // NAO esta logada nesse momento, por isso sempre leva a senha provisoria.
  atendente_welcome: (data) => ({
    subject: `Bem-vindo(a) a ${data.school_name || 'equipe'}, ${data.user_name || ''}!`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Conta criada', '#16A34A', '#166534')}</p>
      ${h1(`Bem-vindo(a), ${data.user_name || ''}!`, '#166534')}
      ${p(`Sua conta de acesso ao sistema da <strong>${data.school_name || 'sua escola'}</strong> ja foi criada na Aion Edu. Confira abaixo seus dados de acesso.`)}
      ${box(`
        <strong style="display:block;margin-bottom:12px;">Seus dados de acesso:</strong>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="padding:4px 0;font-size:14px;">E-mail</td><td style="padding:4px 0;font-size:14px;font-weight:700;text-align:right;">${data.email || ''}</td></tr>
          ${data.temp_password ? `<tr><td style="padding:4px 0;font-size:14px;">Senha provisoria</td><td style="padding:4px 0;font-size:14px;font-weight:700;text-align:right;">${data.temp_password}</td></tr>` : ''}
        </table>
      `)}
      ${box(`
        <strong style="display:block;margin-bottom:12px;">Primeiros passos:</strong>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;">Fazer login com o e-mail e senha acima</td></tr>
          <tr><td style="padding:4px 0;">Conferir os leads e conversas atribuidos a voce</td></tr>
          <tr><td style="padding:4px 0;">Explorar o hub de atendimento do WhatsApp</td></tr>
        </table>
      `)}
      ${btn('Acessar o sistema', data.login_url || 'https://app.aionedu.com.br/login')}
      ${divider()}
      ${supportLine()}
    `)
  }),

  // Fase 2 de "usuário em múltiplas instituições" — pessoa já tem conta
  // (outra escola, outro cargo) e ganhou um vínculo novo. NUNCA leva senha:
  // acesso já vale na hora, com o e-mail e senha que a pessoa já usa.
  added_to_institution: (data) => ({
    subject: `Você foi adicionado(a) à equipe da ${data.school_name || 'escola'}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Novo acesso', '#16A34A', '#166534')}</p>
      ${h1(`Bem-vindo(a) à equipe, ${data.user_name || ''}!`, '#166534')}
      ${p(`Você foi adicionado(a) à equipe da <strong>${data.school_name || 'sua escola'}</strong> na Aion Edu. Seu acesso já está liberado — use o mesmo e-mail e senha de sempre.`)}
      ${box(`
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="padding:4px 0;font-size:14px;">E-mail</td><td style="padding:4px 0;font-size:14px;font-weight:700;text-align:right;">${data.email || ''}</td></tr>
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
    subject: `Proposta da Áion Edu para ${data.school_name || 'sua escola'}`,
    html: wrap(`
      <p style="margin:0 0 4px;">${badge('Proposta comercial', '#00523C', '#ffffff')}</p>
      ${h1(`Proposta para ${data.school_name || 'sua escola'}`, '#00523C')}
      ${p(`Olá, <strong>${data.client_name || 'prezado(a)'}</strong>! Preparamos a proposta da Áion Edu para a sua escola. Ela está em anexo neste e-mail, em PDF, pronta para ler no celular.`)}
      ${p('Nela você encontra o que o sistema faz para o atendimento e para a gestão, os custos do WhatsApp explicados com exemplos e o investimento.')}
      ${data.pdf_url ? btn('Abrir a proposta (PDF)', data.pdf_url) : ''}
      ${data.valid_until ? `<p class="em-muted" style="font-family:${FONT_STACK};color:#64748B;font-size:13px;text-align:center;margin:0 0 4px;">Proposta válida até ${data.valid_until}</p>` : ''}
      ${divider()}
      <p class="em-h" style="font-family:${FONT_STACK};color:#1A2B4A;font-size:14px;font-weight:800;margin:0 0 4px;">Seu consultor</p>
      <p class="em-t" style="font-family:${FONT_STACK};color:#475569;font-size:14px;margin:0 0 4px;">${data.consultant_name || 'Equipe Áion Edu'}</p>
      ${data.consultant_phone ? `<p style="margin:0;"><a class="em-link" href="https://wa.me/55${String(data.consultant_phone).replace(/\D/g,'').replace(/^55/, '')}" style="font-family:${FONT_STACK};color:#05907B;font-size:14px;font-weight:700;text-decoration:none;">WhatsApp: ${data.consultant_phone}</a></p>` : ''}
    `, `A proposta da Áion Edu para ${data.school_name || 'sua escola'} está em anexo`)
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
    if (type === 'proposal' && data?.pdf_url) {
      brevoBody.attachment = [{ url: data.pdf_url, name: `Proposta-Aion-Edu-${String(data.school_name || 'escola').replace(/[^A-Za-z0-9]+/g, '-')}.pdf` }]
    }
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