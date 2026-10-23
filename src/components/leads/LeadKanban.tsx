import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus, Phone, Calendar, Edit, Edit2, Trash2, X, Search,
  Clock, Users, Send, CheckCircle, Save,
  MessageCircle, AlertTriangle, ChevronDown, ChevronRight, ChevronUp,
  Bell, UserCog, SlidersHorizontal, CheckSquare,
  LayoutGrid, Rows3, Tag, Megaphone, MapPin, GraduationCap, List as ListIcon, Kanban,
} from 'lucide-react'
import { logAudit } from '../../hooks/useAudit'
import AuditModal from '../common/AuditModal'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../../contexts/AuthContext'
import { useLeadSources, withCurrent } from '../../lib/leadSources'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DatabaseService, Lead, supabase } from '../../lib/supabase'
import { stageColumns, getCustomStage, leadCustomStage, leadColumnKey, isCustomColumnKey } from '../../lib/stageLabels'
import { createNotification } from '../../lib/notifications'
import { normalizeBrazilianInput } from '../../lib/phone'
import { useGradeLevels } from '../../hooks/useGradeLevels'
import { useLeadUnits, matchesUnitFilter, UNIT_FILTER_ALL, UNIT_FILTER_NONE, type LeadUnit } from '../../lib/leadUnits'
import { getLeadReminderInfo, REMINDER_COLORS, NO_CONTACT_DAYS, type ReminderOptions } from '../../lib/leadReminders'
import { useLeadInteractions } from '../../hooks/useLeadInteractions'
import { fetchPendingVisitsByLead, isPastVisit, advanceLeadTo, type PendingVisit } from '../../lib/visitOutcome'
import VisitOutcomeDialog from '../visits/VisitOutcomeDialog'
import PageHeader from '../ui/PageHeader'
import { BRAND } from '../../lib/brand'
import { AttentionStrip, WaitingList, LEADS_CSS, useLeadWaiting, waitLabel, daysSince, type AttentionKey, type StripCounts, type WaitingRow } from './LeadsAttention'
import IntegrationGap from './IntegrationGap'
import { sendVisitMessages } from '../../lib/visitMessages'
import NewLeadModal from './NewLeadModal'
import ScheduleVisitModal from './ScheduleVisitModal'
import { saveLead, formatSaveLeadError } from '../../lib/leadSave'
import { LostReasonModal, lostReasonLabel, useLostReasons } from './lostReasons'
import {
  type SimpleUser, type AuditEntry, type StudentEntry,
  statusConfig, LEAD_TEMPERATURES, LEAD_STAGES, avatarColor,
} from './leadFormShared'

const SHOW_INTEGRATION_GAP: boolean = false

// Motivos de perda e LostReasonModal: ./lostReasons.tsx (também usados pelo formulário).

// Séries — antes existiam DUAS listas hardcoded divergentes aqui mesmo
// (gradeOptions usada pra salvar, GRADES usada só pro filtro, com Ensino
// Médio em nomenclaturas diferentes — o filtro nunca encontrava nada).
// Agora vêm de school_grade_levels via useGradeLevels(), configurável por
// escola (Configurações → Escola). Ver hooks/useGradeLevels.ts.

// Lógica de lembrete (manual + automático "sem contato") vive em
// lib/leadReminders.ts — reaproveitada aqui, no GestorHome e no AttendantHome.



// ─── ScheduleVisitModal ────────────────────────────────────────────────────────
// Extraído pra ./ScheduleVisitModal.tsx — reaproveitado também pelo painel de
// Lead do WhatsApp Hub (WhatsAppHub.tsx).

// ─── ReminderModal — lembrete manual (nota livre + data), item 2d ─────────────
interface ReminderModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead | null
  onSave: (date: string, note: string) => Promise<void>
}

