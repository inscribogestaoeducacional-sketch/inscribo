import React, { useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { SHARED_CSS } from '../styles/sharedCSS'

export default function Termos() {
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'aion-css'
    el.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(el)
    return () => { document.getElementById('aion-css')?.remove() }
  }, [])

  const sections = [
    { title: '1. Objeto', body: 'Estes Termos de Uso regulam o acesso e a utilização da plataforma ÁION EDU, de titularidade da ÁION Soluções Tecnológicas Ltda. (CNPJ 65.835.064/0001-58), com sede em Patos, Paraíba — Brasil. Ao acessar ou utilizar a plataforma, o usuário concorda integralmente com os termos aqui estabelecidos.' },
    { title: '2. Cadastro e acesso', body: 'O acesso à plataforma requer cadastro válido com informações verídicas. O usuário é responsável pela confidencialidade de suas credenciais de acesso e por todas as atividades realizadas com sua conta. A ÁION EDU pode suspender ou encerrar contas que violem estes termos, com ou sem aviso prévio, dependendo da gravidade da infração.' },
    { title: '3. Uso da plataforma', body: 'A plataforma ÁION EDU é disponibilizada para uso exclusivo das instituições de ensino privadas e seus colaboradores, para fins de gestão de campanhas de matrícula e atendimento a famílias. É vedado: compartilhar acesso com terceiros não autorizados; utilizar a plataforma para fins ilícitos; realizar engenharia reversa, cópia ou reprodução não autorizada; sobrecarregar intencionalmente os servidores da plataforma.' },
    { title: '4. Pagamentos e renovação', body: 'Os valores e condições de pagamento são definidos no contrato de serviço firmado entre a ÁION EDU e a instituição contratante. O não pagamento nas datas acordadas pode resultar na suspensão temporária ou encerramento do acesso à plataforma, conforme estabelecido no contrato.' },
    { title: '5. Propriedade intelectual', body: 'Todo o conteúdo da plataforma ÁION EDU — incluindo código-fonte, design, textos, logotipos, algoritmos e funcionalidades — é de propriedade exclusiva da ÁION Soluções Tecnológicas Ltda. e protegido pelas leis de propriedade intelectual vigentes. É vedada qualquer reprodução, distribuição ou modificação sem autorização expressa e por escrito.' },
    { title: '6. Limitação de responsabilidade', body: 'A ÁION EDU não se responsabiliza por: decisões tomadas pelos usuários com base nos dados da plataforma; resultados de campanhas de matrícula; indisponibilidade temporária por manutenção ou falhas de terceiros; danos causados por uso inadequado da plataforma. A responsabilidade total da ÁION EDU está limitada ao valor pago pelo contratante nos últimos 12 meses.' },
    { title: '7. Rescisão', body: 'Qualquer das partes pode rescindir o contrato mediante aviso prévio de 30 (trinta) dias. Em caso de violação grave dos presentes termos, a ÁION EDU pode rescindir o contrato de forma imediata. Após a rescisão, o acesso à plataforma será encerrado e os dados do cliente serão retidos conforme a Política de Privacidade.' },
    { title: '8. Foro e legislação aplicável', body: 'Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Para a resolução de conflitos, fica eleito o foro da Comarca de Patos, Paraíba, com renúncia expressa a qualquer outro, por mais privilegiado que seja. Tentaremos resolver disputas de forma amigável antes de qualquer medida judicial.' },
  ]

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section style={{ background: '#F4F7F5', padding: '140px 48px 60px', textAlign: 'center' }}>
          <div className="tag-g" style={{ display: 'inline-flex', marginBottom: 20 }}>Legal</div>
          <h1 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#111827', marginBottom: 16 }}>Termos de Uso</h1>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 540, margin: '0 auto', lineHeight: 1.8 }}>
            Condições gerais de uso da plataforma ÁION EDU para instituições de ensino e seus colaboradores.
          </p>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>Última atualização: 01 de janeiro de 2026</p>
        </section>

        {/* Content */}
        <section style={{ padding: '64px 48px 112px', background: '#fff' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ background: '#FFFBEB', borderRadius: 16, padding: '20px 24px', marginBottom: 48, border: '1px solid #FDE68A' }}>
              <p style={{ fontSize: 14, color: '#92400E', lineHeight: 1.8, fontWeight: 600 }}>
                Ao acessar ou utilizar a plataforma ÁION EDU, você confirma que leu, entendeu e concorda com estes Termos de Uso na íntegra. Caso não concorde, não utilize a plataforma.
              </p>
            </div>

            {sections.map((s, i) => (
              <div key={i} style={{ marginBottom: 40 }}>
                <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 20, color: '#111827', marginBottom: 14, letterSpacing: '-.02em' }}>{s.title}</h2>
                <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.9 }}>{s.body}</p>
                {i < sections.length - 1 && <div style={{ height: 1, background: '#F3F4F6', marginTop: 40 }} />}
              </div>
            ))}

            <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '24px', marginTop: 20, border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                <strong>Dúvidas sobre os termos?</strong> Entre em contato pelo WhatsApp{' '}
                <a href="https://wa.me/5583933444383" style={{ color: '#00A896', fontWeight: 700 }}>(83) 9344-4383</a>{' '}
                ou pelo e-mail <a href="mailto:contato@aionedu.com.br" style={{ color: '#00A896', fontWeight: 700 }}>contato@aionedu.com.br</a>.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
