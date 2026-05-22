import React, { useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { SHARED_CSS } from '../styles/sharedCSS'

export default function Privacidade() {
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'aion-css'
    el.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(el)
    return () => { document.getElementById('aion-css')?.remove() }
  }, [])

  const sections = [
    { title: '1. Dados coletados', body: 'A ÁION EDU coleta os seguintes dados para prestação dos serviços contratados: (a) dados de identificação — nome, e-mail, número de telefone e WhatsApp, cargo e nome da instituição de ensino; (b) dados de uso da plataforma — registros de acesso, logs de atividade, funcionalidades utilizadas e preferências de configuração; (c) dados das famílias e leads cadastrados pelas instituições — gerenciados pelos próprios usuários da plataforma; (d) dados de comunicação — histórico de conversas via WhatsApp gerado no uso da plataforma.' },
    { title: '2. Finalidade do tratamento', body: 'Os dados são utilizados exclusivamente para: prestação dos serviços contratados; melhoria contínua da plataforma; comunicação sobre atualizações e suporte técnico; cumprimento de obrigações legais e contratuais; geração de relatórios e análises para os usuários da plataforma. Não utilizamos dados para fins publicitários de terceiros.' },
    { title: '3. Compartilhamento de dados', body: 'Não vendemos, alugamos ou cedemos seus dados a terceiros. Compartilhamos dados apenas com: prestadores de serviços necessários para o funcionamento da plataforma (servidores, serviços de e-mail, autenticação), sempre sob contrato de confidencialidade; autoridades públicas quando exigido por lei; adquirente em caso de fusão ou aquisição da empresa, com manutenção das garantias desta política.' },
    { title: '4. Retenção de dados', body: 'Os dados são retidos pelo período necessário para a prestação dos serviços e por até 5 (cinco) anos após o encerramento do contrato, para cumprimento de obrigações legais. Após esse prazo, os dados são excluídos ou anonimizados de forma segura.' },
    { title: '5. Direitos do titular', body: 'Conforme a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), você tem direito a: confirmação da existência de tratamento; acesso aos seus dados; correção de dados incompletos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade dos dados; eliminação dos dados tratados com consentimento; informação sobre entidades com quem compartilhamos dados; revogação do consentimento. Para exercer esses direitos, entre em contato: privacidade@aionedu.com.br' },
    { title: '6. Cookies e rastreamento', body: 'Utilizamos cookies estritamente necessários para autenticação e funcionamento da plataforma. Cookies analíticos (para melhoria do produto) são utilizados de forma anonimizada. Você pode desabilitar cookies no seu navegador, mas isso pode afetar o funcionamento de algumas funcionalidades.' },
    { title: '7. Contato', body: 'Para dúvidas, solicitações ou exercício de direitos relacionados aos seus dados pessoais, entre em contato com nosso Encarregado de Proteção de Dados (DPO): E-mail: privacidade@aionedu.com.br — WhatsApp: (83) 9344-4383 — ÁION Soluções Tecnológicas Ltda. — CNPJ 65.835.064/0001-58 — Patos, Paraíba — Brasil.' },
    { title: '8. Atualizações desta política', body: 'Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças na legislação ou na operação da plataforma. Notificaremos os usuários sobre mudanças relevantes por e-mail ou aviso na plataforma. A versão atual está vigente desde 01 de janeiro de 2026.' },
  ]

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section style={{ background: '#F4F7F5', padding: '140px 48px 60px', textAlign: 'center' }}>
          <div className="tag-g" style={{ display: 'inline-flex', marginBottom: 20 }}>Legal</div>
          <h1 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#111827', marginBottom: 16 }}>Política de Privacidade</h1>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 540, margin: '0 auto', lineHeight: 1.8 }}>
            Como coletamos, usamos e protegemos seus dados pessoais em conformidade com a LGPD.
          </p>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>Última atualização: 01 de janeiro de 2026</p>
        </section>

        {/* Content */}
        <section style={{ padding: '64px 48px 112px', background: '#fff' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ background: '#E6F7F5', borderRadius: 16, padding: '20px 24px', marginBottom: 48, border: '1px solid #A7F3D0' }}>
              <p style={{ fontSize: 14, color: '#00523C', lineHeight: 1.8, fontWeight: 600 }}>
                A ÁION Soluções Tecnológicas Ltda. está comprometida com a proteção da sua privacidade e com o cumprimento da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018). Esta política descreve como tratamos as informações coletadas em nossa plataforma.
              </p>
            </div>

            {sections.map((s, i) => (
              <div key={i} style={{ marginBottom: 40 }}>
                <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 20, color: '#111827', marginBottom: 14, letterSpacing: '-.02em' }}>{s.title}</h2>
                <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.9 }}>{s.body}</p>
                {i < sections.length - 1 && <div style={{ height: 1, background: '#F3F4F6', marginTop: 40 }} />}
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
