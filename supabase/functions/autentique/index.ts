// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AUTENTIQUE_KEY = Deno.env.get('AUTENTIQUE_API_KEY')
const AUTENTIQUE_URL = 'https://api.autentique.com.br/v2/graphql'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const {
      institution_id, contract_id,
      school_name, school_cnpj, school_address, school_city, school_state,
      signer_name, signer_email, signer_phone, signer_cpf, signer_role,
      monthly_value, implementation_value, contract_start_date, consultant_id,
    } = body

    if (!AUTENTIQUE_KEY) throw new Error('AUTENTIQUE_API_KEY não configurada')
    if (!signer_email || !signer_name) throw new Error('Nome e e-mail do signatário são obrigatórios')

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Buscar template e configurações
    const { data: cfg } = await sb.from('platform_settings').select('key, value')
      .in('key', ['billing_due_day', 'platform_name', 'platform_cnpj', 'platform_address', 'platform_email'])
    const settings: Record<string, string> = {}
    for (const row of cfg || []) settings[row.key] = row.value

    // 2. Buscar dados da instituição
    const { data: inst } = await sb.from('institutions')
      .select('name, cnpj, city, state, email, address, phone, billing_due_day')
      .eq('id', institution_id)
      .single()

    // Buscar nome do consultor
    let consultorName = 'Equipe Áion Edu'
    if (consultant_id) {
      const { data: cons } = await sb.from('users').select('full_name').eq('id', consultant_id).single()
      if (cons?.full_name) consultorName = cons.full_name
    }

    // 3. Montar variáveis
    const fmtBRL = (n: number) => n?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
    const startDate = contract_start_date
      ? new Date(contract_start_date + 'T12:00:00').toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR')

    const vars: Record<string, string> = {
      escola:            inst?.name || school_name || '',
      cnpj:              inst?.cnpj || school_cnpj || '',
      endereco:          inst?.address || school_address || '',
      cidade_uf:         `${inst?.city || school_city || ''}/${inst?.state || school_state || ''}`,
      gestor:            signer_name,
      cargo_gestor:      signer_role || 'Diretor',
      cpf_gestor:        signer_cpf || '',
      email_gestor:      signer_email,
      telefone_gestor:   signer_phone || inst?.phone || '',
      valor_implantacao: implementation_value ? fmtBRL(Number(implementation_value)) : 'R$ 0,00',
      valor_mensal:      monthly_value ? fmtBRL(Number(monthly_value)) : 'R$ 0,00',
      dia_vencimento:    inst?.billing_due_day || settings.billing_due_day || '10',
      data_inicio:       startDate,
      data_hoje:         new Date().toLocaleDateString('pt-BR'),
      consultor:         consultorName,
    }

    // 4. HTML completo do contrato Áion Edu com identidade visual
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.8; color: #1a1a1a; background: #fff; }
  .header { background: linear-gradient(135deg, #00523C, #00A896); padding: 32px 48px; display: flex; align-items: center; justify-content: space-between; }
  .header-title { color: white; }
  .header-title h1 { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
  .header-title p { font-size: 12px; opacity: 0.85; }
  .header-info { text-align: right; color: rgba(255,255,255,0.85); font-size: 11px; line-height: 1.6; }
  .content { padding: 40px 48px; }
  .doc-title { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #00A896; }
  .doc-title h2 { font-size: 20px; font-weight: 800; color: #00523C; margin-bottom: 6px; }
  .doc-title p { font-size: 13px; color: #00A896; font-weight: 600; }
  .partes-box { background: #F0FDF9; border: 1px solid #A7F3D0; border-radius: 10px; padding: 20px; margin-bottom: 28px; }
  .parte { display: flex; gap: 16px; margin-bottom: 12px; }
  .parte:last-child { margin-bottom: 0; }
  .parte-label { font-size: 10px; font-weight: 800; color: #00523C; text-transform: uppercase; letter-spacing: 0.06em; min-width: 90px; padding-top: 2px; }
  .parte-text { font-size: 12px; color: #1a1a1a; line-height: 1.6; }
  .intro { font-size: 13px; color: #374151; line-height: 1.8; margin-bottom: 28px; text-align: justify; }
  .clausula { margin-bottom: 24px; }
  .clausula-title { font-size: 13px; font-weight: 800; color: #00523C; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px; padding: 8px 12px; background: #F0FDF9; border-left: 4px solid #00A896; border-radius: 0 6px 6px 0; }
  .clausula p { font-size: 12.5px; color: #374151; line-height: 1.8; text-align: justify; margin-bottom: 8px; }
  .clausula ul { padding-left: 24px; margin: 8px 0; }
  .clausula ul li { font-size: 12px; color: #374151; line-height: 1.7; margin-bottom: 4px; }
  .paragrafo { font-size: 12px; color: #374151; line-height: 1.8; text-align: justify; margin-bottom: 6px; padding-left: 20px; font-style: italic; }
  .assinaturas { margin-top: 48px; padding-top: 28px; border-top: 2px solid #E5E7EB; }
  .assinaturas h3 { text-align: center; font-size: 13px; color: #374151; margin-bottom: 32px; }
  .assin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .assin-box { text-align: center; }
  .assin-line { border-top: 1.5px solid #374151; margin: 0 20px 8px; }
  .assin-name { font-size: 12px; font-weight: 700; color: #1a1a1a; }
  .assin-role { font-size: 11px; color: #6B7280; }
  .assin-cpf { font-size: 11px; color: #6B7280; }
  .footer { background: #F9FAFB; border-top: 2px solid #00A896; padding: 16px 48px; display: flex; justify-content: space-between; align-items: center; margin-top: 40px; }
  .footer p { font-size: 10px; color: #9CA3AF; }
  .badge { display: inline-block; background: #E6F7F5; color: #00523C; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 999px; border: 1px solid #A7F3D0; }
</style>
</head>
<body>

<div class="header">
  <div class="header-title">
    <h1>ÁION EDU</h1>
    <p>Plataforma de Gestão de Matrículas</p>
  </div>
  <div class="header-info">
    ÁION SOLUÇÕES TECNOLÓGICAS LTDA<br>
    CNPJ: 65.835.064/0001-58<br>
    Patos/PB – contato@aionedu.com.br<br>
    (83) 9855-6393
  </div>
</div>

<div class="content">

  <div class="doc-title">
    <h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h2>
    <p>PLATAFORMA ÁION EDU – LICENÇA DE USO DE SOFTWARE (SaaS)</p>
  </div>

  <div class="partes-box">
    <div class="parte">
      <span class="parte-label">CONTRATADA</span>
      <span class="parte-text"><strong>ÁION SOLUÇÕES TECNOLÓGICAS LTDA</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 65.835.064/0001-58, com sede na Rua Francisco Vicente de Araújo, nº 48, Bela Vista, Patos/PB, CEP 58.704-560, doravante denominada <strong>CONTRATADA</strong> ou <strong>ÁION EDU</strong>.</span>
    </div>
    <div class="parte">
      <span class="parte-label">CONTRATANTE</span>
      <span class="parte-text"><strong>${vars.escola}</strong>${vars.cnpj ? `, pessoa jurídica inscrita no CNPJ sob o nº ${vars.cnpj}` : ''}, com sede em ${vars.endereco ? vars.endereco + ', ' : ''}${vars.cidade_uf}, neste ato representada por <strong>${vars.gestor}</strong>, portador(a) do CPF nº ${vars.cpf_gestor}, na qualidade de ${vars.cargo_gestor}, doravante denominada <strong>CONTRATANTE</strong> ou <strong>ESCOLA</strong>.</span>
    </div>
  </div>

  <p class="intro">As partes acima identificadas têm entre si justo e contratado o presente Contrato de Prestação de Serviços de Software como Serviço (SaaS), que se regerá pelas cláusulas e condições a seguir estipuladas, bem como pelas normas aplicáveis, em especial a Lei nº 10.406/2002 (Código Civil), a Lei nº 8.078/1990 (Código de Defesa do Consumidor), a Lei nº 12.965/2014 (Marco Civil da Internet) e a Lei nº 13.709/2018 (LGPD).</p>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA I – DO OBJETO</div>
    <p>O presente contrato tem por objeto a licença de uso da plataforma ÁION EDU, solução de software como serviço (SaaS) voltada à gestão de matrículas escolares, compreendendo os seguintes módulos e funcionalidades:</p>
    <ul>
      <li>CRM de Leads – gestão do funil de captação com kanban visual e score automático;</li>
      <li>WhatsApp Oficial – atendimento multiagente via API Oficial Meta WhatsApp Business;</li>
      <li>Inteligência Artificial de Campanha – plano de campanha, metas e calendário de captação;</li>
      <li>Relatórios e Dashboards – análise em tempo real do funil e indicadores de desempenho;</li>
      <li>Módulo de Rematrículas – radar preditivo de evasão e renovação de matrículas;</li>
      <li>Módulo de Transferências – diagnóstico de saídas com análise por inteligência artificial;</li>
      <li>Pesquisas de Satisfação – coleta e análise de feedback das famílias;</li>
      <li>WhatsApp Hub – central unificada de mensagens com múltiplos atendentes;</li>
      <li>Módulo de Contatos – base centralizada de dados com histórico unificado.</li>
    </ul>
  </div>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA II – DA VIGÊNCIA E PRAZO MÍNIMO DE FIDELIDADE</div>
    <p>O presente contrato entra em vigor na data de sua assinatura e terá prazo mínimo de fidelidade de 12 (doze) meses, renovando-se automaticamente por períodos iguais e sucessivos, salvo manifestação contrária com antecedência mínima de 30 (trinta) dias do término do período vigente.</p>
    <p class="paragrafo">§1º – A rescisão antecipada, antes do término do prazo mínimo, sujeitará a CONTRATANTE ao pagamento de multa compensatória equivalente a 20% (vinte por cento) do valor total das parcelas mensais vincendas até o término da fidelidade, nos termos do art. 413 do Código Civil.</p>
    <p class="paragrafo">§2º – Caso a rescisão ocorra por descumprimento da CONTRATADA, a multa não será aplicável.</p>
  </div>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA III – DOS VALORES E CONDIÇÕES DE PAGAMENTO</div>
    <p>Pela licença de uso e serviços correlatos, a CONTRATANTE pagará à CONTRATADA:</p>
    <ul>
      <li><strong>Taxa de Implantação (pagamento único):</strong> ${vars.valor_implantacao}, devida no ato da assinatura deste contrato;</li>
      <li><strong>Mensalidade:</strong> ${vars.valor_mensal}, com vencimento no dia ${vars.dia_vencimento} de cada mês, a partir do mês subsequente à assinatura.</li>
    </ul>
    <p class="paragrafo">§1º – Os valores serão reajustados anualmente pelo IPCA.</p>
    <p class="paragrafo">§2º – O inadimplemento sujeitará a CONTRATANTE à multa de 2% e juros de 1% ao mês, além de correção pelo IPCA.</p>
    <p class="paragrafo">§3º – O inadimplemento superior a 30 dias facultará à CONTRATADA suspender o acesso, e superior a 60 dias facultará a rescisão de pleno direito.</p>
  </div>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA IV – DA IMPLANTAÇÃO E SUPORTE</div>
    <p>A CONTRATADA prestará: configuração completa da plataforma; integração do WhatsApp oficial via API Meta; importação do histórico de matrículas; treinamento inicial da equipe (presencial ou remoto, mínimo 2h); geração do primeiro plano de campanha com inteligência artificial; e reunião mensal de acompanhamento de performance.</p>
    <p class="paragrafo">§1º – O suporte técnico será prestado por e-mail (appaiontech@gmail.com, prazo de resposta de 24h em dias úteis) e WhatsApp (83) 9855-6393, de segunda a sexta-feira, das 8h às 18h.</p>
  </div>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA V – DAS OBRIGAÇÕES DAS PARTES</div>
    <p><strong>A CONTRATADA obriga-se a:</strong> disponibilizar a plataforma com disponibilidade mínima mensal de 99%; realizar backups diários dos dados; notificar manutenções com 48h de antecedência; manter sigilo absoluto sobre os dados da CONTRATANTE; tratar dados pessoais em conformidade com a LGPD na qualidade de operadora.</p>
    <p><strong>A CONTRATANTE obriga-se a:</strong> efetuar os pagamentos nas datas estabelecidas; utilizar a plataforma apenas para as finalidades previstas; manter sigilo sobre suas credenciais de acesso; cumprir a LGPD como controladora dos dados de alunos e responsáveis; não ceder ou sublicenciar o uso da plataforma a terceiros.</p>
  </div>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA VI – DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)</div>
    <p>A CONTRATANTE é a controladora dos dados pessoais inseridos na plataforma. A CONTRATADA é operadora, tratando os dados exclusivamente conforme as instruções da CONTRATANTE e para as finalidades deste contrato.</p>
    <p class="paragrafo">§1º – Em caso de rescisão, a CONTRATADA disponibilizará os dados para exportação por 30 dias. Após esse prazo, os dados serão definitivamente eliminados, salvo obrigação legal de retenção.</p>
    <p class="paragrafo">§2º – A CONTRATADA notificará a CONTRATANTE em até 72h após tomar conhecimento de incidente de segurança que possa afetar dados pessoais.</p>
  </div>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA VII – DA PROPRIEDADE INTELECTUAL E CONFIDENCIALIDADE</div>
    <p>A plataforma ÁION EDU, seu código-fonte, interface, algoritmos e demais ativos intelectuais são de propriedade exclusiva da CONTRATADA. Os dados inseridos pela CONTRATANTE são de sua propriedade, sendo a CONTRATADA mera operadora e custodiante. As partes comprometem-se a manter sigilo sobre informações confidenciais pelo prazo de 2 anos após o término do contrato.</p>
  </div>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA VIII – DA RESCISÃO</div>
    <p>O contrato poderá ser rescindido: por acordo mútuo com 30 dias de aviso; pela CONTRATANTE após a fidelidade, com 30 dias de aviso; pela CONTRATANTE antes da fidelidade, com pagamento da multa prevista; pela CONTRATADA por inadimplemento superior a 60 dias; por descumprimento grave após 15 dias para regularização.</p>
  </div>

  <div class="clausula">
    <div class="clausula-title">CLÁUSULA IX – DAS DISPOSIÇÕES GERAIS E DO FORO</div>
    <p>As partes elegem a assinatura eletrônica como meio válido de formalização, nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020. O presente contrato é regido pelas leis da República Federativa do Brasil. Fica eleito o Foro da Comarca de Patos, Estado da Paraíba, para dirimir quaisquer dúvidas ou litígios, renunciando as partes a qualquer outro, por mais privilegiado que seja.</p>
  </div>

  <div class="assinaturas">
    <h3>Patos – PB, ${hoje}</h3>

    <div class="assin-grid">
      <div class="assin-box">
        <div class="assin-line"></div>
        <div class="assin-name">${vars.gestor}</div>
        <div class="assin-role">${vars.cargo_gestor} – ${vars.escola}</div>
        <div class="assin-cpf">CPF: ${vars.cpf_gestor}</div>
      </div>
      <div class="assin-box">
        <div class="assin-line"></div>
        <div class="assin-name">JOSE VICTOR DE ALMEIDA ARAUJO</div>
        <div class="assin-role">Representante Legal – Áion Edu</div>
        <div class="assin-cpf">CPF: 092.820.714-56</div>
      </div>
    </div>
  </div>

</div>

<div class="footer">
  <p>Áion Soluções Tecnológicas LTDA • CNPJ 65.835.064/0001-58 • Patos/PB</p>
  <span class="badge">Assinado Digitalmente via Autentique</span>
  <p>Gerado em ${hoje}</p>
</div>

</body>
</html>`

    // 5. Montar mutation GraphQL com 2 signatários
    const VICTOR_EMAIL = 'victor@agapepatos.com.br'
    const VICTOR_NAME  = 'Jose Victor de Almeida Araujo'

    const mutation = `
      mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
        createDocument(document: $document, signers: $signers, file: $file) {
          id
          name
          signatures {
            public_id
            name
            email
            link { short_link }
          }
        }
      }
    `

    const encoder = new TextEncoder()
    const htmlBytes = encoder.encode(htmlContent)
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const enc = (s: string) => encoder.encode(s)

    const operations = JSON.stringify({
      query: mutation,
      variables: {
        document: { name: `Contrato — ${inst?.name || school_name}` },
        signers: [
          { email: signer_email, name: signer_name, action: 'SIGN' },
          { email: VICTOR_EMAIL, name: VICTOR_NAME,  action: 'SIGN' },
        ],
        file: null,
      },
    })

    const map = JSON.stringify({ '0': ['variables.file'] })

    const parts: Uint8Array[] = [
      enc(`--${boundary}\r\nContent-Disposition: form-data; name="operations"\r\n\r\n${operations}\r\n`),
      enc(`--${boundary}\r\nContent-Disposition: form-data; name="map"\r\n\r\n${map}\r\n`),
      enc(`--${boundary}\r\nContent-Disposition: form-data; name="0"; filename="contrato.html"\r\nContent-Type: text/html\r\n\r\n`),
      htmlBytes,
      enc(`\r\n--${boundary}--\r\n`),
    ]

    const totalLength = parts.reduce((s, p) => s + p.length, 0)
    const bodyBytes = new Uint8Array(totalLength)
    let offset = 0
    for (const part of parts) { bodyBytes.set(part, offset); offset += part.length }

    // 6. Chamar API Autentique
    const autRes = await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTENTIQUE_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBytes,
    })

    const autData = await autRes.json()
    console.log('[autentique] response:', JSON.stringify(autData))

    if (autData.errors) throw new Error(autData.errors[0]?.message || 'Erro na Autentique')

    const document = autData.data?.createDocument
    const documentId = document?.id

    // 7. Buscar link de assinatura do gestor da escola com retry
    let signUrl: string | null = null

    if (documentId) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        await new Promise(r => setTimeout(r, 2000))

        const fetchQuery = `
          query {
            document(id: "${documentId}") {
              id
              signatures {
                public_id
                name
                email
                link { short_link }
              }
            }
          }
        `

        const fetchRes = await fetch(AUTENTIQUE_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AUTENTIQUE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: fetchQuery }),
        })

        const fetchData = await fetchRes.json()
        console.log(`[autentique] attempt ${attempt} fetch:`, JSON.stringify(fetchData))

        const sigs = fetchData?.data?.document?.signatures || []
        // Busca o link do gestor da escola (não o da Áion)
        const signerSig = sigs.find((s: any) => s.email === signer_email)
          || sigs.find((s: any) => s.email !== VICTOR_EMAIL)
          || sigs[0]

        signUrl = signerSig?.link?.short_link || null

        if (signUrl) {
          console.log('[autentique] signUrl encontrado:', signUrl)
          break
        }

        console.log(`[autentique] attempt ${attempt}: link ainda null, tentando novamente...`)
      }
    }

    // 8. Salvar no banco
    const contractData = {
      status: 'sent',
      sign_url: signUrl,
      autentique_document_id: documentId,
      signer_name,
      signer_email,
    }

    if (contract_id) {
      await sb.from('contracts').update(contractData).eq('id', contract_id)
    } else if (institution_id) {
      await sb.from('contracts').insert({
        institution_id,
        ...contractData,
        plan: 'escola',
        monthly_value: monthly_value || 0,
      })
    }

    if (institution_id) {
      await sb.from('institutions')
        .update({ plan_status: 'pending_contract' })
        .eq('id', institution_id)
    }

    // 9. Notificação para o super admin
    await sb.from('system_notifications').insert({
      institution_id: null,
      type: 'milestone',
      title: `Contrato enviado — ${inst?.name || school_name}`,
      message: `Contrato enviado para assinatura de ${signer_name} (${signer_email}).`,
      severity: 'success',
      action_url: '/super-admin/contracts',
    })

    return new Response(
      JSON.stringify({ ok: true, signUrl, documentId }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[autentique] erro:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: CORS }
    )
  }
})