function ReminderModal({ isOpen, onClose, lead, onSave }: ReminderModalProps) {
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && lead) {
      setDate(lead.next_followup ? lead.next_followup.slice(0, 10) : '')
      setNote('')
    }
  }, [isOpen, lead])

  if (!isOpen || !lead) return null

  const handleSave = async () => {
    if (!date) return
    setSaving(true)
    try { await onSave(date, note) } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #FDE68A' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell style={{ width: 18, height: 18, color: '#D97706' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Definir lembrete</h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.student_name} · {lead.responsible_name}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 13, height: 13, color: '#94A3B8' }} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Data do follow-up *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nota (opcional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Ex: Ligar pra confirmar visita, aguardar retorno sobre bolsa..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: '#1A2B4A' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B', fontWeight: 500 }}>Cancelar</button>
          <button onClick={handleSave} disabled={!date || saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, background: !date ? '#E2E8F0' : '#D97706', color: !date ? '#94A3B8' : '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: !date || saving ? 'not-allowed' : 'pointer' }}>
            {saving ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" /> : <Bell style={{ width: 14, height: 14 }} />}
            Salvar lembrete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CardContent ──────────────────────────────────────────────────────────────
interface CardContentProps {
  lead: Lead
  config: { accent: string; headerBg: string; headerText: string; badgeBg: string; label: string }
  isFlashing: boolean
  overlay?: boolean
  compact?: boolean
  assignedUser?: SimpleUser | null
  // Campo de unidade do lead — só vem preenchido quando a escola usa o campo.
  unitName?: string | null
  // Edição em lote: modo seleção (clique marca/desmarca, sem arrastar).
  selectMode?: boolean
  selected?: boolean
  // Consolidação de família (item de leads-irmãos) — quando a família tem
  // ≥2 filhos, este card representa a família inteira: `familyMembers` traz
  // TODOS os filhos (incluindo `lead`, que é só o representante escolhido
  // pra exibir no topo do card). Undefined/1 item = lead avulso, sem mudança
  // nenhuma de comportamento.
  familyMembers?: Lead[]
  onSchedule: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Lead['status']) => void
  onWhatsApp: (lead: Lead) => void
  onReminder: (lead: Lead) => void
  onChildDecision: (child: Lead, decision: 'enrolled' | 'lost' | 'open') => void
  onReopenAll: () => void
  // Fase 0A: base do lembrete "sem contato" (última interação real + limite da escola)
  reminderOpts?: ReminderOptions
  // Fase 0A: visita que já passou e está sem baixa → selo clicável
  pendingPastVisit?: PendingVisit | null
  onVisitOutcome?: (lead: Lead) => void
  waitingInfo?: { side: 'us' | 'family' | null; since: string } | null
}

function CardContent({ lead, config, isFlashing, overlay, compact, assignedUser, unitName, selectMode, selected, familyMembers, onSchedule, onEdit, onDelete, onStatusChange, onWhatsApp, onReminder, onChildDecision, onReopenAll, reminderOpts, pendingPastVisit, onVisitOutcome, waitingInfo }: CardContentProps) {
  const hasFamily = !!familyMembers && familyMembers.length > 1
  const lostReason = lead.lost_reason
  const lostLabel = lostReasonLabel(lostReason)
  const temperature = lead.lead_temperature ? LEAD_TEMPERATURES.find(t => t.value === lead.lead_temperature) : null
  const reminder = getLeadReminderInfo(lead, reminderOpts)
  const reminderColors = reminder ? REMINDER_COLORS[reminder.urgency] : null

  const hot = waitingInfo?.side === 'us' && lead.status !== 'lost' && lead.status !== 'enrolled'
  const stripe = hot ? '#EF4444' : config.accent
  const nameForColor = lead.responsible_name || lead.student_name || '?'
  const avatarBg = avatarColor(nameForColor)
  const initials = nameForColor.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const assignedInitials = assignedUser ? assignedUser.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : null
  const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, maxWidth: '100%' })

  return (
    <div
      className={`group relative ld-card ld-in overflow-hidden ${isFlashing ? 'animate-pulse' : ''}`}
      style={{
        background: selectMode && selected ? '#EEF2FF' : '#fff', borderRadius: 16, borderLeft: `4px solid ${stripe}`,
        border: `1px solid ${selectMode && selected ? '#818CF8' : isFlashing ? '#14B8A6' : '#fff'}`, borderLeftWidth: 4, borderLeftColor: stripe,
        boxShadow: overlay ? '0 18px 32px -12px rgba(26,43,74,.35)' : '0 1px 2px rgba(26,43,74,.05), 0 6px 16px -10px rgba(26,43,74,.22)',
        opacity: overlay ? 0.6 : 1,
      }}
    >
      {selectMode && (
        <div className="absolute top-2 right-2 z-10 pointer-events-none">
          <input type="checkbox" readOnly checked={!!selected} className="h-4 w-4 accent-indigo-600" aria-label="Selecionado" />
        </div>
      )}
      <div style={{ padding: compact ? 9 : 12 }}>
        {/* Responsável/família em destaque, aluno(s) como subtítulo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: compact ? 32 : 38, height: compact ? 32 : 38, borderRadius: 13, background: `linear-gradient(135deg, ${avatarBg}, ${avatarBg}CC)`, color: '#fff', fontWeight: 700, fontSize: compact ? 12 : 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
            {temperature && (
              <span title={temperature.label} style={{ position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: '50%', background: temperature.bg, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <temperature.icon size={10} color={temperature.color} />
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: compact ? 13.5 : 14.5, fontWeight: 700, color: '#1A2B4A', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.responsible_name}</h4>
            <p style={{ margin: 0, fontSize: 12, color: '#5B6B86', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
              <GraduationCap size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.student_name}</span>
              {hasFamily && (
                <span style={{ fontWeight: 700, color: '#7C3AED', flexShrink: 0 }}>+{familyMembers!.length - 1} irmão{familyMembers!.length - 1 === 1 ? '' : 's'}</span>
              )}
            </p>
          </div>
          {!overlay && (
            <button
              title="Excluir"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onDelete(lead.id) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selos: unidade, série, ano, origem, temperatura, campanha */}
        {(unitName || lead.grade_interest || lead.source || temperature || lead.campaign_cycle_id || lead.year_interest) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {unitName && <span style={pill('#EEF2FF', '#4338CA')}><MapPin size={10} />{unitName}</span>}
            {lead.grade_interest && <span style={pill('#E6F7F5', '#007A6E')}>{lead.grade_interest}</span>}
            {lead.year_interest && !compact && <span title="Ano de interesse" style={pill('#FEF3C7', '#B45309')}>{lead.year_interest}</span>}
            {lead.source && (lead.source === 'embed'
              ? <span style={pill('#E0F2FE', '#0369A1')}>Via site</span>
              : <span style={pill('#F1F5F9', '#475569')}>{lead.source}</span>)}
            {temperature && !compact && (
              <span title={temperature.label} style={{ ...pill(temperature.bg, temperature.color), border: `1px solid ${temperature.border}` }}><temperature.icon size={10} />{temperature.label}</span>
            )}
            {lead.campaign_cycle_id && !compact && (
              <span title={lead.cycle_link_kind === 'herdado' ? 'Pipeline herdado: criado antes do início da campanha (não conta como lead da campanha)' : 'Vinculado a uma campanha'} style={pill(lead.cycle_link_kind === 'herdado' ? '#F1F5F9' : '#F5F3FF', lead.cycle_link_kind === 'herdado' ? '#64748B' : '#7C3AED')}>
                <Megaphone size={10} />{lead.cycle_link_kind === 'herdado' ? 'Herdado' : 'Campanha'}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {!compact && lead.tags && lead.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {lead.tags.map(tag => <span key={tag} style={{ ...pill('#EEF2FF', '#4338CA'), fontSize: 10, padding: '1px 7px' }}><Tag size={9} />{tag}</span>)}
          </div>
        )}

        {/* Espera da conversa */}
        {!overlay && waitingInfo && lead.status !== 'lost' && lead.status !== 'enrolled' && (
          <div style={{ ...pill(waitingInfo.side === 'us' ? '#FEE2E2' : '#FEF3C7', waitingInfo.side === 'us' ? '#B91C1C' : '#B45309'), marginBottom: 8, borderRadius: 9, padding: '4px 9px' }}>
            <Clock size={11} />{waitingInfo.side === 'us' ? 'família esperando' : 'sem retorno da família'} {waitLabel(waitingInfo.since)}
          </div>
        )}

        {/* Telefone + atendente */}
        {!compact && (lead.phone || assignedUser) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            {lead.phone ? <span style={{ fontSize: 12, color: '#5B6B86', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{lead.phone}</span> : <span />}
            {assignedUser && (
              <span title={`Responsável: ${assignedUser.full_name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: '#1e2d6b', background: '#EEF2FF', padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>
                <UserCog size={10} />{assignedInitials}
              </span>
            )}
          </div>
        )}

        {/* Fase 0A — visita que já passou sem baixa */}
        {!overlay && pendingPastVisit && onVisitOutcome && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onVisitOutcome(lead) }}
            title="Dar baixa na visita"
            style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '4px 8px', borderRadius: 6, marginBottom: 4, background: '#FFFBEB', border: '1px solid #FDE68A', cursor: 'pointer' }}>
            <Calendar size={11} color="#B45309" />
            <span style={{ fontSize: 11, color: '#B45309', fontWeight: 600 }}>
              Visita {new Date(pendingPastVisit.scheduled_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} sem baixa
            </span>
          </button>
        )}

        {/* Lembrete (item 2d) */}
        {reminder && reminderColors && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onReminder(lead) }}
            title="Definir/editar lembrete"
            style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '4px 8px', borderRadius: 6, marginBottom: 4, background: reminderColors.bg, border: `1px solid ${reminderColors.border}`, cursor: 'pointer' }}>
            <Bell size={11} color={reminderColors.color} />
            <span style={{ fontSize: 11, color: reminderColors.color, fontWeight: 600 }}>{reminder.label}</span>
          </button>
        )}

        {lead.status === 'lost' && lostLabel && (
          <div style={{ background: '#FEF2F2', borderRadius: 6, padding: '4px 8px', marginBottom: 4 }}>
            <p style={{ fontSize: 11, color: '#DC2626', fontWeight: 500, margin: 0 }}>⚠ {lostLabel}</p>
          </div>
        )}

        {/* Consolidação de família — lista de filhos com controle individual
            de matrícula. O card só sai da etapa atual pras colunas finais
            quando todos os filhos abaixo estiverem decididos (ver
            familyInfoMap/effectiveStatus). */}
        {!overlay && hasFamily && (
          <div style={{ marginTop: 2, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(() => {
              const enrolledCount = familyMembers!.filter(m => m.status === 'enrolled').length
              const lostCount = familyMembers!.filter(m => m.status === 'lost').length
              if (enrolledCount === 0 && lostCount !== familyMembers!.length) return null
              const summary = enrolledCount > 0
                ? `${enrolledCount} de ${familyMembers!.length} matricularam`
                : `Todos os ${familyMembers!.length} alunos perderam`
              return (
                <p style={{ fontSize: 11, fontWeight: 700, color: enrolledCount > 0 ? '#16A34A' : '#DC2626', margin: 0 }}>
                  {summary}
                </p>
              )
            })()}
            {familyMembers!.map(child => {
              const decision: 'enrolled' | 'lost' | 'open' = child.status === 'enrolled' ? 'enrolled' : child.status === 'lost' ? 'lost' : 'open'
              return (
                <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, background: '#F8FAFC', borderRadius: 7, padding: '4px 6px' }}>
                  <span
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onEdit(child) }}
                    title="Editar aluno"
                    style={{ fontSize: 11, color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    {child.student_name}
                  </span>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {([
                      { key: 'enrolled' as const, label: 'Matric.', title: 'Matriculado', color: '#16A34A' },
                      { key: 'lost' as const,     label: 'Não',     title: 'Não matriculado', color: '#DC2626' },
                      { key: 'open' as const,     label: 'Aberto',  title: 'Em aberto', color: '#64748B' },
                    ]).map(opt => {
                      const active = decision === opt.key
                      return (
                        <button key={opt.key}
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); onChildDecision(child, opt.key) }}
                          disabled={active}
                          title={opt.title}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                            border: `1px solid ${active ? opt.color : '#E2E8F0'}`,
                            background: active ? opt.color : '#fff',
                            color: active ? '#fff' : '#94A3B8',
                            cursor: active ? 'default' : 'pointer',
                          }}>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Rodapé sempre visível */}
      {!overlay && (
        <div style={{ borderTop: '1px solid #F1F5F4', padding: '7px 10px', display: 'flex', gap: 6 }}>
          {lead.status === 'lost' ? (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); hasFamily ? onReopenAll() : onStatusChange(lead.id, 'contact') }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              🔄 Reabrir
            </button>
          ) : (
            <>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onWhatsApp(lead) }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', borderRadius: 10, background: '#DCFCE7', border: 'none', color: '#15803D', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <MessageCircle style={{ width: 13, height: 13 }} /> WhatsApp
              </button>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onSchedule(lead) }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', borderRadius: 10, background: '#EDE9FE', border: 'none', color: '#6D28D9', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <Calendar style={{ width: 13, height: 13 }} /> Visita
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── FilterDrawer ─────────────────────────────────────────────────────────────
// Item 6c — painel lateral com todos os filtros organizados (antes era uma
// fileira de selects soltos, que já não cabiam nem no desktop com os campos
// novos de responsável/temperatura). Compartilhado entre desktop e mobile.
interface FilterDrawerProps {
  open: boolean
  onClose: () => void
  filterStatus: string; setFilterStatus: (v: string) => void
  filterSource: string; setFilterSource: (v: string) => void
  periodFilter: string; setPeriodFilter: (v: any) => void
  campaignLabel?: string
  customStart: string; setCustomStart: (v: string) => void
  customEnd: string; setCustomEnd: (v: string) => void
  gradeFilter: string; setGradeFilter: (v: string) => void
  gradeNames: string[]
  schoolSources: string[]
  shiftFilter: string; setShiftFilter: (v: string) => void
  temperatureFilter: string; setTemperatureFilter: (v: any) => void
  ownerFilter: string; setOwnerFilter: (v: string) => void
  users: SimpleUser[]
  noContactFilter: boolean; setNoContactFilter: (v: boolean) => void
  noContactDays: number; setNoContactDays: (v: number) => void
  // Campo de unidade do lead — ausente quando a escola não usa o campo.
  unitFilterCfg?: { label: string; units: LeadUnit[]; value: string; onChange: (v: string) => void }
  onClear: () => void
}

function FilterDrawer(props: FilterDrawerProps) {
  const { open, onClose, filterStatus, setFilterStatus, filterSource, setFilterSource, periodFilter, setPeriodFilter, campaignLabel, customStart, setCustomStart, customEnd, setCustomEnd, gradeFilter, setGradeFilter, gradeNames, schoolSources, shiftFilter, setShiftFilter, temperatureFilter, setTemperatureFilter, ownerFilter, setOwnerFilter, users, noContactFilter, setNoContactFilter, noContactDays, setNoContactDays, unitFilterCfg, onClear } = props
  if (!open) return null

  const section = (label: string) => (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, marginTop: 18 }}>{label}</p>
  )
  const selCls: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', color: '#1A2B4A', background: '#fff', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1050, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 340, height: '100%', background: '#fff', boxShadow: '-8px 0 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal style={{ width: 16, height: 16, color: '#1A2B4A' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Filtros</h3>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X style={{ width: 13, height: 13, color: '#94A3B8' }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
          {section('Responsável')}
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={selCls}>
            <option value="mine">Meus leads</option>
            <option value="all">Todos</option>
            <option value="unassigned">Sem responsável</option>
            {users.length > 0 && <optgroup label="Atendente específico">
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </optgroup>}
          </select>

          {unitFilterCfg && (<>
            {section(unitFilterCfg.label)}
            <select value={unitFilterCfg.value} onChange={e => unitFilterCfg.onChange(e.target.value)} style={selCls}>
              <option value={UNIT_FILTER_ALL}>Todas</option>
              {unitFilterCfg.units.map(u => <option key={u.id} value={u.id}>{u.name}{u.active ? '' : ' (desativada)'}</option>)}
              <option value={UNIT_FILTER_NONE}>Sem {unitFilterCfg.label.toLowerCase()}</option>
            </select>
          </>)}

          {section('Status')}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selCls}>
            <option value="">Todos os status</option>
            {Object.entries(statusConfig).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
          </select>

          {section('Temperatura')}
          <select value={temperatureFilter} onChange={e => setTemperatureFilter(e.target.value)} style={selCls}>
            <option value="">Todas</option>
            {LEAD_TEMPERATURES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {section('Contato')}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A', cursor: 'pointer' }}>
            <input type="checkbox" checked={noContactFilter} onChange={e => setNoContactFilter(e.target.checked)} />
            Somente leads sem contato
          </label>
          {noContactFilter && (
            <select value={noContactDays} onChange={e => setNoContactDays(Number(e.target.value))} style={{ ...selCls, marginTop: 8 }}>
              {[3, 5, 7, 10, 15, 30].map(d => <option key={d} value={d}>Há mais de {d} dias</option>)}
            </select>
          )}

          {section('Origem')}
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={selCls}>
            <option value="">Todas as origens</option>
            {withCurrent(schoolSources, filterSource).map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {section('Série de interesse')}
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} style={selCls}>
            <option value="all">Todas as séries</option>
            {gradeNames.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {section('Turno')}
          <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} style={selCls}>
            <option value="all">Todos os turnos</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
            <option value="Integral">Integral</option>
          </select>

          {section('Período')}
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} style={selCls}>
            <option value="all">Todos os períodos</option>
            {campaignLabel && <option value="campaign">{campaignLabel} (início ao fim)</option>}
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mês</option>
            <option value="year">Este ano</option>
            <option value="custom">Personalizado</option>
          </select>
          {periodFilter === 'custom' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={selCls} />
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={selCls} />
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClear} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Limpar</button>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Aplicar</button>
        </div>
      </div>
    </div>
  )
}

// ─── SortableCard ─────────────────────────────────────────────────────────────
function SortableCard(props: Omit<CardContentProps, 'overlay'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.lead.id, disabled: !!props.selectMode })
  const didDrag = React.useRef(false)

  React.useEffect(() => {
    if (isDragging) didDrag.current = true
  }, [isDragging])

  const handleClick = () => {
    if (didDrag.current) { didDrag.current = false; return }
    props.onEdit(props.lead)
  }

  return (
    <div ref={setNodeRef} className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition, touchAction: 'none' }} {...attributes} {...listeners} onClick={handleClick}>
      <CardContent {...props} />
    </div>
  )
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────
// Item 13 — colunas colapsáveis (útil pra colunas com poucos cards, tipo
// "Matriculado"/"Perdido", ficarem compactas sem sumir do board).
function DroppableColumn({ id, isOver, collapsed, tint, children }: { id: string; isOver: boolean; collapsed?: boolean; tint?: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  if (collapsed) return <div ref={setNodeRef} style={{ display: 'none' }}>{children}</div>
  return (
    <div ref={setNodeRef} className={`flex-1 overflow-y-auto space-y-3 p-2.5 transition-all duration-200 ${isOver ? 'ring-2 ring-dashed ring-[#14b8a6] ring-inset' : ''}`} style={{ maxHeight: '72vh', borderRadius: '0 0 18px 18px', background: isOver ? '#14b8a614' : (tint ? `${tint}12` : '#F1F5F4') }}>
      {children}
    </div>
  )
}

// ─── LeadKanban ───────────────────────────────────────────────────────────────
export default function LeadKanban() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { names: gradeNames } = useGradeLevels(user?.institution_id)
  const unitCfg = useLeadUnits(user?.institution_id)
  const { sources: schoolSources } = useLeadSources(user?.institution_id)
  const { byValue: lostByValue } = useLostReasons(user?.institution_id)
  const [unitFilter, setUnitFilter] = useState<string>(UNIT_FILTER_ALL)
  // Edição em lote "Definir unidade" (só com o campo ligado).
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkUnit, setBulkUnit] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [periodFilter, setPeriodFilter] = useState<'all'|'today'|'week'|'month'|'year'|'custom'|'campaign'>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [auditLeadId, setAuditLeadId] = useState<string | null>(null)
  const [showScheduleVisitModal, setShowScheduleVisitModal] = useState(false)
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [flashingLeadId, setFlashingLeadId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // ── Item 2: propriedade do lead / lembretes ───────────────────────────────
  const [users, setUsers] = useState<SimpleUser[]>([])
  // Deep-link ?owner=<userId> — usado pelo atalho "Ver leads deste usuário"
  // em UserManagement.tsx/InstitutionDetails.tsx quando a remoção de alguém
  // da instituição é bloqueada por ter leads em aberto atribuídos a ele.
  const [ownerFilter, setOwnerFilter] = useState<string>(() => searchParams.get('owner') || 'all') // 'mine' | 'all' | 'unassigned' | <user id>
  const [reminderModal, setReminderModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null })

  // ── Item 7 — temperatura ───────────────────────────────────────────────────
  const [temperatureFilter, setTemperatureFilter] = useState<'' | 'frio' | 'morno' | 'quente'>('')

  // Filtro "sem contato" — dias ajustável no FilterDrawer (padrão = limite da
  // escola em lead_reminder_settings, o mesmo do selo de lembrete e do alerta
  // do GestorHome, que navega aqui com ?filter=no_contact).
  const [noContactFilter, setNoContactFilter] = useState(false)
  const [noContactDays, setNoContactDays] = useState(NO_CONTACT_DAYS)
  // Fase 0A: base única do "sem contato" (última interação real) e limite da
  // escola, que vira o padrão do filtro.
  const { optsFor, noContactDays: schoolNoContactDays, refresh: refreshInteractions } = useLeadInteractions(user?.institution_id)
  useEffect(() => { setNoContactDays(schoolNoContactDays) }, [schoolNoContactDays])
  // Fase 0A: visitas sem baixa por lead + pergunta "a visita aconteceu?"
  const [pendingVisitsByLead, setPendingVisitsByLead] = useState<Map<string, PendingVisit[]>>(new Map())
  const [visitPrompt, setVisitPrompt] = useState<{ open: boolean; title: string; subtitle?: string; visits: PendingVisit[]; advanceLead: boolean }>({ open: false, title: '', visits: [], advanceLead: true })

  // ── Item 6c — drawer de filtros modernizado ────────────────────────────────
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)

  // ── Item 13 — colunas colapsáveis + view compacta ──────────────────────────
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())
  const [compactView, setCompactView] = useState(false)

  // ── Faixa de atenção (clicável) + visão quadro/lista ───────────────────────
  const [attention, setAttention] = useState<AttentionKey | null>(null)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const { waiting, refresh: refreshWaiting } = useLeadWaiting(user?.institution_id)
  const [weekVisitLeadIds, setWeekVisitLeadIds] = useState<Set<string>>(new Set())
  const [todayVisitCount, setTodayVisitCount] = useState(0)
  const [monthEnrolledIds, setMonthEnrolledIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.institution_id) return
    const now = new Date()
    const wStart = new Date(now); wStart.setHours(0, 0, 0, 0); wStart.setDate(wStart.getDate() - wStart.getDay())
    const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 7)
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const tStart = new Date(now); tStart.setHours(0, 0, 0, 0)
    const tEnd = new Date(tStart); tEnd.setDate(tEnd.getDate() + 1)
    ;(async () => {
      const [v, e] = await Promise.all([
        supabase.from('visits').select('lead_id, scheduled_date, status').eq('institution_id', user.institution_id)
          .gte('scheduled_date', wStart.toISOString()).lt('scheduled_date', wEnd.toISOString()),
        supabase.from('lead_status_history').select('lead_id').eq('institution_id', user.institution_id)
          .eq('to_status', 'enrolled').gte('changed_at', mStart.toISOString()),
      ])
      const vs = ((v.data ?? []) as { lead_id: string | null; scheduled_date: string; status: string | null }[])
        .filter(x => x.lead_id && !['cancelled', 'canceled', 'cancelada'].includes((x.status ?? '').toLowerCase()))
      setWeekVisitLeadIds(new Set(vs.map(x => x.lead_id as string)))
      setTodayVisitCount(vs.filter(x => { const d = new Date(x.scheduled_date); return d >= tStart && d < tEnd }).length)
      setMonthEnrolledIds(new Set(((e.data ?? []) as { lead_id: string }[]).map(x => x.lead_id)))
    })()
  }, [user?.institution_id, leads.length])

  const isIncomplete = (l: Lead) => !['enrolled', 'lost'].includes(l.status) && (!l.grade_interest || !l.source || !l.assigned_to)

  // ── Item 10 — campanha ativa da instituição ────────────────────────────────
  const [activeCampaignCycle, setActiveCampaignCycle] = useState<{ id: string; label: string; targetYear: number | null; start?: string; end?: string } | null>(null)
  const [institutionCity, setInstitutionCity] = useState<string>('')

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Estado do modal de motivo de perda ───────────────────────────────────
  const [lostReasonModal, setLostReasonModal] = useState<{
    open: boolean
    lead: Lead | null
    // Todos os leads que serão marcados 'lost' ao confirmar — 1 no fluxo
    // normal, >1 quando é drag de um card de família consolidada (mesmo
    // motivo aplicado a todos os filhos ainda em aberto de uma vez).
    leadIds: string[]
    pendingLeads: Lead[] | null // snapshot para revert
  }>({ open: false, lead: null, leadIds: [], pendingLeads: null })

  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (highlightId) { setFlashingLeadId(highlightId); setTimeout(() => setFlashingLeadId(null), 3000) }
    if (searchParams.get('filter') === 'no_contact') { setNoContactFilter(true); setViewMode('list') }
    const fa = searchParams.get('filter')
    if (fa === 'us' || fa === 'family' || fa === 'visits' || fa === 'enrolled' || fa === 'incomplete') setAttention(fa)
  }, [searchParams])

  // "Ver lead" vindo de outras telas (?open=<id>): abre a ficha direto, uma vez só.
  const openedRef = useRef<string | null>(null)
  useEffect(() => {
    const id = searchParams.get('open') || searchParams.get('highlight')
    if (!id || openedRef.current === id || leads.length === 0) return
    const l = leads.find(x => x.id === id)
    if (l) { openedRef.current = id; setEditingLead(l); setShowNewLeadModal(true) }
  }, [searchParams, leads])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const showToast = useCallback((msg: string, type: 'error' | 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    if (!user?.institution_id) return
    loadData()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let leadsChannel: any = null
    ;(async () => {
      const { supabase: db } = await import('../../lib/supabase')
      leadsChannel = db
        .channel(`leads-kanban-${user.institution_id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `institution_id=eq.${user.institution_id}`,
        }, (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setLeads(prev => {
              if (prev.find(l => l.id === payload.new.id)) return prev
              return [payload.new as Lead, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l))
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id))
          }
        })
        .subscribe()
    })()
    return () => {
      ;(async () => {
        if (leadsChannel) {
          const { supabase: db } = await import('../../lib/supabase')
          db.removeChannel(leadsChannel)
        }
      })()
    }
  }, [user?.institution_id])

  const loadData = async () => {
    try {
      setLoading(true); setError('')
      const instId = user!.institution_id
      const [leadsData, usersRes, campaignRes, instRes] = await Promise.all([
        DatabaseService.getLeads(instId),
        supabase.from('users').select('id, full_name, role').eq('institution_id', instId).order('full_name'),
        // Mesma regra do banco (active_campaign_cycle_id): ativo/liberado, com datas, o mais recente.
        supabase.from('campaign_cycles').select('id, year, label, target_school_year, start_date, end_date').eq('institution_id', instId).in('status', ['active', 'released']).not('start_date', 'is', null).not('end_date', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('institutions').select('city').eq('id', instId).maybeSingle(),
      ])
      setLeads(leadsData)
      setPendingVisitsByLead(await fetchPendingVisitsByLead(instId))
      refreshInteractions()
      setUsers((usersRes.data as SimpleUser[]) ?? [])
      setActiveCampaignCycle(campaignRes.data ? { id: campaignRes.data.id, label: campaignRes.data.label || String(campaignRes.data.year), targetYear: campaignRes.data.target_school_year ?? null, start: campaignRes.data.start_date ?? undefined, end: campaignRes.data.end_date ?? undefined } : null)
      setInstitutionCity(instRes.data?.city ?? '')
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados dos leads')
    } finally {
      setLoading(false)
    }
  }

  // Fase 0A — ao mover o lead pra Visita ou adiante, pergunta se a visita
  // agendada aconteceu (visita só conta como realizada com baixa). Junta as
  // visitas de vários leads (card de família move todos de uma vez).
  const ADVANCED_STAGES: Lead['status'][] = ['visit', 'proposal', 'enrolled']
  const promptVisitsFor = async (leadIds: string[]) => {
    const map = await fetchPendingVisitsByLead(user!.institution_id)
    setPendingVisitsByLead(map)
    const visits = leadIds.flatMap(id => map.get(id) ?? [])
    if (visits.length === 0) return
    setVisitPrompt(prev => {
      const merged = prev.open ? [...prev.visits, ...visits.filter(v => !prev.visits.some(p => p.id === v.id))] : visits
      return { open: true, title: 'A visita aconteceu?', subtitle: 'O lead avançou de etapa e tem visita sem baixa. A visita só conta como realizada com baixa.', visits: merged, advanceLead: false }
    })
  }
  const openVisitOutcome = (lead: Lead) => {
    const visits = pendingVisitsByLead.get(lead.id) ?? []
    if (visits.length === 0) return
    setVisitPrompt({ open: true, title: 'Dar baixa na visita', subtitle: lead.student_name || lead.responsible_name || undefined, visits, advanceLead: true })
  }

  const handleSave = async (data: Partial<Lead> & { familyMatchId?: string | null; additionalStudents?: StudentEntry[] }) => {
    setError('')
    const statusAdvancedTo = editingLead && data.status && data.status !== editingLead.status && ADVANCED_STAGES.includes(data.status) ? editingLead.id : null
    try {
      await saveLead({
        institutionId: user!.institution_id,
        currentUser: { id: user!.id, full_name: user!.full_name, role: user!.role },
        users,
        editingLead,
        data,
        campaignCycleId: activeCampaignCycle?.id ?? null,
      })
    } catch (err) {
      console.error('[LEAD SAVE] erro:', err)
      showToast(formatSaveLeadError(err), 'error')
      throw err
    }

    await loadData()
    setEditingLead(null)
    if (statusAdvancedTo) promptVisitsFor([statusAdvancedTo])
  }


  // ── handleStatusChange — intercept "lost" para pedir motivo ──────────────
  const handleStatusChange = async (leadId: string, newStatus: Lead['status'], skipLostModal = false, customStageId?: string | null) => {
    const currentLead = leads.find(l => l.id === leadId)
    if (!currentLead) return

    // Se está indo para "Perdido" e não veio do modal já confirmado, abre o modal
    if (newStatus === 'lost' && !skipLostModal) {
      const snapshot = [...leads]
      // Optimistic update visual
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'lost' } : l))
      setLostReasonModal({ open: true, lead: currentLead, leadIds: [leadId], pendingLeads: snapshot })
      return
    }

    // Salva normalmente
    try {
      const previousStatus = currentLead.status
      await DatabaseService.updateLead(leadId, customStageId === undefined ? { status: newStatus } : { status: newStatus, custom_stage_id: customStageId })
      if (previousStatus !== newStatus) {
        const isReopen = previousStatus === 'lost'
        const { supabase: db } = await import('../../lib/supabase')
        await db.from('audit_logs').insert({
          institution_id: user!.institution_id, module: 'lead', record_id: leadId,
          action: isReopen ? 'Lead reaberto' : 'Status alterado',
          field_changed: isReopen
            ? 'Lead reaberto para contato'
            : `${statusConfig[previousStatus as keyof typeof statusConfig]?.label} → ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`,
          new_value: newStatus,
          user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
        })
        await logAudit({ institution_id: user!.institution_id, module: 'leads', record_id: leadId, action: 'status_changed', old_value: previousStatus, new_value: newStatus, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
        if (newStatus === 'enrolled') {
          // A matrícula formal (enrollments) é gravada pelo banco — gatilho
          // trg_lead_status_changed, Fase 0A — em qualquer caminho (Kanban,
          // modal, Hub, robô). Gravar aqui também duplicaria.
          createNotification({
            institution_id: user!.institution_id,
            type: 'milestone',
            title: 'Nova matrícula confirmada!',
            message: `${currentLead.student_name} foi matriculado(a) com sucesso.`,
            severity: 'success',
            action_url: '/leads',
          })
        }
      }
      await loadData()
      if (previousStatus !== newStatus && ADVANCED_STAGES.includes(newStatus)) promptVisitsFor([leadId])
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      setError('Erro ao atualizar status do lead')
      throw err
    }
  }

  // ── Confirmar perda com motivo — aplica a todos os leadIds de uma vez
  // (1 no caso normal, N quando é drag de card de família consolidada) ──────
  const handleConfirmLost = async (reason: string, detail: string) => {
    const lead = lostReasonModal.lead
    const ids = lostReasonModal.leadIds.length > 0 ? lostReasonModal.leadIds : (lead ? [lead.id] : [])
    if (!lead || ids.length === 0) return
    try {
      const { supabase: db } = await import('../../lib/supabase')

      // Salva status + motivo (mesmo motivo pra todos, quando em lote)
      await db.from('leads').update({
        status: 'lost',
        lost_reason: reason,
        lost_reason_detail: detail || null,
      }).in('id', ids)

      for (const id of ids) {
        const before = leads.find(l => l.id === id)
        await db.from('audit_logs').insert({
          institution_id: user!.institution_id, module: 'lead', record_id: id,
          action: 'Lead perdido',
          field_changed: lostByValue[reason]?.label || reason,
          new_value: detail || '',
          user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
        })

        await logAudit({
          institution_id: user!.institution_id,
          module: 'leads',
          record_id: id,
          action: 'status_changed',
          old_value: before?.status ?? lead.status,
          new_value: 'lost',
          user_id: user!.id,
          user_name: user!.full_name,
          user_role: user!.role,
        })
      }

      setLostReasonModal({ open: false, lead: null, leadIds: [], pendingLeads: null })
      await loadData()
      showToast(ids.length > 1 ? `${ids.length} alunos marcados como perdidos.` : 'Lead marcado como perdido.', 'success')
    } catch (err) {
      console.error('Erro ao salvar motivo de perda:', err)
      // Revert
      if (lostReasonModal.pendingLeads) setLeads(lostReasonModal.pendingLeads)
      setLostReasonModal({ open: false, lead: null, leadIds: [], pendingLeads: null })
      showToast('Erro ao salvar motivo. Tente novamente.', 'error')
    }
  }

  // ── Cancelar modal de perda — revert ──────────────────────────────────────
  const handleCancelLost = () => {
    if (lostReasonModal.pendingLeads) setLeads(lostReasonModal.pendingLeads)
    setLostReasonModal({ open: false, lead: null, leadIds: [], pendingLeads: null })
  }

  const handleDelete = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || !window.confirm(`Tem certeza que deseja excluir o lead "${lead.student_name}"?\n\nEsta ação não pode ser desfeita.`)) return
    try {
      const { supabase: db } = await import('../../lib/supabase')
      const instId = user!.institution_id

      // 1. Desvincular mensagens do lead
      await db.from('whatsapp_messages').update({ lead_id: null }).eq('lead_id', leadId).eq('institution_id', instId)
      // 2. Desvincular conversas do lead
      await db.from('whatsapp_conversations').update({ lead_id: null }).eq('lead_id', leadId).eq('institution_id', instId)
      // 3. Desvincular contatos do lead
      await db.from('whatsapp_contacts').update({ lead_id: null, type: 'unknown' }).eq('lead_id', leadId).eq('institution_id', instId)
      // 4. Deletar logs do lead
      await db.from('audit_logs').delete().eq('record_id', leadId).eq('institution_id', instId)

      // 5. Deletar o lead
      const { error } = await db.from('leads').delete().eq('id', leadId).eq('institution_id', instId)
      if (error) throw error

      await logAudit({ institution_id: instId, module: 'leads', record_id: leadId, action: 'deleted', old_value: lead.student_name, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
      setLeads(prev => prev.filter(l => l.id !== leadId))
      if (editingLead?.id === leadId) { setShowNewLeadModal(false); setEditingLead(null) }
      showToast('Lead excluído com sucesso', 'success')
    } catch (err) {
      console.error('[DELETE LEAD]', err)
      showToast('Erro ao excluir lead. Tente novamente.', 'error')
    }
  }

  const handleScheduleVisit = async (data: { scheduled_date: string; scheduled_time: string; notes: string }) => {
    if (!leadToSchedule) return
    try {
      const [hours, minutes] = data.scheduled_time.split(':')
      const [year, month, day] = data.scheduled_date.split('-')
      const visitDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), 0, 0)
      const createdVisit = await DatabaseService.createVisit({ institution_id: user!.institution_id, lead_id: leadToSchedule.id, student_name: leadToSchedule.student_name, scheduled_date: visitDate.toISOString(), notes: data.notes, status: 'scheduled' })
      await advanceLeadTo(leadToSchedule.id, 'scheduled')  // Fase 0A: só avança, nunca volta
      const { supabase: db } = await import('../../lib/supabase')
      await db.from('audit_logs').insert({
        institution_id: user!.institution_id, module: 'lead', record_id: leadToSchedule.id,
        action: 'Visita agendada',
        field_changed: `${data.scheduled_date} às ${data.scheduled_time}`,
        new_value: data.notes || '',
        user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
      })
      await loadData()
      setShowScheduleVisitModal(false)
      setLeadToSchedule(null)
      let extra = ''
      if (createdVisit?.id) {
        const r = await sendVisitMessages({ institutionId: user!.institution_id, lead: leadToSchedule, visitId: createdVisit.id, visitDate, userId: user!.id }).catch(() => null)
        if (r?.sent) extra = ' Confirmação enviada pelo WhatsApp.'
        else if (r?.note) extra = ' ' + r.note
      }
      showToast('Visita agendada com sucesso!' + extra, 'success')
    } catch (err) {
      console.error('Erro ao agendar visita:', err); setError('Erro ao agendar visita: ' + (err as Error).message)
    }
  }

  // ── Item 2d — lembrete manual ────────────────────────────────────────────
  const handleSaveReminder = async (date: string, note: string) => {
    const lead = reminderModal.lead
    if (!lead) return
    try {
      const { supabase: db } = await import('../../lib/supabase')
      const { error } = await db.from('leads').update({ next_followup: date }).eq('id', lead.id)
      if (error) throw error
      await db.from('audit_logs').insert({
        institution_id: user!.institution_id, module: 'lead', record_id: lead.id,
        action: 'Lembrete definido',
        field_changed: note || `Follow-up em ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}`,
        new_value: date,
        user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
      })
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, next_followup: date } : l))
      setReminderModal({ open: false, lead: null })
      showToast('Lembrete salvo!', 'success')
    } catch (err) {
      console.error('Erro ao salvar lembrete:', err)
      showToast('Erro ao salvar lembrete. Tente novamente.', 'error')
    }
  }

  const getPeriodDates = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    switch (periodFilter) {
      case 'today': return { start: today, end: now }
      case 'week': {
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        return { start: weekStart, end: now }
      }
      case 'month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
      case 'year':  return { start: new Date(now.getFullYear(), 0, 1), end: now }
      case 'campaign': return activeCampaignCycle?.start && activeCampaignCycle?.end
        ? { start: new Date(activeCampaignCycle.start + 'T00:00:00'), end: new Date(activeCampaignCycle.end + 'T23:59:59') }
        : { start: null, end: null }
      case 'custom': return {
        start: customStart ? new Date(customStart) : null,
        end:   customEnd   ? new Date(customEnd + 'T23:59:59') : null,
      }
      default: return { start: null, end: null }
    }
  }

  // Mesma regra de elegibilidade de getLeadReminderInfo (lib/leadReminders.ts)
  // pro critério "automático" — status aberto e sem next_followup manual
  // (que já tem prioridade/rótulo próprio) — com o número de dias ajustável no
  // filtro (padrão = limite da escola, o mesmo do selo de lembrete).
  const isLeadNoContact = (lead: Lead, days: number) => {
    if (lead.status === 'enrolled' || lead.status === 'lost') return false
    if (lead.next_followup) return false
    // Fase 0A: desde a última interação real (sem nenhuma, desde o cadastro)
    const base = optsFor(lead.id).lastInteractionAt ?? lead.created_at
    const idleDays = Math.floor((Date.now() - new Date(base).getTime()) / 86400000)
    return idleDays >= days
  }

  // Item 2b/6b — filtro de responsável ("Meus leads"/"Todos"/"Sem responsável"/
  // um atendente específico) + item 7 — filtro de temperatura. Compartilhado
  // entre a lista desktop (por coluna) e a lista mobile.
  const matchesLeadFilters = (lead: Lead, { start, end }: { start: Date | null; end: Date | null }) => {
    if (searchTerm !== '' && !lead.student_name.toLowerCase().includes(searchTerm.toLowerCase()) && !lead.responsible_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (filterSource !== '' && lead.source !== filterSource) return false
    if (periodFilter !== 'all') {
      const created = new Date(lead.created_at)
      if (start && created < start) return false
      if (end && created > end) return false
    }
    if (gradeFilter !== 'all' && lead.grade_interest !== gradeFilter) return false
    if (shiftFilter !== 'all' && (lead as any).shift_interest !== shiftFilter) return false
    if (temperatureFilter !== '' && lead.lead_temperature !== temperatureFilter) return false
    if (noContactFilter && !isLeadNoContact(lead, noContactDays)) return false
    if (attention === 'us' || attention === 'family') { if (waiting.get(lead.id)?.side !== attention) return false }
    else if (attention === 'visits') { if (!weekVisitLeadIds.has(lead.id)) return false }
    else if (attention === 'enrolled') { if (!monthEnrolledIds.has(lead.id)) return false }
    else if (attention === 'incomplete') { if (!isIncomplete(lead)) return false }
    if (ownerFilter === 'mine') { if (lead.assigned_to !== user?.id) return false }
    else if (ownerFilter === 'unassigned') { if (lead.assigned_to) return false }
    else if (ownerFilter !== 'all') { if (lead.assigned_to !== ownerFilter) return false }
    if (unitCfg.enabled && !matchesUnitFilter(lead.unit_id, unitFilter)) return false
    return true
  }

  // Item 3c (mobile) — agrupamento de irmãos por família, só pra mostrar o
  // chip "+N irmãos" na lista mobile, que continua 1 linha por lead (fora
  // do escopo da consolidação — só o Kanban desktop consolida em 1 card).
  const familySiblingsMap = React.useMemo(() => {
    const byFamily = new Map<string, Lead[]>()
    leads.forEach(l => { if (l.family_id) { const arr = byFamily.get(l.family_id) ?? []; arr.push(l); byFamily.set(l.family_id, arr) } })
    const map = new Map<string, Lead[]>()
    byFamily.forEach(group => group.forEach(l => map.set(l.id, group.filter(s => s.id !== l.id))))
    return map
  }, [leads])

  // ── Consolidação de leads-irmãos no Kanban desktop ────────────────────────
  // Famílias com ≥2 filhos aparecem como 1 único card. `effectiveStatus`
  // decide em qual coluna o card aparece:
  //  - enquanto houver ≥1 filho "em aberto" (status fora de enrolled/lost),
  //    o card fica na etapa inicial compartilhada (a mais avançada entre os
  //    filhos abertos — na prática todos avançam juntos via drag, então
  //    coincide; isso só é um fallback defensivo pra dado divergente);
  //  - só quando TODOS os filhos foram decididos o card sai pra Matriculado
  //    (≥1 matriculou) ou Perdido (todos perderam).
  // `representative` é o lead usado pra exibir avatar/badges no topo do
  // card — o filho aberto mais antigo enquanto a família está ativa, ou o
  // mais antigo entre os decididos quando já fechou.
  interface FamilyInfo {
    members: Lead[]
    openMembers: Lead[]
    enrolledMembers: Lead[]
    lostMembers: Lead[]
    effectiveStatus: Lead['status']
    representative: Lead
  }

  const familyInfoMap = React.useMemo(() => {
    const byFamily = new Map<string, Lead[]>()
    leads.forEach(l => { if (l.family_id) { const arr = byFamily.get(l.family_id) ?? []; arr.push(l); byFamily.set(l.family_id, arr) } })
    const map = new Map<string, FamilyInfo>()
    const stageOrder: string[] = LEAD_STAGES.map(s => s.key)
    byFamily.forEach((group, familyId) => {
      if (group.length < 2) return // família com 1 filho só = lead avulso, sem consolidar
      const members = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const openMembers = members.filter(l => l.status !== 'enrolled' && l.status !== 'lost')
      const enrolledMembers = members.filter(l => l.status === 'enrolled')
      const lostMembers = members.filter(l => l.status === 'lost')
      let effectiveStatus: Lead['status']
      let representative: Lead
      if (openMembers.length > 0) {
        effectiveStatus = openMembers.reduce((furthest, l) =>
          stageOrder.indexOf(l.status) > stageOrder.indexOf(furthest) ? l.status : furthest, openMembers[0].status)
        representative = openMembers[0]
      } else if (enrolledMembers.length > 0) {
        effectiveStatus = 'enrolled'
        representative = enrolledMembers[0]
      } else {
        effectiveStatus = 'lost'
        representative = lostMembers[0]
      }
      map.set(familyId, { members, openMembers, enrolledMembers, lostMembers, effectiveStatus, representative })
    })
    return map
  }, [leads])

  // Board (desktop) — 1 card por família consolidada, 1 card por lead
  // avulso. `matchesLeadFilters` casa se QUALQUER filho da família passar
  // no filtro (busca por nome de um filho específico, por exemplo, ainda
  // encontra o card da família).
  // `colKey`: a própria etapa (colunas originais) ou 'x:<id>' (etapa extra da escola).
  // O lead mostrado na coluna extra é o que tem custom_stage_id válido na etapa-mãe dela.
  const getLeadsByStatus = (colKey: string) => {
    const status = (isCustomColumnKey(colKey) ? getCustomStage(colKey.slice(2))?.after_stage : colKey) as Lead['status']
    const { start, end } = getPeriodDates()
    const items: Lead[] = []
    const seenFamilies = new Set<string>()
    for (const lead of leads) {
      const family = lead.family_id ? familyInfoMap.get(lead.family_id) : undefined
      if (family) {
        if (family.effectiveStatus !== status || leadColumnKey(family.representative, status) !== colKey || seenFamilies.has(lead.family_id!)) continue
        if (!family.members.some(m => matchesLeadFilters(m, { start, end }))) continue
        seenFamilies.add(lead.family_id!)
        items.push(family.representative)
      } else {
        if (lead.status !== status || leadColumnKey(lead) !== colKey || !matchesLeadFilters(lead, { start, end })) continue
        items.push(lead)
      }
    }
    return items
  }

  const usersById = React.useMemo(() => new Map(users.map(u => [u.id, u])), [users])

  const getLeadStats = () => {
    const total = leads.length
    const thisMonth = new Date().toISOString().slice(0, 7)
    const newThisMonth = leads.filter(l => l.created_at.startsWith(thisMonth)).length
    const converted = leads.filter(l => l.status === 'enrolled').length
    const conversionRate = total > 0 ? (converted / total) * 100 : 0
    return { total, newThisMonth, converted, conversionRate }
  }

  const handleDragStart = (event: DragStartEvent) => { setActiveId(event.active.id as string) }

  const isColumnId = (id: string) => Object.keys(statusConfig).includes(id) || (isCustomColumnKey(id) && !!getCustomStage(id.slice(2)))
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) { setOverColumnId(null); return }
    const overId = over.id as string
    if (isColumnId(overId)) { setOverColumnId(overId) }
    else { const overLead = leads.find(l => l.id === overId); setOverColumnId(overLead ? leadColumnKey(overLead) : null) }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null); setOverColumnId(null)
    if (!over) return

    const overId = over.id as string
    let targetStatus: Lead['status'] | null = null
    let targetCustom: string | null = null
    if (isColumnId(overId)) {
      if (isCustomColumnKey(overId)) { const c = getCustomStage(overId.slice(2)); targetStatus = c!.after_stage as Lead['status']; targetCustom = c!.id }
      else targetStatus = overId as Lead['status']
    } else {
      const overLead = leads.find(l => l.id === overId)
      if (overLead) { targetStatus = overLead.status; targetCustom = leadCustomStage(overLead)?.id ?? null }
    }
    if (!targetStatus) return

    const draggedLead = leads.find(l => l.id === active.id as string)
    if (!draggedLead) return
    const sameStatus = draggedLead.status === targetStatus
    const sameCustom = (leadCustomStage(draggedLead)?.id ?? null) === targetCustom
    if (sameStatus && sameCustom) return

    const previousLeads = [...leads]
    const family = draggedLead.family_id ? familyInfoMap.get(draggedLead.family_id) : undefined

    // Card de família consolidada (≥2 filhos) — arrastar move de uma vez
    // todos os filhos ainda "em aberto" (irmãos já decididos não são
    // afetados). Pra "Perdido", pede 1 motivo e aplica a todos. Lead
    // avulso (sem família, ou família de 1 filho) segue o fluxo de sempre,
    // sem nenhuma mudança — bloco abaixo.
    if (family && family.openMembers.length > 0) {
      const openIds = family.openMembers.map(m => m.id)

      if (targetStatus === 'lost') {
        setLostReasonModal({ open: true, lead: draggedLead, leadIds: openIds, pendingLeads: previousLeads })
        setLeads(prev => prev.map(l => openIds.includes(l.id) ? { ...l, status: 'lost' } : l))
        setFlashingLeadId(draggedLead.id)
        setTimeout(() => setFlashingLeadId(null), 1000)
        return
      }

      setLeads(prev => prev.map(l => openIds.includes(l.id) ? { ...l, status: targetStatus!, custom_stage_id: targetCustom } : l))
      setFlashingLeadId(draggedLead.id)
      setTimeout(() => setFlashingLeadId(null), 1000)

      Promise.all(openIds.map(id => handleStatusChange(id, targetStatus!, true, targetCustom))).catch(() => {
        setLeads(previousLeads)
        showToast('Erro ao mover o card. Tente novamente.', 'error')
      })
      return
    }

    // Se destino é "lost", o handleStatusChange vai abrir o modal
    // com snapshot para revert se cancelar
    if (targetStatus === 'lost') {
      setLostReasonModal({ open: true, lead: draggedLead, leadIds: [draggedLead.id], pendingLeads: previousLeads })
      setLeads(prev => prev.map(l => l.id === active.id ? { ...l, status: 'lost' } : l))
      setFlashingLeadId(active.id as string)
      setTimeout(() => setFlashingLeadId(null), 1000)
      return
    }

    // Outros status — fluxo normal
    setLeads(prev => prev.map(l => l.id === active.id ? { ...l, status: targetStatus!, custom_stage_id: targetCustom } : l))
    setFlashingLeadId(active.id as string)
    setTimeout(() => setFlashingLeadId(null), 1000)

    handleStatusChange(active.id as string, targetStatus, true, targetCustom).catch(() => {
      setLeads(previousLeads)
      showToast('Erro ao mover o card. Tente novamente.', 'error')
    })
  }

  const handleWhatsApp = (lead: Lead) => {
    if (!lead.phone) {
      showToast('Este lead não tem telefone cadastrado', 'error')
      return
    }
    // Mesma regra do resto do sistema: 9º dígito só em celular (src/lib/phone.ts).
    navigate(`/whatsapp?phone=${normalizeBrazilianInput(lead.phone)}`)
  }

  const stats = getLeadStats()
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null
  // colunas: cada etapa original seguida das extras da escola (filtrar por uma etapa mostra também as extras dela)
  const columns = stageColumns().filter(c => !filterStatus || c.status === filterStatus)
  const visibleStatuses = columns.map(c => c.key)
  const filteredTotal = visibleStatuses.reduce((sum, s) => sum + getLeadsByStatus(s).length, 0)
  const openLeads = leads.filter(l => !['enrolled', 'lost'].includes(l.status))
  const stripCounts: StripCounts = {
    us: openLeads.filter(l => waiting.get(l.id)?.side === 'us').length,
    family: openLeads.filter(l => waiting.get(l.id)?.side === 'family').length,
    visits: openLeads.filter(l => weekVisitLeadIds.has(l.id)).length,
    todayVisits: todayVisitCount,
    enrolled: leads.filter(l => monthEnrolledIds.has(l.id)).length,
    incomplete: openLeads.filter(isIncomplete).length,
  }
  const waitingRows: WaitingRow[] = (attention === 'us' || attention === 'family')
    ? openLeads.filter(l => waiting.get(l.id)?.side === attention).map(l => ({
        id: l.id, name: l.responsible_name || l.student_name, sub: [l.student_name, l.grade_interest].filter(Boolean).join(' · '),
        initials: (l.responsible_name || l.student_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        w: waiting.get(l.id)!, phone: l.phone,
      }))
    : []
  const openLeadChat = (r: WaitingRow) => {
    if (!r.phone) { showToast('Este lead não tem telefone cadastrado', 'error'); return }
    navigate(`/whatsapp?phone=${normalizeBrazilianInput(r.phone)}`)
  }
  const openLeadCard = (r: WaitingRow) => { const l = leads.find(x => x.id === r.id); if (l) { setEditingLead(l); setShowNewLeadModal(true) } }
  const attentionTitle: Record<AttentionKey, string> = {
    us: 'Famílias esperando resposta da escola', family: 'Famílias que não responderam', visits: 'Visitas da semana',
    enrolled: 'Matrículas do mês', incomplete: 'Cadastros com dados faltando',
  }
  const attentionBlock = (
    <>
      <style>{LEADS_CSS}</style>
      {/* Aviso da integração desligado até a comparação por nome parecido/telefone ficar pronta (evita duplicar leads). */}
      {SHOW_INTEGRATION_GAP && user?.institution_id && <IntegrationGap institutionId={user.institution_id} role={user.role} onDone={loadData} toast={showToast} />}
      <AttentionStrip counts={stripCounts} active={attention} onPick={k => { setAttention(k); if (k) refreshWaiting() }} />
      {(attention === 'us' || attention === 'family') && (
        <WaitingList title={attentionTitle[attention]} color={attention === 'us' ? '#B91C1C' : '#B45309'} rows={waitingRows}
          onOpenChat={openLeadChat} onOpenLead={openLeadCard} onClose={() => setAttention(null)} />
      )}
      {(attention === 'visits' || attention === 'enrolled' || attention === 'incomplete') && (
        <div className="ld-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, borderRadius: 12, padding: '8px 14px', fontSize: 13, color: BRAND.primaryDark, fontWeight: 600 }}>
          <span>Mostrando: {attentionTitle[attention]}</span>
          <button type="button" onClick={() => setAttention(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: BRAND.muted, fontSize: 12.5 }}>Limpar filtro</button>
        </div>
      )}
    </>
  )
  const hasActiveFilters = searchTerm !== '' || filterSource !== '' || filterStatus !== '' || periodFilter !== 'all' || gradeFilter !== 'all' || shiftFilter !== 'all' || temperatureFilter !== '' || ownerFilter !== 'all' || noContactFilter || attention !== null || (unitCfg.enabled && unitFilter !== UNIT_FILTER_ALL)

  // ── Consolidação de família — decisão individual por filho, dentro do
  // card (item 2 do pedido). 'open' reverte pro mesmo estágio usado pelo
  // botão "Reabrir" de sempre ('contact'); 'enrolled'/'lost' reaproveitam
  // handleStatusChange (que já cuida do registro em `enrollments` e do
  // modal de motivo de perda) ─────────────────────────────────────────────
  const handleChildDecision = (child: Lead, decision: 'enrolled' | 'lost' | 'open') => {
    if (decision === 'open') { handleStatusChange(child.id, 'contact'); return }
    handleStatusChange(child.id, decision)
  }

  const handleReopenAllLost = (lostLeadIds: string[]) => {
    lostLeadIds.forEach(id => handleStatusChange(id, 'contact'))
  }

  // ── Edição em lote: "Definir unidade" ───────────────────────────────────
  // Card de família representa todos os filhos: marcar o card marca todos.
  const idsForCard = (lead: Lead): string[] =>
    lead.family_id ? (familyInfoMap.get(lead.family_id)?.members.map(m => m.id) ?? [lead.id]) : [lead.id]
  const toggleSelected = (ids: string[]) => setSelectedIds(prev => {
    const next = new Set(prev)
    const allIn = ids.every(id => next.has(id))
    ids.forEach(id => allIn ? next.delete(id) : next.add(id))
    return next
  })
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); setBulkUnit('') }
  const applyBulkUnit = async () => {
    const ids = [...selectedIds]
    if (!ids.length || !user?.institution_id) return
    const newUnitId = bulkUnit === UNIT_FILTER_NONE ? null : bulkUnit
    if (bulkUnit === '') return
    const newName = newUnitId ? (unitCfg.unitName(newUnitId) ?? '') : `Sem ${unitCfg.label.toLowerCase()}`
    if (!window.confirm(`Definir ${unitCfg.label.toLowerCase()} "${newName}" para ${ids.length} lead${ids.length === 1 ? '' : 's'}?`)) return
    setBulkSaving(true)
    try {
      const before = new Map(leads.filter(l => selectedIds.has(l.id)).map(l => [l.id, l.unit_id ?? null]))
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200)
        const { error: upErr } = await supabase.from('leads')
          .update({ unit_id: newUnitId, updated_at: new Date().toISOString() })
          .in('id', chunk).eq('institution_id', user.institution_id)
        if (upErr) throw upErr
      }
      // Histórico de cada lead que de fato mudou.
      const changed = ids.filter(id => (before.get(id) ?? null) !== newUnitId)
      if (changed.length) {
        await supabase.from('audit_logs').insert(changed.map(id => ({
          institution_id: user.institution_id, module: 'lead', record_id: id,
          action: `${unitCfg.label} alterada`,
          field_changed: `${unitCfg.unitName(before.get(id)) || 'Sem ' + unitCfg.label.toLowerCase()} → ${newName} (em lote)`,
          new_value: newName,
          user_id: user.id, user_name: user.full_name, user_role: user.role,
        })))
      }
      setLeads(prev => prev.map(l => selectedIds.has(l.id) ? { ...l, unit_id: newUnitId } : l))
      showToast(`${unitCfg.label} definida para ${ids.length} lead${ids.length === 1 ? '' : 's'}.`, 'success')
      exitSelectMode()
    } catch (err) {
      console.error('[Kanban] erro na edição em lote de unidade:', err)
      showToast(formatSaveLeadError(err), 'error')
    } finally { setBulkSaving(false) }
  }

  const cardActions = {
    onSchedule: (lead: Lead) => { setLeadToSchedule(lead); setShowScheduleVisitModal(true) },
    onEdit: (lead: Lead) => {
      if (selectMode) { toggleSelected(idsForCard(lead)); return }
      setEditingLead(lead); setShowNewLeadModal(true)
    },
    onDelete: handleDelete,
    onStatusChange: handleStatusChange,
    onWhatsApp: handleWhatsApp,
    onReminder: (lead: Lead) => setReminderModal({ open: true, lead }),
    onChildDecision: handleChildDecision,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#14b8a6] border-t-transparent mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Carregando leads...</p>
        </div>
      </div>
    )
  }

  const clearAllFilters = () => {
    setSearchTerm(''); setFilterSource(''); setFilterStatus(''); setPeriodFilter('all')
    setCustomStart(''); setCustomEnd(''); setGradeFilter('all'); setShiftFilter('all')
    setTemperatureFilter(''); setOwnerFilter('all'); setNoContactFilter(false); setAttention(null); setNoContactDays(schoolNoContactDays)
    setUnitFilter(UNIT_FILTER_ALL)
  }

  const filterDrawerEl = (
    <FilterDrawer
      open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)}
      filterStatus={filterStatus} setFilterStatus={setFilterStatus}
      filterSource={filterSource} setFilterSource={setFilterSource} schoolSources={schoolSources}
      periodFilter={periodFilter} setPeriodFilter={setPeriodFilter} campaignLabel={activeCampaignCycle?.start ? activeCampaignCycle.label : undefined}
      customStart={customStart} setCustomStart={setCustomStart}
      customEnd={customEnd} setCustomEnd={setCustomEnd}
      gradeFilter={gradeFilter} setGradeFilter={setGradeFilter} gradeNames={gradeNames}
      shiftFilter={shiftFilter} setShiftFilter={setShiftFilter}
      temperatureFilter={temperatureFilter} setTemperatureFilter={setTemperatureFilter}
      ownerFilter={ownerFilter} setOwnerFilter={setOwnerFilter}
      users={users}
      noContactFilter={noContactFilter} setNoContactFilter={setNoContactFilter}
      noContactDays={noContactDays} setNoContactDays={setNoContactDays}
      unitFilterCfg={unitCfg.enabled ? { label: unitCfg.label, units: unitCfg.units, value: unitFilter, onChange: setUnitFilter } : undefined}
      onClear={clearAllFilters}
    />
  )

  // Barra fixa da edição em lote "Definir unidade" (desktop e celular).
  const bulkBarEl = unitCfg.enabled && selectMode ? (
    <div style={{ position: 'fixed', left: '50%', bottom: isMobile ? 76 : 24, transform: 'translateX(-50%)', zIndex: 1040, width: 'min(680px, calc(100% - 24px))', background: '#1E1B4B', color: '#fff', borderRadius: 14, boxShadow: '0 12px 32px rgba(15,23,42,0.35)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
        {selectedIds.size === 0 ? 'Toque nos leads para selecionar' : `${selectedIds.size} selecionado${selectedIds.size === 1 ? '' : 's'}`}
      </span>
      <select value={bulkUnit} onChange={e => setBulkUnit(e.target.value)} disabled={bulkSaving}
        style={{ flex: 1, minWidth: 150, padding: '7px 10px', borderRadius: 9, border: 'none', fontSize: 13, color: '#1A2B4A', background: '#fff' }}>
        <option value="">Definir {unitCfg.label.toLowerCase()}...</option>
        {unitCfg.activeUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        <option value={UNIT_FILTER_NONE}>Sem {unitCfg.label.toLowerCase()}</option>
      </select>
      <button onClick={applyBulkUnit} disabled={bulkSaving || !selectedIds.size || bulkUnit === ''}
        style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (bulkSaving || !selectedIds.size || bulkUnit === '') ? 0.5 : 1 }}>
        {bulkSaving ? 'Aplicando...' : 'Aplicar'}
      </button>
      <button onClick={exitSelectMode} disabled={bulkSaving}
        style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Cancelar
      </button>
    </div>
  ) : null
  const selectButtonStyle = (active: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1.5px solid ' + (active ? '#6366F1' : '#E2E8F0'), background: active ? '#EEF2FF' : '#fff', color: active ? '#4F46E5' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', whiteSpace: 'nowrap' })

  // ── Mobile early return ───────────────────────────────────────────────────
  if (isMobile) {
    const { start: pStart, end: pEnd } = getPeriodDates()
    const mobileLeads = leads.filter(l => {
      if (filterStatus !== '' && l.status !== filterStatus) return false
      return matchesLeadFilters(l, { start: pStart, end: pEnd })
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f9fb' }}>

        <div style={{ padding: '12px 12px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PageHeader compact icon={Users} title="Leads" subtitle={`${mobileLeads.length} no funil`} />
          {attentionBlock}
        </div>

        {/* Search + filtros */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0, display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 44, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 16, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {/* Atalho rápido "Meus leads" — alterna direto sem abrir o drawer completo */}
          <button onClick={() => setOwnerFilter(o => o === 'mine' ? 'all' : 'mine')} title="Meus leads"
            style={{ width: 44, height: 44, borderRadius: 12, background: ownerFilter === 'mine' ? '#00A896' : '#fff', border: '1.5px solid ' + (ownerFilter === 'mine' ? '#00A896' : '#E2E8F0'), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <UserCog style={{ width: 17, height: 17, color: ownerFilter === 'mine' ? '#fff' : '#64748B' }} />
          </button>
          <button onClick={() => setFilterDrawerOpen(true)} style={{ position: 'relative', width: 44, height: 44, borderRadius: 12, background: hasActiveFilters ? '#00A896' : '#fff', border: '1.5px solid ' + (hasActiveFilters ? '#00A896' : '#E2E8F0'), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <SlidersHorizontal style={{ width: 17, height: 17, color: hasActiveFilters ? '#fff' : '#64748B' }} />
          </button>
          {unitCfg.enabled && (
            <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} title={`Definir ${unitCfg.label.toLowerCase()} para vários leads`}
              style={{ width: 44, height: 44, borderRadius: 12, background: selectMode ? '#6366F1' : '#fff', border: '1.5px solid ' + (selectMode ? '#6366F1' : '#E2E8F0'), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <CheckSquare style={{ width: 17, height: 17, color: selectMode ? '#fff' : '#64748B' }} />
            </button>
          )}
        </div>

        {/* Status chips */}
        <div style={{ padding: '10px 16px 0', flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6, scrollbarWidth: 'none' }}>
          {[{ value: '', label: 'Todos' }, ...Object.entries(statusConfig).map(([v, c]) => ({ value: v, label: c.label }))].map(({ value, label }) => (
            <button key={value} onClick={() => setFilterStatus(value)}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filterStatus === value ? '#00A896' : '#F0FDFB',
                color: filterStatus === value ? '#fff' : '#64748B' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Lead list */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 10 }}>
          {mobileLeads.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#94A3B8' }}>Nenhum lead encontrado</p>
            </div>
          ) : mobileLeads.map(lead => {
            const cfg = statusConfig[lead.status]
            const reminder = getLeadReminderInfo(lead, optsFor(lead.id))
            const reminderColors = reminder ? REMINDER_COLORS[reminder.urgency] : null
            const pendingPast = (pendingVisitsByLead.get(lead.id) ?? []).find(isPastVisit)
            const siblings = familySiblingsMap.get(lead.id)
            return (
              <div key={lead.id} onClick={() => selectMode ? toggleSelected([lead.id]) : cardActions.onEdit(lead)}
                style={{ padding: '14px 16px', background: selectMode && selectedIds.has(lead.id) ? '#EEF2FF' : '#fff', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'center' }}>
                {selectMode && <input type="checkbox" readOnly checked={selectedIds.has(lead.id)} style={{ width: 18, height: 18, accentColor: '#4F46E5', flexShrink: 0 }} aria-label="Selecionado" />}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg?.accent ?? '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  {(lead.responsible_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.responsible_name}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, flexShrink: 0, marginLeft: 6,
                      background: cfg?.accent ? `${cfg.accent}22` : '#f1f5f9',
                      color: cfg?.accent ?? '#64748B' }}>
                      {leadCustomStage(lead)?.label ?? cfg?.label ?? lead.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0' }}>
                    🎓 {lead.student_name}
                    {siblings && siblings.length > 0 && <span style={{ marginLeft: 5, fontWeight: 600, color: '#8B5CF6' }}>+{siblings.length} irmão{siblings.length === 1 ? '' : 's'}</span>}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {unitCfg.enabled && unitCfg.unitName(lead.unit_id) && <span style={{ fontSize: 12, fontWeight: 600, color: '#4F46E5' }}>📍 {unitCfg.unitName(lead.unit_id)}</span>}
                    {lead.grade_interest && <span style={{ fontSize: 12, color: '#94A3B8' }}>{lead.grade_interest}</span>}
                    {lead.source && <span style={{ fontSize: 12, color: '#94A3B8' }}>{lead.source}</span>}
                    {reminder && reminderColors && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: reminderColors.color }}>
                        <Bell size={10} />{reminder.label}
                      </span>
                    )}
                    {pendingPast && !selectMode && (
                      <button onClick={e => { e.stopPropagation(); openVisitOutcome(lead) }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '1px 6px', cursor: 'pointer' }}>
                        <Calendar size={10} />Visita {new Date(pendingPast.scheduled_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} sem baixa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* FAB */}
        <button onClick={() => { setEditingLead(null); setShowNewLeadModal(true) }}
          style={{ position: 'fixed', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#00A896', color: '#fff', border: 'none', fontSize: 28, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,168,150,0.4)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus style={{ width: 26, height: 26 }} />
        </button>

        {filterDrawerEl}
        {bulkBarEl}

        {/* Modals */}
        <NewLeadModal isOpen={showNewLeadModal} onClose={() => { setShowNewLeadModal(false); setEditingLead(null) }} onSave={handleSave} editingLead={editingLead} onDelete={handleDelete} institutionId={user!.institution_id} users={users} activeCampaignLabel={activeCampaignCycle?.label} activeCampaignYear={activeCampaignCycle?.targetYear ?? null} institutionCity={institutionCity} />
        {showScheduleVisitModal && leadToSchedule && (
          <ScheduleVisitModal isOpen={showScheduleVisitModal} onClose={() => { setShowScheduleVisitModal(false); setLeadToSchedule(null) }} lead={leadToSchedule} onSchedule={handleScheduleVisit} />
        )}
        <ReminderModal isOpen={reminderModal.open} lead={reminderModal.lead} onClose={() => setReminderModal({ open: false, lead: null })} onSave={handleSaveReminder} />
      <VisitOutcomeDialog
        open={visitPrompt.open} title={visitPrompt.title} subtitle={visitPrompt.subtitle}
        visits={visitPrompt.visits} advanceLead={visitPrompt.advanceLead}
        onClose={() => { setVisitPrompt(p => ({ ...p, open: false, visits: [] })); loadData() }}
      />
        <LostReasonModal isOpen={lostReasonModal.open} lead={lostReasonModal.lead} count={lostReasonModal.leadIds.length} onConfirm={handleConfirmLost} onCancel={handleCancelLost} />
        {auditLeadId && <AuditModal recordId={auditLeadId} moduleName="leads" isOpen={!!auditLeadId} onClose={() => setAuditLeadId(null)} />}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
            {toast.msg}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', background: BRAND.bg }}>
      <style>{LEADS_CSS}</style>

      <PageHeader icon={Users} title="Leads" subtitle={`${filteredTotal} ${filteredTotal === 1 ? 'família no funil' : 'famílias no funil'}${hasActiveFilters ? ' (com filtros)' : ''}`}
        actions={<>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.16)', borderRadius: 10, padding: 3 }}>
            {([['board', 'Quadro', Kanban], ['list', 'Lista', ListIcon]] as const).map(([k, l, Ic]) => (
              <button key={k} type="button" onClick={() => setViewMode(k)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: viewMode === k ? '#fff' : 'transparent', color: viewMode === k ? BRAND.primaryDark : '#fff', transition: 'all .15s' }}><Ic size={14} />{l}</button>
            ))}
          </div>
          {viewMode === 'board' && (
            <button type="button" onClick={() => setCompactView(v => !v)} title={compactView ? 'Cartões normais' : 'Cartões compactos'}
              style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {compactView ? <Rows3 size={16} color="#fff" /> : <LayoutGrid size={16} color="#fff" />}
            </button>
          )}
          <button type="button" onClick={() => { setEditingLead(null); setShowNewLeadModal(true) }}
            style={{ background: '#fff', color: BRAND.primaryDark, border: 'none', padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Novo lead
          </button>
        </>} />

      {attentionBlock}

      {/* Filter Bar — item 6c: busca + botão de filtros (drawer) */}
      <div className="flex gap-3 mb-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none transition-all text-sm shadow-sm" />
        </div>
        {/* Atalho rápido "Meus leads" — alterna direto sem abrir o drawer completo */}
        <button
          onClick={() => setOwnerFilter(o => o === 'mine' ? 'all' : 'mine')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1.5px solid ' + (ownerFilter === 'mine' ? '#00A896' : '#E2E8F0'), background: ownerFilter === 'mine' ? '#00A896' : '#fff', color: ownerFilter === 'mine' ? '#fff' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <UserCog style={{ width: 14, height: 14 }} /> Meus Leads
        </button>
        <button
          onClick={() => setFilterDrawerOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1.5px solid ' + (hasActiveFilters ? '#00A896' : '#E2E8F0'), background: hasActiveFilters ? '#F0FDFB' : '#fff', color: hasActiveFilters ? '#00A896' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <SlidersHorizontal style={{ width: 14, height: 14 }} /> Filtros
          {hasActiveFilters && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#00A896' }} />}
        </button>
        {unitCfg.enabled && (
          <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} title={`Definir ${unitCfg.label.toLowerCase()} para vários leads`} style={selectButtonStyle(selectMode)}>
            <CheckSquare style={{ width: 14, height: 14 }} /> {selectMode ? 'Sair da seleção' : 'Selecionar'}
          </button>
        )}
        {hasActiveFilters && (
          <button onClick={clearAllFilters} className="px-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-all font-semibold whitespace-nowrap">
            Limpar
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-center gap-2 text-sm">
          <X className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Visão em lista */}
      {viewMode === 'list' && (() => {
        const rows = leads.filter(l => matchesLeadFilters(l, (() => { const { start, end } = getPeriodDates(); return { start, end } })())).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        return (
          <div className="ld-in" style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 14, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead><tr style={{ background: '#F8FAFC', color: BRAND.muted, textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase' }}>
                {['Família / aluno', 'Série', 'Etapa', 'Espera', 'Atendente', 'Criado', ''].map(h => <th key={h} style={{ padding: '9px 12px', fontWeight: 700 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: BRAND.faint }}>Nenhum lead encontrado</td></tr>}
                {rows.slice(0, 300).map(l => {
                  const w = waiting.get(l.id)
                  const cfg = statusConfig[l.status]
                  const temp = l.lead_temperature ? LEAD_TEMPERATURES.find(t => t.value === l.lead_temperature) : null
                  return (
                    <tr key={l.id} className="ld-row" onClick={() => cardActions.onEdit(l)} style={{ borderTop: '1px solid #EEF2F1', cursor: 'pointer' }}>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontWeight: 700, color: BRAND.ink }}>{l.responsible_name} {temp && <temp.icon size={12} color={temp.color} style={{ verticalAlign: -1 }} />}</div>
                        <div style={{ fontSize: 12, color: BRAND.muted }}>{l.student_name}</div>
                      </td>
                      <td style={{ padding: '9px 12px', color: BRAND.text }}>{l.grade_interest || '—'}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: `${cfg?.accent ?? '#64748B'}22`, color: cfg?.accent ?? '#64748B' }}>{leadCustomStage(l)?.label ?? cfg?.label ?? l.status}</span></td>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: w?.side === 'us' ? '#B91C1C' : BRAND.muted }}>{w ? `${w.side === 'us' ? 'Nossa vez' : 'Aguardando família'} · ${waitLabel(w.since)}` : '—'}</td>
                      <td style={{ padding: '9px 12px', color: BRAND.text }}>{l.assigned_to ? (usersById.get(l.assigned_to)?.full_name ?? '—') : '—'}</td>
                      <td style={{ padding: '9px 12px', color: BRAND.muted, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <button type="button" title="Abrir conversa" onClick={e => { e.stopPropagation(); handleWhatsApp(l) }} style={{ border: 'none', background: '#DCFCE7', color: '#15803D', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><MessageCircle size={14} /></button>{' '}
                        <button type="button" title="Agendar visita" onClick={e => { e.stopPropagation(); cardActions.onSchedule(l) }} style={{ border: 'none', background: '#DBEAFE', color: '#1D4ED8', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><Calendar size={14} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* Kanban Board */}
      {viewMode === 'board' && (
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {visibleStatuses.map((status) => {
              const col = columns.find(c => c.key === status)!
              const config = col.custom ? { ...statusConfig[col.status as keyof typeof statusConfig], label: col.custom.label } : statusConfig[col.status as keyof typeof statusConfig]
              const colLeads = getLeadsByStatus(status)
              return (
                <div key={status} className="flex-shrink-0 min-w-[260px] max-w-[260px] flex flex-col">
                  {/* Item 13 — clicável pra colapsar/expandir a coluna */}
                  <div
                    onClick={() => setCollapsedColumns(prev => { const next = new Set(prev); if (next.has(status)) next.delete(status); else next.add(status); return next })}
                    className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
                    style={{ background: `${config.accent}22`, borderRadius: collapsedColumns.has(status) ? 18 : '18px 18px 0 0' }}
                  >
                    <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#1A2B4A' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: config.accent }} />
                      {collapsedColumns.has(status) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {config.label}
                    </span>
                    <span style={{ background: '#fff', color: '#1A2B4A' }} className="text-xs font-bold px-2.5 py-0.5 rounded-full min-w-[24px] text-center">{colLeads.length}</span>
                  </div>
                  {!collapsedColumns.has(status) && (
                    <DroppableColumn id={status} tint={config.accent} isOver={overColumnId === status && activeId !== null}>
                      <SortableContext items={colLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                        {colLeads.map((lead) => {
                          const family = lead.family_id ? familyInfoMap.get(lead.family_id) : undefined
                          return (
                            <SortableCard
                              key={lead.id} lead={lead} config={config} isFlashing={flashingLeadId === lead.id}
                              compact={compactView}
                              assignedUser={lead.assigned_to ? usersById.get(lead.assigned_to) ?? null : null}
                              unitName={unitCfg.enabled ? unitCfg.unitName(lead.unit_id) : null}
                              selectMode={selectMode}
                              selected={idsForCard(lead).every(id => selectedIds.has(id))}
                              familyMembers={family?.members}
                              onReopenAll={() => handleReopenAllLost(family ? family.lostMembers.map(m => m.id) : [lead.id])}
                              reminderOpts={optsFor(lead.id)}
                              pendingPastVisit={(pendingVisitsByLead.get(lead.id) ?? []).find(isPastVisit) ?? null}
                              onVisitOutcome={openVisitOutcome}
                              waitingInfo={waiting.get(lead.id) ?? null}
                              {...cardActions}
                            />
                          )
                        })}
                      </SortableContext>
                      {colLeads.length === 0 && (
                        <div className="text-center py-12">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 opacity-20" style={{ backgroundColor: config.accent }}>
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <p className="text-xs text-gray-400">Nenhum lead</p>
                        </div>
                      )}
                    </DroppableColumn>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-[260px] rotate-1 cursor-grabbing">
              <CardContent
                lead={activeLead} config={leadCustomStage(activeLead) ? { ...statusConfig[activeLead.status], label: leadCustomStage(activeLead)!.label } : statusConfig[activeLead.status]} isFlashing={false} overlay
                reminderOpts={optsFor(activeLead.id)}
                compact={compactView}
                assignedUser={activeLead.assigned_to ? usersById.get(activeLead.assigned_to) ?? null : null}
                unitName={unitCfg.enabled ? unitCfg.unitName(activeLead.unit_id) : null}
                familyMembers={activeLead.family_id ? familyInfoMap.get(activeLead.family_id)?.members : undefined}
                onSchedule={() => {}} onEdit={() => {}} onDelete={() => {}} onStatusChange={() => {}} onWhatsApp={() => {}} onReminder={() => {}}
                onChildDecision={() => {}} onReopenAll={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {filterDrawerEl}
      {bulkBarEl}

      {/* Modals */}
      <NewLeadModal isOpen={showNewLeadModal} onClose={() => { setShowNewLeadModal(false); setEditingLead(null) }} onSave={handleSave} editingLead={editingLead} institutionId={user!.institution_id} users={users} activeCampaignLabel={activeCampaignCycle?.label} activeCampaignYear={activeCampaignCycle?.targetYear ?? null} institutionCity={institutionCity} />

      {showScheduleVisitModal && leadToSchedule && (
        <ScheduleVisitModal isOpen={showScheduleVisitModal} onClose={() => { setShowScheduleVisitModal(false); setLeadToSchedule(null) }} lead={leadToSchedule} onSchedule={handleScheduleVisit} />
      )}

      <ReminderModal isOpen={reminderModal.open} lead={reminderModal.lead} onClose={() => setReminderModal({ open: false, lead: null })} onSave={handleSaveReminder} />
      <VisitOutcomeDialog
        open={visitPrompt.open} title={visitPrompt.title} subtitle={visitPrompt.subtitle}
        visits={visitPrompt.visits} advanceLead={visitPrompt.advanceLead}
        onClose={() => { setVisitPrompt(p => ({ ...p, open: false, visits: [] })); loadData() }}
      />

      {/* Modal de motivo de perda */}
      <LostReasonModal
        isOpen={lostReasonModal.open}
        lead={lostReasonModal.lead}
        count={lostReasonModal.leadIds.length}
        onConfirm={handleConfirmLost}
        onCancel={handleCancelLost}
      />

      {auditLeadId && <AuditModal recordId={auditLeadId} moduleName="leads" isOpen={!!auditLeadId} onClose={() => setAuditLeadId(null)} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
