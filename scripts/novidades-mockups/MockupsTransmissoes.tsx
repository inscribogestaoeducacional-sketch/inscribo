// =============================================================================
// scripts/novidades-mockups/MockupsTransmissoes.tsx
//
// Telas das Transmissões pra /novidades/transmissoes, a landing e o carrossel.
// Espelham src/components/transmissoes/{CampaignDetail,CampaignWizard}.tsx
// (as peças KpiCard/Badge/estilos vêm do próprio ui.tsx) com DADOS FICTÍCIOS.
// Sem nenhum valor em reais: a caixa de custo da tela real fica de fora até
// existir a tabela de preço definitiva. Cada tela leva o selo "Dados de
// exemplo". Se a tela real mudar, atualize aqui e rode:
//   node scripts/novidades-mockups/render.mjs --transmissoes
// =============================================================================
import React from 'react'
import {
  Users, Send, CheckCheck, Eye, MessageCircle, XCircle, RefreshCw, Upload, Search, Tag as TagIcon, Bot, X, Info,
  CheckCheck as Ticks, UserPlus,
} from 'lucide-react'
import { Badge, KpiCard, labelStyle, inputStyle, hintStyle } from '../../src/components/transmissoes/ui'

// Rótulos da tela real (src/lib/broadcasts.ts, CampaignWizard.tsx)
const STEPS = ['Template', 'Público', 'Mensagem e respostas', 'Revisão']
const FAILURE_KIND: Record<string, string> = { permanent: 'Número não recebe', unknown: 'Sem confirmação da Meta', suppressed: 'Pediu pra não receber' }

function DemoSeal() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1.5px dashed #F9A8D4', background: '#FDF2F8', color: '#BE185D', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      <Info size={12} /> Dados de exemplo · demonstração
    </span>
  )
}

// Modal estático (ui.tsx → Modal, sem position:fixed) sobre o fundo escurecido.
function ModalShot({ title, width, children, footer }: { title: string; width: number; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div id="shot" style={{ background: 'rgba(15,23,42,0.6)', padding: 36, width: width + 72 }}>
      <div style={{ background: '#fff', borderRadius: 18, width, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>{title}</h2>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><DemoSeal /><X size={18} color="#94a3b8" /></span>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
        {footer && <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>}
      </div>
    </div>
  )
}

const btnStyle = (v: 'primary' | 'ghost' | 'secondary'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
  ...(v === 'primary' ? { background: '#00A896', color: '#fff' } : v === 'secondary' ? { background: '#fff', color: '#1e2d6b', border: '1.5px solid #E2E8F0' } : { background: 'transparent', color: '#64748b' }),
})

function Steps({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {STEPS.map((s, i) => (
        <span key={s} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: i === step ? '#1e2d6b' : i < step ? '#E0E7FF' : '#F1F5F9', color: i === step ? '#fff' : i < step ? '#1e2d6b' : '#94a3b8' }}>
          {i + 1}. {s}
        </span>
      ))}
    </div>
  )
}

