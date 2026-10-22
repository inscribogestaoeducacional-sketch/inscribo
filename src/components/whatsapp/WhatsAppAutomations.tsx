import { Bot, Clock, Coffee, Star, Timer, Pencil, Info } from 'lucide-react'
import { BRAND } from '../../lib/brand'

// ETAPA 3B-2 — Configurações → WhatsApp → Automações, no desenho do AION
// Business (WhatsAppAutomations.tsx de lá): tudo que o WhatsApp da escola
// manda sozinho, num lugar só. SÓ LEITURA: mostra o que está salvo e cada
// cartão abre a tela onde aquilo já se edita hoje (mesmas gravações).
// Itens sem efeito (boas-vindas e menu fora do robô, reativação) não aparecem.

export interface AutomationsFlow {
  bot_enabled?: boolean | null
  bot_flow?: { nodes?: unknown[] } | null
  satisfaction_survey_enabled?: boolean | null
  satisfaction_message?: string | null
  bot_timeout_minutes?: number | null
  bot_timeout_message?: string | null
  timeout_minutes?: number | null
  timeout_message?: string | null
  timeout_group_id?: string | null
}

const short = (t?: string | null) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 110) + ((t || '').length > 110 ? '…' : '')

export default function WhatsAppAutomations({ flow, outsideHoursMsg, lunchMsg, groups, onOpen, onOpenFlowEditor }: {
  flow: AutomationsFlow
  /** valores salvos (carregados pela tela de WhatsApp) */
  outsideHoursMsg: string
  lunchMsg: string
  groups: { id: string; name: string; emoji: string }[]
  /** abre a seção onde o item se edita (horario, equipe, pesquisa…) */
  onOpen: (section: string) => void
  onOpenFlowEditor: () => void
}) {
  // mesma regra do banco (process_bot_timeouts): COALESCE(bot_timeout_*, timeout_*)
  const timeoutMin = flow.bot_timeout_minutes || flow.timeout_minutes || null
  const timeoutMsg = flow.bot_timeout_message || flow.timeout_message || ''
  const offHoursGroup = groups.find(g => g.id === flow.timeout_group_id)
  const nodes = flow.bot_flow?.nodes?.length ?? 0

  const cards: { key: string; icon: typeof Bot; title: string; on: boolean; status: string; desc: string; preview?: string; now?: string; edit: () => void; editLabel: string }[] = [
    { key: 'robo', icon: Bot, title: 'Robô de atendimento', on: !!flow.bot_enabled,
      status: flow.bot_enabled ? 'Ligado' : 'Desligado',
      desc: 'Atende na hora: dá as boas-vindas, mostra o menu e passa a conversa para a pessoa certa. Boas-vindas e menu se editam dentro do robô.',
      now: flow.bot_enabled ? `${nodes} ${nodes === 1 ? 'passo' : 'passos'} no caminho da conversa` : 'Sem robô: toda conversa vai direto para a equipe',
      edit: onOpenFlowEditor, editLabel: 'Editar robô' },
    { key: 'fora_horario', icon: Clock, title: 'Fora do horário', on: !!outsideHoursMsg.trim(),
      status: outsideHoursMsg.trim() ? 'Ligada' : 'Sem mensagem',
      desc: 'Responde quando a escola está fechada e deixa a conversa na fila para o dia seguinte.',
      preview: short(outsideHoursMsg),
      now: offHoursGroup ? `a conversa vai para o grupo ${offHoursGroup.emoji} ${offHoursGroup.name} (definido em Equipe e distribuição)` : 'a conversa fica na fila geral, sem dono',
      edit: () => onOpen('horario'), editLabel: 'Editar mensagem' },
    { key: 'almoco', icon: Coffee, title: 'Horário de almoço', on: !!lunchMsg.trim(),
      status: lunchMsg.trim() ? 'Ligada' : 'Sem mensagem',
      desc: 'Avisa que o atendente está no almoço e volta logo. Vale para quem tem almoço marcado em Equipe e distribuição.',
      preview: short(lunchMsg),
      edit: () => onOpen('horario'), editLabel: 'Editar mensagem' },
    { key: 'sem_resposta', icon: Timer, title: 'Família parou de responder', on: !!timeoutMin,
      status: timeoutMin ? 'Ligada' : 'Desligada',
      desc: 'Se a família não responde ao robô, a conversa passa para a equipe depois do tempo marcado.',
      preview: timeoutMsg ? short(timeoutMsg) : undefined,
      now: timeoutMin ? `passa para a equipe após ${timeoutMin} min (${flow.bot_timeout_minutes ? 'tempo do robô' : 'tempo da Equipe'})` : undefined,
      edit: () => onOpen('horario'), editLabel: 'Editar tempo e mensagem' },
    { key: 'pesquisa', icon: Star, title: 'Avaliação do atendimento', on: !!flow.satisfaction_survey_enabled,
      status: flow.satisfaction_survey_enabled ? 'Ligada' : 'Desligada',
      desc: 'Ao encerrar, pergunta à família como foi o atendimento: Ruim, Regular ou Ótimo.',
      preview: flow.satisfaction_survey_enabled ? short(flow.satisfaction_message) : undefined,
      edit: () => onOpen('pesquisa'), editLabel: 'Editar avaliação' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {cards.map((c, i) => {
          const Icon = c.icon
          return (
            <div key={c.key} className="aion-pop" style={{
              animationDelay: `${i * 40}ms`, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 18,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: c.on ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#EEF2F7', color: c.on ? '#fff' : BRAND.muted }}>
                  <Icon size={19} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: c.on ? BRAND.primary : BRAND.muted, fontWeight: 600 }}>{c.status}</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>{c.desc}</p>
              {c.preview && (
                <div style={{ fontSize: 12.5, color: BRAND.text, background: BRAND.bg, border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
                  “{c.preview}”
                </div>
              )}
              {c.now && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: '#1E3A8A', background: BRAND.soft, border: '1px solid #BFDBFE', borderRadius: 10, padding: '7px 9px', lineHeight: 1.4 }}>
                  <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span><strong>Valendo agora:</strong> {c.now}</span>
                </div>
              )}
              <button onClick={c.edit} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto',
                fontSize: 13, fontWeight: 700, color: BRAND.primary, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Pencil size={13} /> {c.editLabel}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
