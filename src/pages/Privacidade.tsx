import React from 'react'

export default function Privacidade() {
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
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Política de Privacidade</h1>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              <strong>AION SOLUCOES TECNOLOGICAS LTDA</strong> · CNPJ: 65.835.064/0001-58
            </p>
            <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Última atualização: abril de 2026</p>
            <div style={{ height: 3, width: 60, background: 'linear-gradient(90deg, #00523C, #00A896)', borderRadius: 2, marginTop: 20 }} />
          </div>

          {[
            {
              id: 'quem-somos',
              title: '1. Quem somos',
              content: (
                <p style={p}>
                  A Áion Edu é uma plataforma de gestão de matrículas operada pela <strong>AION SOLUCOES
                  TECNOLOGICAS LTDA</strong>, inscrita no CNPJ 65.835.064/0001-58, com sede em R. Francisco
                  Vicente de Araújo, 48, Bela Vista, Patos - PB.
                </p>
              ),
            },
            {
              id: 'dados',
              title: '2. Dados que coletamos',
              content: (
                <ul style={ul}>
                  <li style={li}><strong>Dados de identificação:</strong> nome, e-mail, telefone, cargo</li>
                  <li style={li}><strong>Dados da instituição:</strong> nome da escola, CNPJ, cidade, estado</li>
                  <li style={li}><strong>Dados operacionais:</strong> leads, visitas, matrículas inseridos pelos usuários</li>
                  <li style={li}><strong>Dados de uso:</strong> logs de acesso, funcionalidades utilizadas</li>
                </ul>
              ),
            },
            {
              id: 'uso',
              title: '3. Como usamos seus dados',
              content: (
                <ul style={ul}>
                  <li style={li}>Prestação do serviço contratado</li>
                  <li style={li}>Melhoria contínua da plataforma</li>
                  <li style={li}>Comunicação sobre atualizações e novidades</li>
                  <li style={li}>Análise agregada e anônima de uso</li>
                </ul>
              ),
            },
            {
              id: 'compartilhamento',
              title: '4. Compartilhamento',
              content: (
                <>
                  <p style={p}>Não vendemos dados. Compartilhamos apenas com:</p>
                  <ul style={ul}>
                    <li style={li}>Provedores de infraestrutura (Supabase, Vercel, Anthropic)</li>
                    <li style={li}>Quando exigido por lei ou autoridade competente</li>
                  </ul>
                </>
              ),
            },
            {
              id: 'lgpd',
              title: '5. Seus direitos (LGPD)',
              content: (
                <>
                  <p style={p}>Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:</p>
                  <ul style={ul}>
                    <li style={li}>Acessar seus dados</li>
                    <li style={li}>Corrigir dados incorretos</li>
                    <li style={li}>Solicitar exclusão</li>
                    <li style={li}>Revogar consentimento</li>
                  </ul>
                  <p style={{ ...p, marginTop: 12 }}>
                    Para exercer seus direitos, entre em contato: <strong>contato@aionedu.com.br</strong>
                  </p>
                </>
              ),
            },
            {
              id: 'retencao',
              title: '6. Retenção',
              content: (
                <p style={p}>
                  Dados são mantidos enquanto o contrato estiver ativo, acrescido de 5 anos para
                  cumprimento de obrigações legais.
                </p>
              ),
            },
            {
              id: 'seguranca',
              title: '7. Segurança',
              content: (
                <p style={p}>
                  Utilizamos criptografia em trânsito e em repouso, autenticação segura com múltiplos
                  fatores disponível, e Row Level Security no banco de dados para garantir que cada
                  instituição acesse apenas seus próprios dados.
                </p>
              ),
            },
            {
              id: 'cookies',
              title: '8. Cookies',
              content: (
                <p style={p}>
                  Utilizamos cookies essenciais para funcionamento da plataforma e analytics anônimos
                  para melhoria contínua do serviço. Não utilizamos cookies para fins publicitários.
                </p>
              ),
            },
            {
              id: 'contato',
              title: '9. Contato',
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
          ].map(section => (
            <div key={section.id} id={section.id} style={{ marginBottom: 36, paddingBottom: 36, borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#00523C', marginBottom: 14 }}>{section.title}</h2>
              {section.content}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#0a1628', color: '#6b7280', textAlign: 'center', padding: '20px 24px', fontSize: 12 }}>
        © 2026 Áion Edu — AION SOLUCOES TECNOLOGICAS LTDA · CNPJ 65.835.064/0001-58 ·{' '}
        <a href="/termos" style={{ color: '#9ca3af', textDecoration: 'none' }}>Termos de Uso</a>
      </div>
    </div>
  )
}

const p: React.CSSProperties = { fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0 }
const ul: React.CSSProperties = { paddingLeft: 20, margin: 0 }
const li: React.CSSProperties = { fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 4 }
