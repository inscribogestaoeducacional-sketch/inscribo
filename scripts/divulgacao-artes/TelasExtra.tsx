// =============================================================================
// scripts/divulgacao-artes/TelasExtra.tsx
//
// Página pública da Vitrine (HTML do renderizador real, api/_lib/vitrineRender)
// e etapas do assistente de Transmissões que os mockups de novidade não têm
// (src/components/transmissoes/CampaignWizard.tsx: etapa 1 Template l.355,
// etapa 4 Revisão l.516). Dados fictícios do "Colégio Horizonte".
// Transmissões: o calendário proíbe citar preço por mensagem e a tabela de
// preço definitiva ainda não existe — o valor do custo aparece desfocado.
// =============================================================================
import React from 'react'
import { X, Bot, Tag as TagIcon } from 'lucide-react'
import { buildPreviewData, templateTheme, type BlockType, type VitrinePageRow, type TemplateKey } from '../../src/lib/vitrineCore'
import { renderVitrinePage } from '../../api/_lib/vitrineRender'
import { Badge, labelStyle, inputStyle } from '../../src/components/transmissoes/ui'
import { DemoSeal, ESCOLA } from './TelasApp'

// ── Vitrine ─────────────────────────────────────────────────────────────────
const ASSETS = () => process.env.DEMO_ASSETS || 'http://127.0.0.1:5297'
interface DemoBlock { id: string; type: BlockType; config: Record<string, any>; is_visible: boolean; capture?: boolean }
export const VITRINE_BLOCOS = (): DemoBlock[] => [
  { id: 'b1', type: 'enroll', is_visible: true, capture: true, config: { label: 'Matrículas 2027 abertas', mode: 'whatsapp', message: 'Olá! Vim pela página da escola e quero fazer a matrícula.', effect: 'pulse' } },
  { id: 'b2', type: 'whatsapp', is_visible: true, capture: true, config: { label: 'Fale com a secretaria', message: 'Olá! Vim pela página da escola e gostaria de mais informações.', phone_source: 'school', track_capture: true } },
  { id: 'b3', type: 'gallery', is_visible: true, config: { layout: 'grid', images: [1, 2, 3, 4].map(n => ({ url: `${ASSETS()}/foto${n}.svg`, caption: '' })) } },
  { id: 'b4', type: 'stats', is_visible: true, config: { title: '', animate: true, items: [
    { value: 25, prefix: '', suffix: '', label: 'anos de história' }, { value: 850, prefix: '+', suffix: '', label: 'alunos' }, { value: 98, prefix: '', suffix: '%', label: 'de aprovação' },
  ] } },
  { id: 'b5', type: 'testimonials', is_visible: true, config: { title: 'O que as famílias dizem', items: [
    { quote: 'A equipe acolheu nossa filha desde o primeiro dia.', name: 'Renata', role: 'Mãe do Infantil 5', photo_url: '', rating: 5 },
    { quote: 'Atendimento rápido e professores muito presentes.', name: 'Marcelo', role: 'Pai do 3º ano', photo_url: '', rating: 5 },
  ] } },
  { id: 'b6', type: 'hours', is_visible: true, config: { layout: 'compact', note: '', days: [1, 2, 3, 4, 5].map(dow => ({ dow, open: '07:00', close: '18:00' })).concat([{ dow: 6, open: '08:00', close: '12:00' } as any, { dow: 0, closed: true } as any]) } },
]
export function vitrineHtml(key: TemplateKey = 'matriculas', blocks = VITRINE_BLOCOS(), primary = '#0F766E'): string {
  const theme = templateTheme(key, { primary })
  const row: VitrinePageRow = {
    id: 'demo', institution_id: 'demo', slug: 'colegio-horizonte', is_published: true, published_at: null,
    title: ESCOLA, bio: 'Educação Infantil ao Ensino Médio · Matrículas 2027 abertas',
    logo_url: `${ASSETS()}/logo.svg`, cover_url: null, theme: theme as any, seo_description: null,
    social_links: [{ network: 'instagram', handle: 'colegiohorizonte' }, { network: 'facebook', handle: 'colegiohorizonte' }],
    floating_block_id: null, show_share: true, social_position: 'top', cover_video_url: null,
    publish_at: null, unpublish_at: null, updated_at: '',
  } as any
  const data = buildPreviewData(row, blocks as any, { schoolPhone: '5583900000000', institutionName: ESCOLA })
  return renderVitrinePage(data, { siteUrl: 'https://aionedu.com.br', preview: true })
}

// ── Transmissões ────────────────────────────────────────────────────────────
const STEPS = ['Template', 'Público', 'Mensagem e respostas', 'Revisão']
function Steps({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {STEPS.map((s, i) => (
        <span key={s} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: i === step ? '#1e2d6b' : i < step ? '#E0E7FF' : '#F1F5F9', color: i === step ? '#fff' : i < step ? '#1e2d6b' : '#94a3b8' }}>{i + 1}. {s}</span>
      ))}
    </div>
  )
}
const btn = (k: 'primary' | 'ghost'): React.CSSProperties => k === 'primary'
  ? { padding: '9px 18px', borderRadius: 10, background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600 }
  : { padding: '9px 18px', borderRadius: 10, border: '1px solid #e2e8f0', color: '#64748b', fontSize: 13, fontWeight: 600 }
