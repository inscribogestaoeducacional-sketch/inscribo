import React from 'react'

export default function Termos() {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#00523C' }}>Áion Edu</span>
            <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inteligência em matrículas</span>
          </a>
          <a href="/" style={{ fontSize: 14, color: '#00523C', fontWeight: 600, textDecoration: 'none' }}>← Voltar ao início</a>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '48px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>

          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Termos de Uso</h1>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              <strong>AION SOLUCOES TECNOLOGICAS LTDA</strong> · CNPJ: 65.835.064/0001-58
            </p>
            <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Última atualização: abril de 2026</p>
            <div style={{ height: 3, width: 60, background: 'linear-gradient(90deg, #00523C, #00A896)', borderRadius: 2, marginTop: 20 }} />
          </div>

          {[
            {
              title: '1. Aceitação',
              content: (
                <p style={p}>
                  Ao usar a Áion Edu, você concorda com estes Termos de Uso. Caso não concorde, não
                  utilize a plataforma. O uso continuado após alterações nos termos implica aceitação
                  das novas condições.
                </p>
              ),
            },
            {
              title: '2. O serviço',
              content: (
                <>
                  <p style={p}>
                    A Áion Edu é uma plataforma SaaS (Software as a Service) de gestão de matrículas
                    para escolas privadas brasileiras.
                  </p>
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '14px 18px', border: '1px solid #bbf7d0', marginTop: 12 }}>
                    <p style={{ fontSize: 14, color: '#065f46', margin: 0, fontWeight: 600 }}>
                      Plano Escola: R$ 550/mês por instituição · Sem limite de usuários
                    </p>
                  </div>
                </>
              ),
            },
            {
              title: '3. Responsabilidades do usuário',
              content: (
                <ul style={ul}>
                  <li style={li}>Manter dados de acesso seguros e não compartilhar credenciais</li>
                  <li style={li}>Usar a plataforma apenas para fins legítimos e lícitos</li>
                  <li style={li}>Não inserir dados de terceiros sem consentimento expresso</li>
                  <li style={li}>Manter dados atualizados e precisos</li>
                  <li style={li}>Não realizar engenharia reversa, scraping ou tentativas de acesso indevido</li>
                </ul>
              ),
            },
            {
              title: '4. Responsabilidades da Áion Edu',
              content: (
                <ul style={ul}>
                  <li style={li}>Disponibilidade mínima de 99% ao mês (SLA)</li>
                  <li style={li}>Suporte em horário comercial (seg-sex, 8h–18h, horário de Brasília)</li>
                  <li style={li}>Backup diário dos dados da plataforma</li>
                  <li style={li}>Notificação prévia de manutenções programadas com impacto na disponibilidade</li>
                </ul>
              ),
            },
            {
              title: '5. Pagamento',
              content: (
                <ul style={ul}>
                  <li style={li}>Cobrança mensal no cartão de crédito ou boleto via Asaas</li>
                  <li style={li}>Cancelamento a qualquer momento sem multa ou fidelidade</li>
                  <li style={li}>Reembolso proporcional em caso de interrupção do serviço por falha da Áion Edu</li>
                  <li style={li}>Primeiro mês gratuito para novos clientes</li>
                </ul>
              ),
            },
            {
              title: '6. Propriedade intelectual',
              content: (
                <>
                  <p style={p}>
                    A plataforma Áion Edu, seus algoritmos, interface, código-fonte, marca e demais
                    elementos são propriedade exclusiva da <strong>AION SOLUCOES TECNOLOGICAS LTDA</strong>.
                  </p>
                  <p style={{ ...p, marginTop: 10 }}>
                    Os dados inseridos pelos clientes (leads, matrículas, históricos) pertencem
                    exclusivamente às instituições clientes. A Áion Edu não reivindica propriedade
                    sobre esses dados.
                  </p>
                </>
              ),
            },
            {
              title: '7. Limitação de responsabilidade',
              content: (
                <>
                  <p style={p}>
                    A Áion Edu não se responsabiliza por decisões de negócio tomadas com base nas
                    análises e projeções geradas pela plataforma.
                  </p>
                  <p style={{ ...p, marginTop: 10 }}>
                    As projeções geradas pela IA são estimativas baseadas em dados históricos e
                    tendências de mercado, não constituindo garantia de resultado.
                  </p>
                  <p style={{ ...p, marginTop: 10 }}>
                    A responsabilidade da Áion Edu, em qualquer hipótese, limita-se ao valor pago
                    pelo cliente nos últimos 3 meses de vigência do contrato.
                  </p>
                </>
              ),
            },
            {
              title: '8. Rescisão',
              content: (
                <p style={p}>
                  Qualquer parte pode encerrar o contrato a qualquer momento, com ou sem aviso prévio.
                  Recomendamos aviso prévio de 30 dias para possibilitar a exportação adequada dos dados.
                  Após o encerramento, os dados ficam disponíveis para exportação por 30 dias.
                </p>
              ),
            },
            {
              title: '9. Alterações nos termos',
              content: (
                <p style={p}>
                  A Áion Edu pode atualizar estes Termos a qualquer momento. Usuários serão notificados
                  por e-mail com pelo menos 15 dias de antecedência em caso de mudanças materiais.
                  O uso continuado após a vigência das alterações constitui aceitação.
                </p>
              ),
            },
            {
              title: '10. Foro',
              content: (
                <p style={p}>
                  Fica eleito o foro da Comarca de Patos, Estado da Paraíba, Brasil, para dirimir
                  quaisquer controvérsias decorrentes destes Termos, com renúncia expressa a qualquer
                  outro, por mais privilegiado que seja.
                </p>
              ),
            },
            {
              title: '11. Contato',
              content: (
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '16px 20px', border: '1px solid #bbf7d0' }}>
                  <p style={{ fontSize: 14, color: '#065f46', lineHeight: 1.8, margin: 0 }}>
                    <strong>AION SOLUCOES TECNOLOGICAS LTDA</strong><br />
                    CNPJ: 65.835.064/0001-58<br />
                    R. Francisco Vicente de Araújo, 48 · Bela Vista · Patos - PB · CEP 58.704-560<br />
                    contato@aionedu.com.br · (83) 9855-6393
                  </p>
                </div>
              ),
            },
          ].map((section, i) => (
            <div key={i} style={{ marginBottom: 36, paddingBottom: 36, borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#00523C', marginBottom: 14 }}>{section.title}</h2>
              {section.content}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#0a1628', color: '#6b7280', textAlign: 'center', padding: '20px 24px', fontSize: 12 }}>
        © 2026 Áion Edu — AION SOLUCOES TECNOLOGICAS LTDA · CNPJ 65.835.064/0001-58 ·{' '}
        <a href="/privacidade" style={{ color: '#9ca3af', textDecoration: 'none' }}>Política de Privacidade</a>
      </div>
    </div>
  )
}

const p: React.CSSProperties = { fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0 }
const ul: React.CSSProperties = { paddingLeft: 20, margin: 0 }
const li: React.CSSProperties = { fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 4 }
