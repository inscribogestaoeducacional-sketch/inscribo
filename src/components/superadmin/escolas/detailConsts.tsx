import { FileText, Zap, BookOpen, TrendingUp, Star } from 'lucide-react'


// Mesmos valores do select "Tipo" da nova cobrança e do TYPE_MAP de AdminFinancial.tsx
export const CHARGE_TYPE_LABELS: Record<string, string> = {
  implementation:      'Implantação',
  monthly:             'Mensalidade',
  extra_conversations: 'Conversas extras',
}


// Parser best-effort pra period (funnel_metrics) / month_year (marketing_campaigns) —
// SÓ usado pra pré-marcar sugestões no modal de exclusão de campanha (ver
// handleConfirmDeleteCampaign): nunca decide sozinho o que apaga, o admin
// confere e pode marcar/desmarcar qualquer linha antes de confirmar. Cobre os
// formatos reais encontrados em produção (checados via SQL direto no banco):
// "2026-08" (canônico), "Novembro 2025" (nome completo), "Ago/2027", "Set-2027",
// "SET / 25" (abreviação PT + separador, ano com 2 ou 4 dígitos), "8-2026"
// (mês numérico sem zero à esquerda + separador). Retorna null quando não
// reconhece o formato — a linha aparece no modal como "não reconhecido" em
// vez de ser silenciosamente ignorada ou silenciosamente incluída.
export const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, janeiro: 1,
  fev: 2, fevereiro: 2,
  mar: 3, marco: 3,
  abr: 4, abril: 4,
  mai: 5, maio: 5,
  jun: 6, junho: 6,
  jul: 7, julho: 7,
  ago: 8, agosto: 8,
  set: 9, setembro: 9,
  out: 10, outubro: 10,
  nov: 11, novembro: 11,
  dez: 12, dezembro: 12,
}
export function parsePeriodToMonth(raw?: string | null): { year: number; month: number } | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // "2026-08" — canônico
  let m = s.match(/^(\d{4})-(\d{1,2})$/)
  if (m) {
    const month = Number(m[2])
    if (month >= 1 && month <= 12) return { year: Number(m[1]), month }
  }

  // "ago/2027", "set-2027", "set / 25" — nome (completo ou abreviado) + separador + ano
  m = s.match(/^([a-z]+)\s*[/-]\s*(\d{2,4})$/)
  if (m && MONTH_NAME_MAP[m[1]]) {
    let year = Number(m[2])
    if (year < 100) year += 2000
    return { year, month: MONTH_NAME_MAP[m[1]] }
  }

  // "novembro 2025" — nome completo + espaço, sem separador
  m = s.match(/^([a-z]+)\s+(\d{4})$/)
  if (m && MONTH_NAME_MAP[m[1]]) {
    return { year: Number(m[2]), month: MONTH_NAME_MAP[m[1]] }
  }

  // "8-2026", "9/2026" — mês numérico sem zero à esquerda + separador + ano
  m = s.match(/^(\d{1,2})\s*[/-]\s*(\d{2,4})$/)
  if (m) {
    const month = Number(m[1])
    if (month >= 1 && month <= 12) {
      let year = Number(m[2])
      if (year < 100) year += 2000
      return { year, month }
    }
  }

  return null
}

export const STATUS_MAP: Record<string, { l: string; c: string; bg: string }> = {
  active:           { l: 'Ativo',             c: '#16a34a', bg: '#f0fdf4' },
  pending_contract: { l: 'Aguard. contrato',  c: '#6366f1', bg: '#eef2ff' },
  pending_payment:  { l: 'Aguard. pagamento', c: '#d97706', bg: '#fffbeb' },
  suspended:        { l: 'Suspenso',          c: '#dc2626', bg: '#fef2f2' },
  cancelled:        { l: 'Cancelado',         c: '#9ca3af', bg: '#f3f4f6' },
}
export const PAYMENT_STATUS: Record<string, { l: string; c: string; bg: string }> = {
  paid:      { l: 'Pago',      c: '#16a34a', bg: '#f0fdf4' },
  pending:   { l: 'Pendente',  c: '#d97706', bg: '#fffbeb' },
  overdue:   { l: 'Atrasado',  c: '#dc2626', bg: '#fef2f2' },
  cancelled: { l: 'Cancelado', c: '#9ca3af', bg: '#f9fafb' },
  // Sem esta linha, estornado caía no fallback e aparecia como "Pendente".
  refunded:  { l: 'Estornado', c: '#7c3aed', bg: '#f5f3ff' },
}
// Cobrança de campanha de Transmissões: só o pagamento no Asaas libera
// (webhook → broadcast_try_release). Marcar como pago aqui gravaria "pago"
// SEM liberar a campanha — e seria liberação manual, que o módulo proíbe.
export const BROADCAST_AUTO_RELEASE = 'Liberação automática pelo pagamento no Asaas'
export const CONTRACT_STATUS: Record<string, { l: string; c: string; bg: string }> = {
  draft:     { l: 'Rascunho',              c: '#6b7280', bg: '#f3f4f6' },
  sent:      { l: 'Aguardando assinatura', c: '#d97706', bg: '#fffbeb' },
  signed:    { l: 'Assinado ✓',           c: '#16a34a', bg: '#f0fdf4' },
  cancelled: { l: 'Cancelado',            c: '#dc2626', bg: '#fef2f2' },
}
export const CYCLE_STATUS: Record<string, { l: string; c: string; bg: string }> = {
  draft:     { l: 'Rascunho',         c: '#6b7280', bg: '#f3f4f6' },
  setup:     { l: 'Em configuração',  c: '#a16207', bg: '#fef9c3' },
  active:    { l: 'Ativa',            c: '#2563eb', bg: '#eff6ff' },
  released:  { l: 'Liberada',         c: '#16a34a', bg: '#f0fdf4' },
  completed: { l: 'Concluída',        c: '#7c3aed', bg: '#f5f3ff' },
  archived:  { l: 'Arquivada',        c: '#6b7280', bg: '#f3f4f6' },
}