function ModalShot({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div id="shot" style={{ background: 'rgba(15,23,42,0.6)', padding: 36, width: 932 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: 860, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>Nova campanha</h2>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><DemoSeal /><X size={18} color="#94a3b8" /></span>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 24px', borderTop: '1px solid #f1f5f9' }}>{footer}</div>}
      </div>
    </div>
  )
}
const TEMPLATES = [
  { nome: 'Rematrícula 2027', cat: 'Marketing', aion: false, corpo: 'Olá, {{1}}! As rematrículas de 2027 do Colégio Horizonte estão abertas. Toque em um dos botões abaixo e a secretaria fala com você.', botoes: ['Quero rematricular', 'Tenho dúvidas'] },
  { nome: 'Convite para evento', cat: 'Marketing', aion: true, corpo: 'Olá, {{1}}! Venha conhecer nossa escola no próximo sábado. Toque em "Quero participar" para confirmar.', botoes: ['Quero participar'] },
  { nome: 'Aviso geral', cat: 'Utilidade', aion: false, corpo: 'Olá, {{1}}! Temos um aviso importante da escola para você.', botoes: [] as string[] },
]
const TEMPLATE_ULTIMAS = { nome: 'Últimas vagas 2027', cat: 'Marketing', aion: false, corpo: 'Olá, {{1}}! Ainda temos vagas para 2027 no Colégio Horizonte. Toque em "Quero visitar" e agende uma visita com a nossa equipe.', botoes: ['Quero visitar'] }
export function TransmissaoTemplate({ selAt = 2.2, ultimas }: { selAt?: number; ultimas?: boolean }) {
  const lista = ultimas ? [TEMPLATE_ULTIMAS, ...TEMPLATES.slice(1)] : TEMPLATES
  return (
    <ModalShot footer={<><span style={btn('ghost')}>Cancelar</span><span style={btn('primary')}>Continuar</span></>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Steps step={0} />
        <div style={{ display: 'grid', gap: 8 }}>
          {lista.map((t, i) => {
            const card = (sel: boolean) => (
              <div style={{ padding: '12px 14px', borderRadius: 12, border: sel ? '2px solid #00A896' : '1.5px solid #E2E8F0', background: sel ? '#F0FDFA' : '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong style={{ fontSize: 13, color: '#1e293b' }}>{t.nome}</strong>
                  <div style={{ display: 'flex', gap: 6 }}><Badge label={t.cat} color="#475569" bg="#F1F5F9" />{t.aion && <Badge label="Áion" color="#1D4ED8" bg="#DBEAFE" />}</div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>{t.corpo}</div>
                {t.botoes.length > 0 && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Botões: {t.botoes.join(' · ')}</div>}
              </div>
            )
            return i === 0 ? (
              <div key={t.nome} style={{ position: 'relative' }}>
                <div data-out={selAt}>{card(false)}</div>
                <div data-in={selAt} data-focus={selAt + 0.2} style={{ position: 'absolute', inset: 0 }}>{card(true)}</div>
              </div>
            ) : <div key={t.nome}>{card(false)}</div>
          })}
        </div>
      </div>
    </ModalShot>
  )
}
export function TransmissaoRevisao() {
  return (
    <ModalShot footer={<><span style={btn('ghost')}>Voltar</span><span style={btn('primary')}>Criar campanha</span></>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Steps step={3} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={labelStyle}>Nome da campanha</label><div style={inputStyle}>Rematrícula 2027 — famílias</div></div>
          <div><label style={labelStyle}>Quando enviar</label><div style={inputStyle}>Assim que for liberada</div></div>
        </div>
        <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 14px', fontSize: 13, color: '#1e293b' }}>
          <strong style={{ fontSize: 15 }}><span data-count>412</span></strong> destinatário(s) <span style={{ color: '#94a3b8' }}>· fora: 6 opt-out, 3 número inválido</span>
        </div>
        <div>
          <label style={labelStyle}>Como a mensagem chega (exemplo: Mariana Costa)</label>
          <div style={{ background: '#DCF8C6', borderRadius: 12, padding: 12, fontSize: 13, color: '#1e293b', lineHeight: 1.5, maxWidth: 460 }}>Olá, Mariana! As rematrículas de 2027 do Colégio Horizonte estão abertas. Toque em um dos botões abaixo e a secretaria fala com você.</div>
        </div>
        {/* CostBox (l.694) — valores desfocados: sem preço por mensagem na divulgação */}
        <div data-focus="1.6" style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14, display: 'grid', gap: 6, maxWidth: 420 }}>
          {[['Marketing · R$ 0,00 por mensagem', 'R$ 000,00', false], ['Crédito usado (saldo R$ 00,00)', '− R$ 00,00', false]].map(([l, v]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569' }}><span style={{ filter: 'blur(4px)' }}>{l}</span><span style={{ filter: 'blur(4px)' }}>{v}</span></div>
          ))}
          <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#1e2d6b', fontWeight: 700 }}><span>A pagar</span><span style={{ filter: 'blur(5px)' }}>R$ 000,00</span></div>
        </div>
      </div>
    </ModalShot>
  )
}

// Etapa 2 (Público) com turmas marcadas e etapa 3 (respostas por botão) —
// CampaignWizard.tsx; mesmos campos do mockup aprovado das Transmissões.
const Chk = ({ on }: { on: boolean }) => <span style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? '#0075FF' : '#fff', border: on ? 'none' : '1.5px solid #767676', color: '#fff', fontSize: 10, fontWeight: 900 }}>{on ? '✓' : ''}</span>
const Pill = ({ on, children }: { on: boolean; children: React.ReactNode }) => <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: on ? '1.5px solid #00A896' : '1.5px solid #E2E8F0', background: on ? '#E6F7F5' : '#fff', color: on ? '#00796B' : '#64748b' }}>{children}</span>
export function TransmissaoTurmas({ selAt = 1.2, tipo = 'Cliente (família)' }: { selAt?: number; tipo?: string }) {
  const turmas = ['Infantil 5', '1º ano', '2º ano', '3º ano', '4º ano', '5º ano', '6º ano', '7º ano', '8º ano']
  const marcadas = ['Infantil 5', '5º ano', '9º ano', '6º ano']
  return (
    <ModalShot footer={<><span style={btn('ghost')}>Voltar</span><span style={btn('primary')}>Continuar</span></>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Steps step={1} />
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b' }}><Chk on={false} /> <strong>Todos os contatos da escola</strong> <span style={{ color: '#94a3b8' }}>(os filtros abaixo restringem)</span></span>
        <div><label style={labelStyle}>Tipo de contato</label><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['Cliente (família)', 'Lead', 'Outro', 'Sem classificação'].map(o => <Pill key={o} on={o === tipo}>{o}</Pill>)}</div></div>
        <div data-focus={selAt + 1.2}><label style={labelStyle}>Turma</label><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{turmas.map((o, i) => marcadas.includes(o) ? <span key={o} style={{ position: 'relative' }}><span data-out={selAt + i * 0.15}><Pill on={false}>{o}</Pill></span><span data-in={selAt + i * 0.15} style={{ position: 'absolute', left: 0, top: 0 }}><Pill on>{o}</Pill></span></span> : <Pill key={o} on={false}>{o}</Pill>)}</div></div>
        <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 14px', fontSize: 13, color: '#1e293b' }}><strong style={{ fontSize: 15 }}><span data-count>186</span></strong> destinatário(s) <span style={{ color: '#94a3b8' }}>· fora: 2 opt-out, 1 número inválido</span></div>
      </div>
    </ModalShot>
  )
}
function Acao({ title, tag, skip, people, focus }: { title: string; tag: string; skip: boolean; people?: { label: string; on: boolean }[]; focus?: number }) {
  return (
    <div data-focus={focus != null ? String(focus) : undefined} style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
      <strong style={{ fontSize: 13, color: '#1e293b' }}>{title}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}><TagIcon size={13} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} /><div style={{ ...inputStyle, paddingLeft: 30, color: tag ? '#1e293b' : '#94a3b8' }}>{tag || 'Etiqueta (opcional)'}</div></div>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b' }}><Chk on={skip} /> <Bot size={14} color="#B45309" /> Pular o robô e mandar pra atendente</span>
      </div>
      {skip && people && (<div style={{ display: 'grid', gap: 6 }}><span style={{ fontSize: 11, color: '#94a3b8' }}>Distribuir entre (sem ninguém marcado, vai pra fila geral):</span><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{people.map(p => <Pill key={p.label} on={p.on}>{p.label}</Pill>)}</div></div>)}
    </div>
  )
}
export function TransmissaoRespostas({ focusAt = 1.4, ultimas }: { focusAt?: number; ultimas?: boolean }) {
  const team = [{ label: '🎓 Secretaria', on: true }, { label: 'Ana Beatriz Lima', on: false }, { label: 'Camila Rocha', on: false }]
  return (
    <ModalShot footer={<><span style={btn('ghost')}>Voltar</span><span style={btn('primary')}>Continuar</span></>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Steps step={2} />
        <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, fontSize: 12, color: '#475569', lineHeight: 1.5 }}><strong style={{ display: 'block', marginBottom: 6 }}>{ultimas ? TEMPLATE_ULTIMAS.nome : 'Rematrícula 2027'}</strong>{ultimas ? TEMPLATE_ULTIMAS.corpo : TEMPLATES[0].corpo}</div>
        <label style={labelStyle}>Quando o contato responder</label>
        {ultimas ? <Acao title='Clicou em "Quero visitar"' tag="Quer visitar" skip people={team} focus={focusAt} /> : (<>
        <Acao title='Clicou em "Quero rematricular"' tag="Quer rematricular" skip={false} />
        <Acao title='Clicou em "Tenho dúvidas"' tag="Rematrícula — dúvidas" skip people={team} focus={focusAt} /></>)}
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Sem "pular o robô", a resposta segue pro robô da escola como um atendimento novo.</p>
      </div>
    </ModalShot>
  )
}
