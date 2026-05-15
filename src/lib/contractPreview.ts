// src/lib/contractPreview.ts
// Renderiza o HTML do contrato no frontend para preview, sem chamada de API.
// O template é cópia do autentique/index.ts — NÃO alterar o template lá sem espelhar aqui.

export interface ContractVars {
  escola: string
  cnpj?: string
  endereco?: string
  cidade_uf?: string
  gestor: string
  cargo_gestor?: string
  cpf_gestor?: string
  email_gestor?: string
  telefone_gestor?: string
  valor_implantacao?: string
  valor_mensal?: string
  dia_vencimento?: string
  data_inicio?: string
  consultor?: string
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function buildContractVars(opts: {
  institution: {
    name?: string; cnpj?: string; address?: string; city?: string; state?: string
    billing_due_day?: string | number; phone?: string
  }
  signer: { name: string; role?: string; cpf?: string; email?: string; phone?: string }
  monthly_value?: number
  implementation_value?: number
  contract_start_date?: string
  consultant_name?: string
}): ContractVars {
  const { institution: inst, signer, monthly_value, implementation_value, contract_start_date, consultant_name } = opts
  const startDate = contract_start_date
    ? new Date(contract_start_date + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR')

  return {
    escola:            inst.name || '',
    cnpj:              inst.cnpj || '',
    endereco:          inst.address || '',
    cidade_uf:         `${inst.city || ''}/${inst.state || ''}`,
    gestor:            signer.name,
    cargo_gestor:      signer.role || 'Diretor',
    cpf_gestor:        signer.cpf || '',
    email_gestor:      signer.email || '',
    telefone_gestor:   signer.phone || inst.phone || '',
    valor_implantacao: implementation_value !== undefined ? fmtBRL(Number(implementation_value)) : 'R$ 0,00',
    valor_mensal:      monthly_value !== undefined ? fmtBRL(Number(monthly_value)) : 'R$ 0,00',
    dia_vencimento:    String(inst.billing_due_day || '10'),
    data_inicio:       startDate,
    consultor:         consultant_name || 'Equipe Áion Edu',
  }
}

export function renderContractHtml(vars: ContractVars): string {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
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
      <span class="parte-text"><strong>${vars.escola}</strong>${vars.cnpj ? `, pessoa jurídica inscrita no CNPJ sob o nº ${vars.cnpj}` : ''}, com sede em ${vars.endereco ? vars.endereco + ', ' : ''}${vars.cidade_uf || ''}, neste ato representada por <strong>${vars.gestor}</strong>${vars.cpf_gestor ? `, portador(a) do CPF nº ${vars.cpf_gestor}` : ''}, na qualidade de ${vars.cargo_gestor || 'Diretor'}, doravante denominada <strong>CONTRATANTE</strong> ou <strong>ESCOLA</strong>.</span>
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
      <li><strong>Taxa de Implantação (pagamento único):</strong> ${vars.valor_implantacao || 'R$ 0,00'}, devida no ato da assinatura deste contrato;</li>
      <li><strong>Mensalidade:</strong> ${vars.valor_mensal || 'R$ 0,00'}, com vencimento no dia ${vars.dia_vencimento || '10'} de cada mês, a partir do mês subsequente à assinatura.</li>
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

    <p style="text-align:center;font-size:12px;color:#374151;font-weight:700;margin-bottom:24px;">CONTRATADA – ÁION SOLUÇÕES TECNOLÓGICAS LTDA</p>
    <div class="assin-grid">
      <div class="assin-box">
        <div class="assin-line"></div>
        <div class="assin-name">FÁBIO FRANCISCO DOS SANTOS</div>
        <div class="assin-role">Sócio Administrador</div>
        <div class="assin-cpf">CPF: 058.009.844-33</div>
      </div>
      <div class="assin-box">
        <div class="assin-line"></div>
        <div class="assin-name">JOSE VICTOR DE ALMEIDA ARAUJO</div>
        <div class="assin-role">Sócio</div>
        <div class="assin-cpf">CPF: 092.820.714-56</div>
      </div>
    </div>

    <p style="text-align:center;font-size:12px;color:#374151;font-weight:700;margin-bottom:24px;">CONTRATANTE</p>
    <div class="assin-grid" style="grid-template-columns:1fr;">
      <div class="assin-box">
        <div class="assin-line" style="margin:0 80px 8px;"></div>
        <div class="assin-name">${vars.gestor}</div>
        <div class="assin-role">${vars.cargo_gestor || 'Diretor'} – ${vars.escola}</div>
        <div class="assin-cpf">CPF: ${vars.cpf_gestor || ''}</div>
      </div>
    </div>
  </div>

</div>

<div class="footer">
  <p>Áion Soluções Tecnológicas LTDA • CNPJ 65.835.064/0001-58 • Patos/PB</p>
  <span class="badge">Preview — Contrato Áion Edu</span>
  <p>Gerado em ${hoje}</p>
</div>

</body>
</html>`
}
