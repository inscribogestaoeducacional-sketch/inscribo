// src/components/leads/leadFormShared.ts
//
// Constantes/tipos usados tanto pelo NewLeadModal (formulário completo de
// criar/editar lead) quanto pelo restante do LeadKanban (board, filtros,
// cards) — e agora também pelo WhatsAppHub, que reaproveita o NewLeadModal
// em vez de manter seu próprio formulário divergente.
import { Flame, Sun, Snowflake } from 'lucide-react'

export interface SimpleUser { id: string; full_name: string; role?: string }

export type AuditEntry = {
  id: string; action: string; record_id: string; module: string
  institution_id: string; user_id: string | null; user_name: string | null
  user_role: string | null; field_changed: string | null; old_value: string | null
  new_value: string | null; created_at: string
}

export interface StudentEntry {
  student_name: string
  grade_interest: string
  shift_interest: string
  origin_school: string
}

// Resultado da checagem de telefone já cadastrado (item 3b). id pode ser um
// UUID real de lead_families (família já existe) OU `retro:<leadId>` — um
// lead avulso antigo com esse telefone que ainda não foi agrupado.
export interface FamilyMatch {
  id: string
  responsible_name: string
  phone: string
  email: string | null
  address: string | null
  childrenCount: number
}

export const statusConfig = {
  new:       { label: 'Novo',             accent: '#6b7280', headerBg: 'bg-gray-100',   headerText: 'text-gray-700',   badgeBg: 'bg-gray-500'   },
  contact:   { label: 'Em Contato',       accent: '#3b82f6', headerBg: 'bg-blue-50',    headerText: 'text-blue-800',   badgeBg: 'bg-blue-500'   },
  scheduled: { label: 'Visita Agendada',  accent: '#f59e0b', headerBg: 'bg-amber-50',   headerText: 'text-amber-800',  badgeBg: 'bg-amber-500'  },
  visit:     { label: 'Visitou',          accent: '#f97316', headerBg: 'bg-orange-50',  headerText: 'text-orange-800', badgeBg: 'bg-orange-500' },
  proposal:  { label: 'Proposta',         accent: '#8b5cf6', headerBg: 'bg-purple-50',  headerText: 'text-purple-800', badgeBg: 'bg-purple-500' },
  enrolled:  { label: 'Matriculado',      accent: '#22c55e', headerBg: 'bg-green-50',   headerText: 'text-green-800',  badgeBg: 'bg-green-500'  },
  lost:      { label: 'Perdido',          accent: '#ef4444', headerBg: 'bg-red-50',     headerText: 'text-red-800',    badgeBg: 'bg-red-500'    },
}

// 'Concurso de Bolsas' dá sentido ao campo condicional contest_name.
export const sourceOptions = ['Facebook', 'Instagram', 'Google', 'Site', 'Indicação', 'WhatsApp', 'Concurso de Bolsas', 'Outros']

export const LEAD_TEMPERATURES = [
  { value: 'quente', label: 'Quente', icon: Flame,     color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'morno',  label: 'Morno',  icon: Sun,       color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'frio',   label: 'Frio',   icon: Snowflake, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
] as const

export const LEAD_STAGES = [
  { key: 'new',       label: 'Novo'      },
  { key: 'contact',   label: 'Contato'   },
  { key: 'scheduled', label: 'Ag.'       },
  { key: 'visit',     label: 'Visita'    },
  { key: 'proposal',  label: 'Proposta'  },
  { key: 'enrolled',  label: 'Matrícula' },
] as const

export function avatarColor(name: string): string {
  const colors = ['#00A896', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981']
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

export function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`
}