// 5 fases reais de onboarding_processes.current_phase — mesma taxonomia usada
// em toda a implantação (antes duplicada em AdminOnboarding.tsx, agora
// consolidada só aqui). Nada de fases virtuais/derivadas: o que a tela mostra
// é exatamente o que está gravado no banco.
export type TimelinePhaseId = 'contract' | 'implementation' | 'training' | 'campaign' | 'monthly'

export const TIMELINE_PHASES: Array<{ id: TimelinePhaseId; label: string; icon: any; color: string }> = [
  { id: 'contract',       label: 'Contrato',       icon: FileText,   color: '#6366F1' },
  { id: 'implementation', label: 'Implantação',    icon: Zap,        color: '#2563EB' },
  { id: 'training',       label: 'Treinamento',    icon: BookOpen,   color: '#7C3AED' },
  { id: 'campaign',       label: 'Campanha',       icon: TrendingUp, color: '#EA580C' },
  { id: 'monthly',        label: 'Acompanhamento', icon: Star,       color: '#16A34A' },
]

export const DEFAULT_TASKS_CONTRACT = [
  { title: 'Contrato enviado via Autentique',      description: 'Enviar contrato para assinatura digital' },
  { title: 'Contrato assinado pela escola',        description: 'Confirmar assinatura do responsável' },
  { title: 'Pagamento da implantação confirmado',  description: 'Verificar pagamento no Asaas' },
]
export const DEFAULT_TASKS_IMPL = [
  { title: 'Kickoff agendado e realizado',         description: 'Realizar reunião de kickoff com a escola' },
  { title: 'Dados do ERP importados',              description: 'Importar histórico do sistema atual' },
  { title: 'WhatsApp oficial homologado',          description: 'Configurar número via API Oficial Meta' },
  { title: 'Equipe cadastrada no sistema',         description: 'Criar usuários para todos os atendentes' },
  { title: 'Fluxos de atendimento configurados',  description: 'Personalizar bot e fluxos do WhatsApp' },
  { title: 'Formulário de captação publicado',    description: 'Integrar formulário no site da escola' },
]
export const DEFAULT_TASKS_TRAINING = [
  { title: 'Treinamento de CRM realizado',        description: 'Treinar equipe no kanban de leads' },
  { title: 'Treinamento de WhatsApp realizado',   description: 'Treinar equipe no WhatsApp oficial' },
  { title: 'Treinamento de Relatórios realizado', description: 'Treinar gestor na leitura dos dados' },
  { title: 'Dúvidas da equipe respondidas',       description: 'Sessão de perguntas e respostas' },
]
export const DEFAULT_TASKS_CAMPAIGN = [
  { title: 'Campanha configurada pelo gestor',    description: 'Gestor preencheu os dados da campanha' },
  { title: 'IA gerou o plano de campanha',        description: 'Plano com metas mensais gerado' },
  { title: 'Metas revisadas e aprovadas',         description: 'Gestor aprovou as metas sugeridas' },
  { title: 'Campanha liberada pelo admin',        description: 'Admin liberou o acesso à campanha' },
]
export const DEFAULT_TASKS_MONTHLY = [
  { title: '1ª reunião mensal realizada', description: 'Primeiro acompanhamento mensal' },
  { title: 'Relatório do mês enviado',    description: 'Relatório de performance enviado' },
]

// ── MeetingModal ──────────────────────────────────────────────────────────────
