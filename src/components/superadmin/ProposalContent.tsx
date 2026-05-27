import { useEffect } from 'react'
import AION_LOGO_B64 from '../../lib/aionLogo'

export interface ProposalData {
  client_name: string
  school_name: string
  proposal_date?: string
  created_at?: string
  implementation_normal: number
  implementation_special: number
  monthly_normal: number
  monthly_special: number
  special_deadline?: string
  validity_days: number
  consultant_name?: string
  consultant_phone?: string
  consultant_email?: string
  consultant_site?: string
}

// A4 landscape at comfortable preview scale (ratio 297/210 ≈ 1.4143)
export const PW = 900
export const PH = 637

const VD = '#00523C'
const VM = '#00A896'
const VC = '#0DD3BF'
const AZUL = '#1A2B4A'
const CMID = '#64748B'
const CLIGHT = '#94A3B8'
const BORDA = '#E2E8F0'
const GRAD = 'linear-gradient(135deg, #00523C, #006B50, #00A896)'
const GRAD2 = 'linear-gradient(135deg, #00A896, #0DD3BF)'

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const MODULE_LIST = [
  { icon: 'ti-home',                  name: 'Início / Dashboard', desc: 'Visão geral da campanha, metas e indicadores em tempo real.' },
  { icon: 'ti-users',                 name: 'Leads',              desc: 'Pipeline completo do lead até a matrícula, com histórico.' },
  { icon: 'ti-address-book',          name: 'Contatos',           desc: 'Cadastro centralizado de famílias e responsáveis.' },
  { icon: 'ti-calendar',              name: 'Visitas',            desc: 'Agendamento, confirmação e taxa de comparecimento.' },
  { icon: 'ti-brand-whatsapp',        name: 'WhatsApp',           desc: 'Equipe toda atendendo no número oficial Meta da escola.' },
  { icon: 'ti-chart-bar',             name: 'Relatórios',         desc: 'Conversão, CPA, desempenho por consultor e rematrícula.' },
  { icon: 'ti-arrows-transfer-down',  name: 'Transferências',     desc: 'Rastreia motivo real da saída e oportunidades de retenção.' },
  { icon: 'ti-mood-smile',            name: 'Pesquisas',          desc: 'NPS e satisfação das famílias organizados por IA.' },
  { icon: 'ti-user-circle',           name: 'Usuários',           desc: 'Gestão de equipe com permissões e produtividade.' },
  { icon: 'ti-settings',              name: 'Configurações',      desc: 'Personalização completa dos fluxos da escola.' },
]

const HOW_IT_WORKS = [
  { icon: 'ti-search',     title: 'Diagnóstico', desc: 'Mapeamos os dados da sua escola e criamos o plano de campanha' },
  { icon: 'ti-settings',   title: 'Implantação', desc: 'Configuramos tudo em até 2 dias úteis' },
  { icon: 'ti-school',     title: 'Treinamento', desc: 'Sua equipe aprende na prática, com suporte direto' },
  { icon: 'ti-handshake',  title: 'Suporte',     desc: 'Acompanhamento contínuo durante toda a campanha' },
]

const INCLUDES = [
  'Configuração completa da conta',
  'Integração com ERP da escola',
  'Homologação WhatsApp Oficial Meta',
  'Personalização dos fluxos',
  'Definição das metas iniciais',
  'Treinamento da equipe',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogoPill() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      borderRadius: 14,
      padding: '10px 24px',
      display: 'inline-flex',
      alignItems: 'center',
    }}>
      <img src={AION_LOGO_B64} alt="Áion Edu" style={{ height: 36, display: 'block' }} />
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: '#E8F7F4', borderRadius: 100, padding: '5px 14px', marginBottom: 8,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: VM }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: VM, textTransform: 'uppercase', letterSpacing: 1 }}>{children}</span>
    </div>
  )
}