function Pill({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return <span style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: on ? '1.5px solid #00A896' : '1.5px solid #E2E8F0', background: on ? '#F0FDFA' : '#fff', color: on ? '#047857' : '#475569' }}>{children}</span>
}
function Chips({ label, options, on }: { label: string; options: string[]; on: string[] }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{options.map(o => <Pill key={o} on={on.includes(o)}>{o}</Pill>)}</div>
    </div>
  )
}
const Check = ({ on, disabled }: { on: boolean; disabled?: boolean }) => (
  <span style={{ width: 14, height: 14, borderRadius: 3, flex: 'none', border: `1.5px solid ${on ? '#0075FF' : disabled ? '#CBD5E1' : '#767676'}`, background: on ? '#0075FF' : disabled ? '#F1F5F9' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
  </span>
)

// ── Tela 1: detalhe da campanha ─────────────────────────────────────────────
export function Detalhe() {
  const recipients = [
    { name: 'Mariana Costa', phone: '(83) 90000-0101', st: 'Lida', sent: '02/10 09:00', reply: '02/10 09:04 · Tenho interesse' },
    { name: 'Rafael Nogueira', phone: '(83) 90000-0102', st: 'Lida', sent: '02/10 09:00', reply: '02/10 09:31 · Tenho interesse' },
    { name: 'Juliana Prado', phone: '(83) 90000-0103', st: 'Entregue', sent: '02/10 09:01', reply: '—' },
    { name: 'Carlos Menezes', phone: '(83) 90000-0104', st: 'Lida', sent: '02/10 09:01', reply: '02/10 10:12' },
    { name: 'Patrícia Alves', phone: '(83) 90000-0105', st: 'Falhou · Número não recebe', sent: '—', reply: '—' },
  ]
  return (
    <ModalShot title="Rematrícula 2027 — famílias" width={900}
      footer={<span style={btnStyle('ghost')}><RefreshCw size={14} /> Atualizar</span>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge label="Concluída" color="#1e2d6b" bg="#E0E7FF" />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Template rematricula_2027 · criada em 01/10 16:20</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          <KpiCard label="Destinatários" value="612" icon={<Users size={16} color="#1e2d6b" />} bg="#E0E7FF" />
          <KpiCard label="Enviadas" value="604" hint="99%" icon={<Send size={16} color="#047857" />} bg="#D1FAE5" />
          <KpiCard label="Entregues" value="589" hint="98%" icon={<CheckCheck size={16} color="#0284C7" />} bg="#E0F2FE" />
          <KpiCard label="Lidas" value="471" hint="80%" icon={<Eye size={16} color="#7C3AED" />} bg="#EDE9FE" />
          <KpiCard label="Responderam" value="158" hint="27%" icon={<MessageCircle size={16} color="#DB2777" />} bg="#FCE7F3" />
          <KpiCard label="Falhas" value="8" icon={<XCircle size={16} color="#DC2626" />} bg="#FEE2E2" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
            <label style={labelStyle}>Cliques por botão</label>
            {[['Tenho interesse', 121], ['Parar', 6]].map(([t, n]) => (
              <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', padding: '3px 0' }}><span>{t}</span><strong style={{ color: '#1e2d6b' }}>{n}</strong></div>
            ))}
          </div>
          <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
            <label style={labelStyle}>Não enviadas / falhas</label>
            {[['permanent', 5], ['unknown', 2], ['suppressed', 1]].map(([k, n]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', padding: '3px 0' }}><span>{FAILURE_KIND[k as string]}</span><strong style={{ color: '#1e2d6b' }}>{n}</strong></div>
            ))}
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>Mensagens pagas que não saíram viram crédito pra próxima campanha.</p>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Destinatários</label>
            <span style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12 }}>Todos ▾</span>
          </div>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Contato', 'Status', 'Enviada', 'Resposta'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r.phone} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '7px 12px' }}>{r.name}<div style={{ color: '#94a3b8', fontSize: 11 }}>{r.phone}</div></td>
                    <td style={{ padding: '7px 12px' }}>{r.st}</td>
                    <td style={{ padding: '7px 12px', color: '#64748b' }}>{r.sent}</td>
                    <td style={{ padding: '7px 12px', color: '#64748b' }}>{r.reply}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModalShot>
  )
}

// ── Tela 2: assistente, etapa Público ───────────────────────────────────────
export function Publico() {
  const rows = [
    { name: 'Mariana Costa', phone: '(83) 90000-0101', why: 'Filtro: etiqueta Rematrícula' },
    { name: 'Rafael Nogueira', phone: '(83) 90000-0102', why: 'Filtro: etiqueta Rematrícula' },
    { name: 'Juliana Prado', phone: '(83) 90000-0103', why: 'Filtro: etiqueta Rematrícula' },
    { name: 'Fernanda Lima', phone: '(83) 90000-0106', why: 'Filtro: etiqueta Rematrícula', off: true },
    { name: 'Bruno Tavares', phone: '(83) 90000-0107', why: 'opt-out', blocked: true },
    { name: 'Carlos Menezes', phone: '(83) 90000-0104', why: 'Adicionado manualmente' },
  ]
  return (
    <ModalShot title="Nova campanha" width={860}
      footer={<><span style={btnStyle('ghost')}>Voltar</span><span style={btnStyle('primary')}>Continuar</span></>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Steps step={1} />
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b' }}>
          <Check on={false} /> <strong>Todos os contatos da escola</strong> <span style={{ color: '#94a3b8' }}>(os filtros abaixo restringem)</span>
        </span>
        <Chips label="Etiquetas (tem alguma)" options={['Rematrícula', 'Integral', 'Open School', 'Bolsa 2027', 'Visitou a escola']} on={['Rematrícula']} />
        <Chips label="Tipo de contato" options={['Cliente (família)', 'Lead', 'Outro', 'Sem classificação']} on={[]} />
        <Chips label="Turma" options={['Infantil 5', '1º ano', '2º ano', '3º ano', '4º ano', '5º ano']} on={[]} />
        <Chips label="Veio da Captação (gatilho)" options={['Matrículas 2027 — Infantil', 'Open School — Visita guiada']} on={[]} />
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
          <label style={labelStyle}>Ou importe uma lista (planilha)</label>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1.5px dashed #CBD5E1', background: '#fff', fontSize: 13, color: '#1e2d6b' }}>
            <Upload size={14} /> Escolher planilha (CSV ou Excel)
          </span>
          <p style={hintStyle}>Colunas: telefone (obrigatória), nome e outras que quiser usar na mensagem (ex.: turma).</p>
        </div>
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b' }}>
            <Users size={15} color="#1e2d6b" />
            <strong style={{ fontSize: 15 }}>612</strong> destinatário(s)
            <span style={{ color: '#94a3b8' }}>· fora: 1 desmarcado(s), 2 opt-out, 1 número inválido</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
            <div style={{ ...inputStyle, paddingLeft: 30, color: '#94a3b8' }}>Buscar ou adicionar contato (nome ou telefone)</div>
          </div>
          <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
            {rows.map((r, i) => (
              <div key={r.phone} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', fontSize: 13,
                borderTop: i ? '1px solid #f1f5f9' : 'none', background: r.blocked ? '#F8FAFC' : '#fff', color: r.blocked ? '#94a3b8' : '#1e293b' }}>
                <Check on={!r.off && !r.blocked} disabled={r.blocked} />
                <span style={{ flex: '1 1 160px', textDecoration: r.off ? 'line-through' : 'none' }}>{r.name}</span>
                <span style={{ flex: '0 0 130px', color: r.blocked ? '#94a3b8' : '#64748b' }}>{r.phone}</span>
                <span style={{ flex: '1 1 200px', fontSize: 12, color: '#94a3b8' }}>
                  {r.blocked ? <span style={{ color: '#B45309', fontWeight: 600 }}>{r.why}</span> : r.why}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShot>
  )
}

// ── Tela 3: assistente, etapa Mensagem e respostas ─────────────────────────
function ActionCard({ title, tag, skip, people }: { title: string; tag: string; skip: boolean; people?: { label: string; on: boolean }[] }) {
  return (
    <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
      <strong style={{ fontSize: 13, color: '#1e293b' }}>{title}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <TagIcon size={13} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
          <div style={{ ...inputStyle, paddingLeft: 30, color: tag ? '#1e293b' : '#94a3b8' }}>{tag || 'Etiqueta (opcional)'}</div>
        </div>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b' }}>
          <Check on={skip} /> <Bot size={14} color="#B45309" /> Pular o robô e mandar pra atendente
        </span>
      </div>
      {skip && people && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Distribuir entre (sem ninguém marcado, vai pra fila geral):</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{people.map(p => <Pill key={p.label} on={p.on}>{p.label}</Pill>)}</div>
        </div>
      )}
    </div>
  )
}
export function Respostas() {
  const team = [{ label: '🎓 Secretaria', on: true }, { label: 'Ana Beatriz Lima', on: false }, { label: 'Camila Rocha', on: false }]
  return (
    <ModalShot title="Nova campanha" width={860}
      footer={<><span style={btnStyle('ghost')}>Voltar</span><span style={btnStyle('primary')}>Continuar</span></>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <Steps step={2} />
        <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, fontSize: 12, color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>Rematrícula 2027</strong>
          {'Olá, {{1}}! As rematrículas de 2027 do Colégio Exemplo estão abertas, com condição especial até 31/10.\nToque em "Tenho interesse" e a secretaria fala com você.'}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>Preenchimento das variáveis</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2d6b' }}>{'{{1}}'} — Nome do responsável</span>
            <div style={inputStyle}>Primeiro nome do contato</div>
            <div style={inputStyle}>família</div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>Quando o contato responder</label>
          <ActionCard title="Qualquer resposta (sem clicar em botão)" tag="Rematrícula — respondeu" skip people={team} />
          <ActionCard title='Clicou em "Tenho interesse"' tag="Quer rematricular" skip people={team} />
          <ActionCard title='Clicou em "Parar"' tag="" skip={false} />
          <p style={hintStyle}>Sem "pular o robô", a resposta segue pro robô da escola como um atendimento novo.</p>
        </div>
      </div>
    </ModalShot>
  )
}

// ── Tela 4: ilustração da campanha chegando no WhatsApp ─────────────────────
export function Mensagem() {
  const time = (t: string, dark?: boolean) => <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, fontSize: 10, color: dark ? '#6B7280' : '#9CA3AF', marginTop: 4 }}>{t}{dark && <Ticks size={12} color="#53BDEB" />}</span>
  return (
    <div id="shot" style={{ width: 420, padding: 20, background: '#F4F7F5' }}>
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E5E7EB', boxShadow: '0 20px 48px rgba(0,48,31,.12)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>CE</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Colégio Exemplo</p>
            <p style={{ margin: 0, fontSize: 11, color: '#6B7280' }}>Conta comercial</p>
          </div>
        </div>
        <div style={{ background: '#EFEAE2', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ alignSelf: 'flex-end', fontSize: 10, fontWeight: 700, color: '#BE185D', background: '#FDF2F8', border: '1.5px dashed #F9A8D4', borderRadius: 999, padding: '3px 10px' }}>Ilustração · dados de exemplo</span>
          <div style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
            <div style={{ background: '#fff', borderRadius: '4px 12px 12px 12px', padding: 6, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
              <div style={{ height: 150, borderRadius: 8, background: 'linear-gradient(135deg,#1D4ED8,#3B82F6 60%,#93C5FD)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 14, color: '#fff' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', opacity: .85 }}>COLÉGIO EXEMPLO</span>
                <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>Rematrícula 2027</span>
              </div>
              <div style={{ padding: '8px 6px 2px', fontSize: 13, color: '#111827', lineHeight: 1.5 }}>
                Olá, Mariana! As rematrículas de 2027 do Colégio Exemplo estão abertas, com condição especial até 31/10.
                <br />Toque em "Tenho interesse" e a secretaria fala com você.
                {time('09:00')}
              </div>
            </div>
            {['Tenho interesse', 'Parar'].map(b => (
              <div key={b} style={{ marginTop: 4, background: '#fff', borderRadius: 10, padding: '9px 0', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#0284C7', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>↩ {b}</div>
            ))}
          </div>
          <div style={{ alignSelf: 'flex-end', maxWidth: '80%', background: '#D9FDD3', borderRadius: '12px 4px 12px 12px', padding: '8px 12px', fontSize: 13, color: '#111827', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
            Tenho interesse
            {time('09:04', true)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {[{ Icon: TagIcon, l: 'Etiqueta: Quer rematricular' }, { Icon: UserPlus, l: 'Encaminhado pra Secretaria' }].map(c => (
              <span key={c.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #A7F3D0', color: '#00523C', fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 999 }}>
                <c.Icon size={12} color="#00A896" /> {c.l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
