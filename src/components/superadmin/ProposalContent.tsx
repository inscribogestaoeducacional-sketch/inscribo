import React, { useEffect } from 'react'
import {
  IcoHome, IcoUsers, IcoAddressBook, IcoCalendar, IcoBrandWhatsapp,
  IcoChartBar, IcoArrowsTransferDown, IcoMoodSmile, IcoUserCircle, IcoSettings,
  IcoAdjustmentsH, IcoPlugConnected, IcoPalette, IcoTarget, IcoSchool, IcoHeartHandshake,
  IcoClock, IcoRocket, IcoStar, IcoHeadset, IcoRefresh, IcoChartLine,
  IcoPhone, IcoMail, IcoWorld, IcoCircleCheckFilled,
  IconProps,
} from '../../lib/tablerIcons'

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

// A4 landscape preview (ratio 297/210 ≈ 1.4143)
export const PW = 900
export const PH = 637

// ─── Design tokens ────────────────────────────────────────────────────────────
const VD   = '#00523C'
const VM   = '#00A896'
const VC   = '#0DD3BF'
const AZUL = '#1A2B4A'
const CMID = '#64748B'
const CLIGHT = '#94A3B8'
const BORDA  = '#E2E8F0'
const GRAD   = 'linear-gradient(135deg, #00523C, #006B50, #00A896)'
const GRAD2  = 'linear-gradient(135deg, #00A896, #0DD3BF)'

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Data ────────────────────────────────────────────────────────────────────
export const MODULE_LIST = [
  { Icon: IcoHome,               name: 'Início / Dashboard', desc: 'Visão geral da campanha, metas e indicadores em tempo real.' },
  { Icon: IcoUsers,              name: 'Leads',              desc: 'Pipeline completo do lead até a matrícula, com histórico.' },
  { Icon: IcoAddressBook,        name: 'Contatos',           desc: 'Cadastro centralizado de famílias e responsáveis.' },
  { Icon: IcoCalendar,           name: 'Visitas',            desc: 'Agendamento, confirmação e taxa de comparecimento.' },
  { Icon: IcoBrandWhatsapp,      name: 'WhatsApp',           desc: 'Equipe toda atendendo no número oficial Meta da escola.' },
  { Icon: IcoChartBar,           name: 'Relatórios',         desc: 'Conversão, CPA, desempenho por consultor e rematrícula.' },
  { Icon: IcoArrowsTransferDown, name: 'Transferências',     desc: 'Rastreia motivo real da saída e oportunidades de retenção.' },
  { Icon: IcoMoodSmile,          name: 'Pesquisas',          desc: 'NPS e satisfação das famílias organizados por IA.' },
  { Icon: IcoUserCircle,         name: 'Usuários',           desc: 'Gestão de equipe com permissões e produtividade.' },
  { Icon: IcoSettings,           name: 'Configurações',      desc: 'Personalização completa dos fluxos da escola.' },
]

const HOW_IT_WORKS = [
  { Icon: IcoSettings,       title: 'Implantação', desc: 'Configuramos tudo em até 5 dias úteis' },
  { Icon: IcoSchool,         title: 'Treinamento', desc: 'Sua equipe aprende na prática, com suporte direto' },
  { Icon: IcoHeartHandshake, title: 'Suporte',     desc: 'Acompanhamento contínuo durante toda a campanha' },
]

const INCLUDES: { Icon: (p: IconProps) => React.ReactElement; text: string }[] = [
  { Icon: IcoAdjustmentsH,  text: 'Configuração completa da conta' },
  { Icon: IcoPlugConnected, text: 'Integração com ERP da escola' },
  { Icon: IcoBrandWhatsapp, text: 'Homologação WhatsApp Oficial Meta' },
  { Icon: IcoPalette,       text: 'Personalização dos fluxos' },
  { Icon: IcoTarget,        text: 'Definição das metas iniciais' },
  { Icon: IcoSchool,        text: 'Treinamento da equipe' },
]

const ALSO_INCLUDED: { Icon: (p: IconProps) => React.ReactElement; label: string }[] = [
  { Icon: IcoHeadset,   label: 'Suporte via WhatsApp' },
  { Icon: IcoChartLine, label: 'Relatório mensal' },
  { Icon: IcoRefresh,   label: 'Atualizações gratuitas' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogoPill({ height = 36 }: { height?: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 14, padding: '10px 24px', display: 'inline-flex', alignItems: 'center' }}>
      <img src="/aion-logo-full.png" alt="ÁION EDU" style={{ height, display: 'block' }} />
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#E8F7F4', borderRadius: 100, padding: '5px 14px', marginBottom: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: VM }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: VM, textTransform: 'uppercase', letterSpacing: 1 }}>{children}</span>
    </div>
  )
}