function SectionBar({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
      <div style={{ width: 4, height: 38, background: GRAD2, borderRadius: 2, flexShrink: 0 }} />
      <h2 style={{ fontSize: 28, fontWeight: 800, color: VD, margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.3px' }}>{text}</h2>
    </div>
  )
}

const page: React.CSSProperties = {
  width: PW,
  height: PH,
  overflow: 'hidden',
  position: 'relative',
  boxSizing: 'border-box',
  flexShrink: 0,
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProposalContent({ data }: { data: ProposalData }) {
  useEffect(() => {
    if (!document.querySelector('#tabler-icons-css')) {
      const el = document.createElement('link')
      el.id = 'tabler-icons-css'
      el.rel = 'stylesheet'
      el.href = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css'
      document.head.appendChild(el)
    }
    if (!document.querySelector('#aion-proposal-fonts')) {
      const el = document.createElement('link')
      el.id = 'aion-proposal-fonts'
      el.rel = 'stylesheet'
      el.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
      document.head.appendChild(el)
    }
  }, [])

  const rawDate = data.proposal_date
    ? data.proposal_date + 'T12:00:00'
    : data.created_at || null

  const proposalDate = rawDate
    ? new Date(rawDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  const deadline = data.special_deadline
    ? new Date(data.special_deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const isFreeImpl = Number(data.implementation_special) === 0

  // ── PAGE 1: CAPA ─────────────────────────────────────────────────────────────
  const page1 = (
    <div className="proposal-page" data-proposal-page style={{ ...page, background: GRAD, padding: '32px 40px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 380, height: 380, borderRadius: '50%', background: 'rgba(13,211,191,0.11)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, position: 'relative', zIndex: 1 }}>
        <LogoPill />
        <div style={{ background: `rgba(13,211,191,0.18)`, border: `1px solid ${VC}`, borderRadius: 100, padding: '7px 18px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: VC }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: VC }}>Proposta Comercial</span>
        </div>
      </div>

      {/* Headline */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, color: '#fff', margin: '0 0 14px', fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1.08, letterSpacing: '-0.5px', maxWidth: 660 }}>
          Plataforma de Matrículas e<br />Atendimento Escolar
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', margin: '0 0 30px', maxWidth: 520, lineHeight: 1.65 }}>
          Da primeira visita ao aluno matriculado — gestão completa do ciclo de captação.
        </p>

        {/* Info cards 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 580 }}>
          {[
            { label: 'Apresentado para', value: data.client_name || '—' },
            { label: 'Escola',            value: data.school_name || '—' },
            { label: 'Consultor',         value: data.consultant_name || '—' },
            { label: 'Data',              value: proposalDate },
          ].map(c => (
            <div key={c.label} style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 12, padding: '14px 18px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.52)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5, fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{c.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── PAGE 2: SOBRE ─────────────────────────────────────────────────────────────
  const page2 = (
    <div className="proposal-page" data-proposal-page style={{ ...page, background: '#fff', padding: '36px 48px' }}>
      <SectionBar text="Sobre a Áion Edu" />
      <p style={{ fontSize: 14, color: CMID, lineHeight: 1.75, margin: '0 0 22px', maxWidth: 780 }}>
        A campanha de matrículas da sua escola começa AGORA com a <strong style={{ color: VD }}>ÁION EDU</strong>!
        A ÁION EDU lê os dados da sua escola, cria um plano de campanha com metas e ações,
        centraliza o atendimento das famílias e entrega ao gestor visibilidade total —
        do primeiro contato até a matrícula assinada.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {MODULE_LIST.map(mod => (
          <div key={mod.name} style={{ background: '#F8FAFC', border: `1px solid ${BORDA}`, borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
            <i className={`ti ${mod.icon}`} style={{ fontSize: 24, color: VM, display: 'block', marginBottom: 8 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: AZUL, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1.3 }}>{mod.name}</div>
          </div>
        ))}
      </div>
    </div>
  )

  // ── PAGE 3: 10 MÓDULOS DETALHADO ─────────────────────────────────────────────
  const page3 = (
    <div className="proposal-page" data-proposal-page style={{ ...page, background: '#F0F4F8', padding: '26px 36px' }}>
      <div style={{ marginBottom: 14 }}>
        <Tag>Funcionalidades</Tag>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: AZUL, margin: '2px 0 4px', fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.3px' }}>
          10 módulos. Em um só lugar.
        </h2>
        <p style={{ fontSize: 13, color: CMID, margin: 0 }}>Integrados, inteligentes e prontos para a sua campanha.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 9, marginBottom: 14 }}>
        {MODULE_LIST.map(mod => (
          <div key={mod.name} style={{ background: '#fff', border: `1px solid ${BORDA}`, borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#e8f7f4,#c8ede7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 9px' }}>
              <i className={`ti ${mod.icon}`} style={{ fontSize: 21, color: VM }} />
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: AZUL, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 4, lineHeight: 1.25 }}>{mod.name}</div>
            <div style={{ fontSize: 10, color: CMID, lineHeight: 1.5 }}>{mod.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'linear-gradient(135deg,#00523C,#00A896)', borderRadius: 12, padding: '13px 22px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <i className="ti ti-circle-check-filled" style={{ fontSize: 20, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Sua secretaria configura em 2 dias. Sem projeto, sem TI, sem custo oculto.</span>
      </div>
    </div>
  )

  // ── PAGE 4: COMO FUNCIONA ─────────────────────────────────────────────────────
  const page4 = (
    <div className="proposal-page" data-proposal-page style={{ ...page, background: '#fff', padding: '36px 48px' }}>
      <div style={{ marginBottom: 26 }}>
        <Tag>Metodologia</Tag>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: AZUL, margin: '2px 0 0', fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.3px' }}>
          Como funciona
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {HOW_IT_WORKS.map((step, i) => (
          <div key={step.title} style={{ background: '#F8FAFC', border: `1px solid ${BORDA}`, borderRadius: 16, padding: '26px 20px 22px' }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: VC, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, marginBottom: 14 }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <i className={`ti ${step.icon}`} style={{ fontSize: 28, color: VM, display: 'block', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: AZUL, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 8 }}>{step.title}</div>
            <div style={{ fontSize: 12, color: CMID, lineHeight: 1.65 }}>{step.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )

  // ── PAGE 5: INVESTIMENTO ──────────────────────────────────────────────────────
  const page5 = (
    <div className="proposal-page" data-proposal-page style={{ ...page, background: '#F0F4F8', padding: '28px 48px' }}>
      {deadline && (
        <div style={{ background: 'linear-gradient(135deg,#00523C,#00A896)', borderRadius: 10, padding: '10px 20px', color: '#fff', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ti ti-bolt" style={{ fontSize: 18 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Condição especial válida até {deadline}</span>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <Tag>Investimento</Tag>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: AZUL, margin: '2px 0 0', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          Condições especiais para a sua escola
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Implantação */}
        <div style={{ background: '#fff', border: `1px solid ${BORDA}`, borderRadius: 20, padding: '26px 30px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Taxa de Implantação</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: AZUL, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 18 }}>Setup completo da plataforma</div>
          <div style={{ fontSize: 13, color: CLIGHT, textDecoration: 'line-through', marginBottom: 8 }}>De: {fmtBRL(data.implementation_normal)}</div>
          {isFreeImpl ? (
            <>
              <div style={{ fontSize: 52, fontWeight: 900, color: VD, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, letterSpacing: '-2px' }}>GRÁTIS</div>
              <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E8F7F4', borderRadius: 100, padding: '5px 14px' }}>
                <span style={{ fontSize: 13 }}>🎁</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: VD }}>Implantação gratuita</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 52, fontWeight: 900, color: VD, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, letterSpacing: '-2px' }}>{fmtBRL(data.implementation_special)}</div>
              <div style={{ fontSize: 12, color: VM, fontWeight: 600, marginTop: 8 }}>Economia de {fmtBRL(data.implementation_normal - data.implementation_special)}</div>
            </>
          )}
          <div style={{ fontSize: 11, color: CLIGHT, marginTop: 14 }}>Válido para fechamento no prazo da proposta</div>
        </div>

        {/* Mensalidade */}
        <div style={{ background: '#fff', border: `1px solid ${VM}`, borderRadius: 20, padding: '26px 30px', position: 'relative', boxShadow: '0 0 24px rgba(0,168,150,0.12)' }}>
          <div style={{ position: 'absolute', top: 18, right: 18, background: GRAD2, borderRadius: 100, padding: '4px 12px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>ESPECIAL</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Mensalidade da Plataforma</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: AZUL, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 18 }}>Acesso completo · Todos os 10 módulos</div>
          <div style={{ fontSize: 13, color: CLIGHT, textDecoration: 'line-through', marginBottom: 8 }}>De: {fmtBRL(data.monthly_normal)}/mês</div>
          <div style={{ fontSize: 52, fontWeight: 900, color: VD, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, letterSpacing: '-2px' }}>
            {fmtBRL(data.monthly_special)}<span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 0 }}>/mês</span>
          </div>
          <div style={{ fontSize: 13, color: VM, fontWeight: 700, marginTop: 8 }}>Você economiza {fmtBRL(data.monthly_normal - data.monthly_special)}/mês</div>
        </div>
      </div>
    </div>
  )

  // ── PAGE 6: O QUE ESTÁ INCLUSO ────────────────────────────────────────────────
  const page6 = (
    <div className="proposal-page" data-proposal-page style={{ ...page, background: '#fff', padding: '36px 48px' }}>
      <div style={{ marginBottom: 24 }}>
        <Tag>Incluso</Tag>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: AZUL, margin: '2px 0 0', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          O que está incluso na implantação
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 26 }}>
        {INCLUDES.map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: '#F8FAFC', border: `1px solid ${BORDA}`, borderRadius: 12 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-check" style={{ fontSize: 14, color: '#fff' }} />
            </div>
            <span style={{ fontSize: 13, color: AZUL, fontWeight: 600 }}>{item}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border: '2px solid #FDE68A', borderRadius: 14, padding: '20px 26px', display: 'flex', gap: 18, alignItems: 'center' }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 34, color: '#92400E', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#92400E', fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 5 }}>
            Proposta válida por {data.validity_days} dias
          </div>
          <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.65 }}>
            {deadline
              ? `Os valores especiais estão disponíveis até ${deadline}. Após essa data, os preços retornarão ao normal.`
              : `Esta proposta é válida por ${data.validity_days} dias a partir da data de envio.`}
          </div>
        </div>
      </div>
    </div>
  )

  // ── PAGE 7: RODAPÉ / CTA ──────────────────────────────────────────────────────
  const page7 = (
    <div className="proposal-page" data-proposal-page style={{ ...page, background: GRAD, padding: '36px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 380, height: 380, borderRadius: '50%', background: 'rgba(13,211,191,0.10)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 22 }}><LogoPill /></div>

        <h2 style={{ fontSize: 44, fontWeight: 900, color: '#fff', fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.5px', maxWidth: 680, margin: '0 auto 26px', lineHeight: 1.1 }}>
          Sua escola pronta para a<br />próxima campanha.
        </h2>

        {/* 3 pillars */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
          {['Mais Controle', 'Mais Previsibilidade', 'Mais Matrículas'].map((p, i) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.3)', margin: '0 20px' }} />}
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{p}</span>
            </div>
          ))}
        </div>

        {/* Consultant card */}
        {data.consultant_name && (
          <div style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 16, padding: '18px 32px', display: 'inline-block', marginBottom: 20, minWidth: 280 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Seu consultor</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 10 }}>{data.consultant_name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.consultant_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <i className="ti ti-phone" style={{ fontSize: 13, color: VC }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{data.consultant_phone}</span>
                </div>
              )}
              {data.consultant_email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <i className="ti ti-mail" style={{ fontSize: 13, color: VC }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{data.consultant_email}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <i className="ti ti-world" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {data.consultant_site || 'aionedu.com.br'} · Todos os direitos reservados
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {page1}
      {page2}
      {page3}
      {page4}
      {page5}
      {page6}
      {page7}
    </div>
  )
}