function SectionBar({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <div style={{ width: 4, height: 36, background: GRAD2, borderRadius: 2, flexShrink: 0 }} />
      <h2 style={{ fontSize: 26, fontWeight: 800, color: VD, margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.3px' }}>{text}</h2>
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

  // ── PAGE 1 — CAPA ─────────────────────────────────────────────────────────
  const page1 = (
    <div className="proposal-page" data-proposal-page
      style={{ ...page, background: GRAD, padding: '32px 40px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 380, height: 380, borderRadius: '50%', background: 'rgba(13,211,191,0.11)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, position: 'relative', zIndex: 1 }}>
        <LogoPill />
        <div style={{ background: 'rgba(13,211,191,0.18)', border: `1px solid ${VC}`, borderRadius: 100, padding: '7px 18px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: VC }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: VC }}>Proposta Comercial</span>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, color: '#fff', margin: '0 0 14px', fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1.08, letterSpacing: '-0.5px', maxWidth: 660 }}>
          Plataforma de Matrículas e<br />Atendimento Escolar
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', margin: '0 0 30px', maxWidth: 520, lineHeight: 1.65 }}>
          Da primeira visita ao aluno matriculado — gestão completa do ciclo de captação.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 580 }}>
          {[
            { label: 'Apresentado para', value: data.client_name || '—' },
            { label: 'Escola',           value: data.school_name || '—' },
            { label: 'Consultor',        value: data.consultant_name || '—' },
            { label: 'Data',             value: proposalDate },
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

  // ── PAGE 2 — SOBRE + 10 MÓDULOS (unificada) ───────────────────────────────
  const page2 = (
    <div className="proposal-page" data-proposal-page
      style={{ ...page, background: '#fff', padding: '26px 40px 22px' }}>
      <SectionBar text="Sobre a Áion Edu" />
      <p style={{ fontSize: 13, color: CMID, lineHeight: 1.7, margin: '0 0 16px', maxWidth: 800 }}>
        A campanha de matrículas da sua escola começa AGORA com a{' '}
        <strong style={{ color: VD }}>ÁION EDU</strong>! Lemos os dados da sua escola, criamos
        um plano de campanha com metas e ações, centralizamos o atendimento das famílias e
        entregamos ao gestor visibilidade total — do primeiro contato até a matrícula assinada.
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: AZUL, margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.2px' }}>
          10 módulos. Em um só lugar.
        </h3>
        <span style={{ fontSize: 12, color: CMID }}>Integrados, inteligentes e prontos para a sua campanha.</span>
      </div>

      {/* Grid 5×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
        {MODULE_LIST.map(mod => (
          <div key={mod.name} style={{ background: '#F8FAFC', border: `1px solid ${BORDA}`, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#e8f7f4,#c8ede7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <mod.Icon size={20} color={VM} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: AZUL, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1.25, marginBottom: 4 }}>{mod.name}</div>
            <div style={{ fontSize: 10, color: CMID, lineHeight: 1.45 }}>{mod.desc}</div>
          </div>
        ))}
      </div>

      {/* Banner verde */}
      <div style={{ background: GRAD, borderRadius: 12, padding: '12px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
        <IcoCircleCheckFilled size={18} color="#fff" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Sua secretaria configura em 2 dias. Sem projeto, sem TI, sem custo oculto.</span>
      </div>
    </div>
  )

  // ── PAGE 3 — COMO FUNCIONA (3 passos) ─────────────────────────────────────
  const page3 = (
    <div className="proposal-page" data-proposal-page
      style={{ ...page, background: '#F8FAFC', padding: '40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ marginBottom: 32 }}>
        <Tag>Metodologia</Tag>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: AZUL, margin: '4px 0 0', fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.3px' }}>
          Como funciona
        </h2>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 76, left: '14%', right: '14%', borderTop: '2px dashed rgba(0,168,150,0.3)', zIndex: 0 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, position: 'relative', zIndex: 1 }}>
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} style={{ background: '#fff', border: `1px solid ${BORDA}`, borderRadius: 20, padding: '40px 28px 36px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 72, fontWeight: 900, color: VC, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, marginBottom: 20 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <step.Icon size={52} color={VM} style={{ marginBottom: 20 }} />
              <div style={{ fontSize: 22, fontWeight: 800, color: AZUL, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 12 }}>{step.title}</div>
              <div style={{ fontSize: 16, color: CMID, lineHeight: 1.65 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── PAGE 4 — INVESTIMENTO ──────────────────────────────────────────────────
  const page4 = (
    <div className="proposal-page" data-proposal-page
      style={{ ...page, background: '#F0F4F8', padding: '26px 40px' }}>
      {deadline && (
        <div style={{ background: GRAD, borderRadius: 12, padding: '16px 28px', color: '#fff', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 18px rgba(0,82,60,0.22)' }}>
          <IcoClock size={22} color="#fff" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Condição especial válida até {deadline}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Garanta agora — após essa data os valores retornam ao normal.</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Tag>Investimento</Tag>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: AZUL, margin: '2px 0 0', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          Condições especiais para a sua escola
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Card Implantação */}
        <div style={{ background: 'linear-gradient(135deg,#f0faf8,#e6f7f4)', border: '2px solid rgba(0,168,150,0.3)', borderRadius: 20, padding: '24px 28px' }}>
          <IcoRocket size={22} color={VM} style={{ display: 'block', marginBottom: 10 }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Taxa de Implantação</div>
          <div style={{ fontSize: 13, color: CLIGHT, textDecoration: 'line-through', marginBottom: 10 }}>De: {fmtBRL(data.implementation_normal)}</div>
          {isFreeImpl ? (
            <>
              <div style={{ fontSize: 68, fontWeight: 900, color: VD, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, letterSpacing: '-2px', marginBottom: 12 }}>GRÁTIS</div>
              <div style={{ fontSize: 13, color: VD, fontWeight: 600 }}>🎁 Implantação gratuita · Setup completo</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 68, fontWeight: 900, color: VD, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, letterSpacing: '-2px', marginBottom: 8 }}>{fmtBRL(data.implementation_special)}</div>
              <div style={{ fontSize: 12, color: VM, fontWeight: 600 }}>Economia de {fmtBRL(data.implementation_normal - data.implementation_special)}</div>
            </>
          )}
          <div style={{ fontSize: 11, color: CLIGHT, marginTop: 12 }}>Válido para fechamento no prazo da proposta</div>
        </div>

        {/* Card Mensalidade */}
        <div style={{ background: '#fff', border: `2px solid ${VM}`, borderRadius: 20, padding: '24px 28px', position: 'relative', boxShadow: '0 8px 40px rgba(0,168,150,0.15)' }}>
          <div style={{ position: 'absolute', top: 16, right: 16, background: GRAD2, borderRadius: 100, padding: '4px 12px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>ESPECIAL</span>
          </div>
          <IcoStar size={22} color={VM} style={{ display: 'block', marginBottom: 10 }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Mensalidade da Plataforma</div>
          <div style={{ fontSize: 13, color: CLIGHT, textDecoration: 'line-through', marginBottom: 10 }}>De: {fmtBRL(data.monthly_normal)}/mês</div>
          <div style={{ fontSize: 68, fontWeight: 900, color: VD, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, letterSpacing: '-2px', marginBottom: 8 }}>
            {fmtBRL(data.monthly_special)}<span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 0 }}>/mês</span>
          </div>
          <div style={{ fontSize: 13, color: VM, fontWeight: 700, marginBottom: 6 }}>Você economiza {fmtBRL(data.monthly_normal - data.monthly_special)}/mês</div>
          <div style={{ fontSize: 12, color: CMID }}>Acesso completo · Todos os 10 módulos</div>
        </div>
      </div>
    </div>
  )

  // ── PAGE 5 — O QUE ESTÁ INCLUSO ───────────────────────────────────────────
  const page5 = (
    <div className="proposal-page" data-proposal-page
      style={{ ...page, background: '#fff', padding: '30px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <Tag>Incluso</Tag>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: AZUL, margin: '2px 0 18px', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          O que está incluso na implantação
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {INCLUDES.map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F8FAFC', border: `1px solid ${BORDA}`, borderRadius: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <item.Icon size={14} color="#fff" />
              </div>
              <span style={{ fontSize: 13, color: AZUL, fontWeight: 500, lineHeight: 1.3 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: CMID, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Também incluso:</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
          {ALSO_INCLUDED.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', border: `1px solid ${BORDA}`, borderRadius: 12, padding: '14px 16px' }}>
              <item.Icon size={20} color={VM} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: AZUL }}>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 14, padding: '18px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <IcoClock size={30} color="#92400E" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#92400E', fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 4 }}>
              Proposta válida por {data.validity_days} dias
            </div>
            <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
              {deadline
                ? `Os valores especiais estão disponíveis até ${deadline}. Após essa data, os preços retornarão ao normal.`
                : `Esta proposta é válida por ${data.validity_days} dias a partir da data de envio.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── PAGE 6 — RODAPÉ / CTA ─────────────────────────────────────────────────
  const page6 = (
    <div className="proposal-page" data-proposal-page
      style={{ ...page, background: GRAD, padding: '36px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 380, height: 380, borderRadius: '50%', background: 'rgba(13,211,191,0.10)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 22 }}><LogoPill /></div>

        <h2 style={{ fontSize: 44, fontWeight: 900, color: '#fff', fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.5px', maxWidth: 680, margin: '0 auto 26px', lineHeight: 1.1 }}>
          Sua escola pronta para a<br />próxima campanha.
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          {['Mais Controle', 'Mais Previsibilidade', 'Mais Matrículas'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.3)', margin: '0 20px' }} />}
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{label}</span>
            </div>
          ))}
        </div>

        {data.consultant_name && (
          <div style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 16, padding: '18px 32px', display: 'inline-block', marginBottom: 20, minWidth: 280 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Seu consultor</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 10 }}>{data.consultant_name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.consultant_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <IcoPhone size={13} color={VC} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{data.consultant_phone}</span>
                </div>
              )}
              {data.consultant_email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <IcoMail size={13} color={VC} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{data.consultant_email}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <IcoWorld size={13} color="rgba(255,255,255,0.4)" />
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
    </div>
  )
}
