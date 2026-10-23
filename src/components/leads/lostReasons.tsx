// Motivos de perda do lead e o modal que pede o motivo — compartilhados pelo
// Kanban (arrastar pra Perdido, card de família) e pelo formulário do lead
// (botão "Marcar como Perdido"). Desde a Fase 0C o banco recusa perdido sem
// motivo (leads_lost_requires_reason).
import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertTriangle } from 'lucide-react'
import type { Lead } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { useCallback } from 'react'

export interface LostReason { value: string; label: string; short: string; fator: string; subfator: string | null }
// Motivo que fica sempre ligado: é o que sobra quando nenhum outro serve.
export const LOCKED_LOST_REASON = 'outro'

// ─── Motivos de recusa ────────────────────────────────────────────────────────
// Fonte ÚNICA (Fase 0C + 6.1): label no Kanban/formulário, short e fator nos Relatórios.
export const LOST_REASONS: LostReason[] = [
  { value: 'preco_alto',        label: 'Valor da mensalidade alto', short: 'Valor alto',           fator: 'Interno', subfator: 'Administrativo' },
  { value: 'nao_retornou',      label: 'Não retornou nosso contato', short: 'Não retornou',          fator: 'Externo', subfator: null },
  { value: 'outra_escola',      label: 'Escolheu outra escola', short: 'Outra escola',               fator: 'Externo', subfator: null },
  { value: 'sem_vaga',          label: 'Sem vaga na série de interesse', short: 'Sem vaga',      fator: 'Interno', subfator: 'Administrativo' },
  { value: 'nao_oferece_serie', label: 'Escola não oferece a série desejada', short: 'Série não ofertada', fator: 'Interno', subfator: 'Administrativo' },
  { value: 'nao_gostou',        label: 'Não gostou da escola', short: 'Não gostou',                fator: 'Interno', subfator: 'Administrativo' },
  { value: 'mudou_cidade',      label: 'Mudou de cidade', short: 'Mudou de cidade',                     fator: 'Externo', subfator: null },
  { value: 'dificuldade_fin',   label: 'Dificuldade financeira', short: 'Dificuldade financeira',              fator: 'Externo', subfator: null },
  { value: 'desistiu',          label: 'Desistiu sem informar motivo', short: 'Desistiu',        fator: 'Externo', subfator: null },
  { value: 'outro',             label: 'Outro motivo', short: 'Outro',                        fator: 'Interno', subfator: 'Administrativo' },
]


// ─── LostReasonModal ──────────────────────────────────────────────────────────
export interface LostReasonModalProps {
  isOpen: boolean
  lead: Lead | null
  // >1 quando o motivo se aplica a vários filhos de uma família de uma vez
  // (drag do card consolidado pra coluna "Perdido") — mesmo motivo pra todos.
  count?: number
  onConfirm: (reason: string, detail: string) => Promise<void>
  onCancel: () => void
}

export function LostReasonModal({ isOpen, lead, count, onConfirm, onCancel }: LostReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)
  const { reasons } = useLostReasons(lead?.institution_id)

  useEffect(() => {
    if (isOpen) { setSelectedReason(''); setDetail('') }
  }, [isOpen])

  if (!isOpen || !lead) return null

  const handleConfirm = async () => {
    if (!selectedReason) return
    setSaving(true)
    try {
      await onConfirm(selectedReason, detail)
    } finally {
      setSaving(false)
    }
  }

  const selected = reasons.find(r => r.value === selectedReason)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #fee2e2'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: '#FEE2E2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <AlertTriangle style={{ width: 18, height: 18, color: '#EF4444' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>
              {count && count > 1 ? 'Por que estes alunos foram perdidos?' : 'Por que este lead foi perdido?'}
            </h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
              {count && count > 1 ? `${lead.responsible_name} — ${count} alunos` : `${lead.student_name} · ${lead.responsible_name}`}
            </p>
          </div>
          <button onClick={onCancel} style={{
            marginLeft: 'auto', width: 28, height: 28, borderRadius: 8,
            border: '1px solid #E2E8F0', background: '#F8FAFC',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
            <X style={{ width: 13, height: 13, color: '#94A3B8' }} />
          </button>
        </div>

        {/* Motivos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {reasons.map(reason => {
            const active = selectedReason === reason.value
            return (
              <button
                key={reason.value}
                onClick={() => setSelectedReason(reason.value)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: active ? '2px solid #EF4444' : '1.5px solid #E2E8F0',
                  background: active ? '#FEF2F2' : '#F8FAFC',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#DC2626' : '#475569' }}>
                  {reason.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                    background: reason.fator === 'Externo' ? '#EFF6FF' : '#FFF7ED',
                    color: reason.fator === 'Externo' ? '#1D4ED8' : '#9A3412'
                  }}>
                    {reason.fator}
                  </span>
                  {active && <CheckCircle style={{ width: 14, height: 14, color: '#EF4444' }} />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Fator identificado */}
        {selected && (
          <div style={{
            background: selected.fator === 'Externo' ? '#EFF6FF' : '#FFF7ED',
            border: `1px solid ${selected.fator === 'Externo' ? '#BFDBFE' : '#FED7AA'}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: selected.fator === 'Externo' ? '#1E40AF' : '#9A3412'
          }}>
            <strong>Fator {selected.fator}</strong>
            {selected.subfator && ` · ${selected.subfator}`}
            {selected.fator === 'Externo'
              ? ' — Fatores fora do controle da escola'
              : ' — Pontos que a escola pode melhorar'}
          </div>
        )}

        {/* Detalhe opcional */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Observações adicionais (opcional)
          </label>
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder="Descreva o que o responsável disse ou qualquer contexto relevante..."
            rows={2}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 9, fontSize: 13,
              border: '1.5px solid #E2E8F0', background: '#F8FAFC', outline: 'none',
              resize: 'none', boxSizing: 'border-box', color: '#1A2B4A'
            }}
          />
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0',
            background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B', fontWeight: 500
          }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 20px', borderRadius: 9, background: selectedReason ? '#EF4444' : '#E2E8F0',
              color: selectedReason ? '#fff' : '#94A3B8', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: selectedReason ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
          >
            {saving
              ? <><div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />Salvando...</>
              : <><AlertTriangle style={{ width: 13, height: 13 }} />Confirmar perda</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// Rótulo de qualquer motivo gravado, inclusive os que não aparecem no modal:
// 'nao_informado' = perdido antes do motivo ser obrigatório (backfill da Fase 0C).
export function lostReasonLabel(value: string | null | undefined): string | null {
  if (!value) return null
  if (value === 'nao_informado') return 'Não informado (antes da regra)'
  return (schoolLostIndex[value] ?? LOST_REASONS.find(r => r.value === value))?.label ?? value
}


// ─── Motivos por escola ───────────────────────────────────────────────────────
// Sem linhas em lost_reason_options = a lista padrão acima. A escola pode desligar,
// reordenar e acrescentar motivos (Configurações > Funil e leads). O `value` gravado
// no lead nunca muda, por isso o histórico e os relatórios continuam batendo.
export interface LostReasonRow extends LostReason { id: string; active: boolean; sort_order: number }

// Índice (valor → motivo) dos motivos da escola, ligados ou não, para rotular o que já foi gravado.
let schoolLostIndex: Record<string, LostReason> = {}
const LOST_CHANGED = 'aion:lost-reasons-changed'
export const notifyLostReasonsChanged = () => window.dispatchEvent(new Event(LOST_CHANGED))

export function useLostReasons(institutionId: string | undefined | null) {
  const [rows, setRows] = useState<LostReasonRow[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    if (!institutionId) { setRows([]); setLoading(false); return }
    const { data, error } = await supabase.from('lost_reason_options')
      .select('id, value, label, short, fator, active, sort_order').eq('institution_id', institutionId).order('sort_order', { ascending: true })
    if (error) console.error('[useLostReasons]', error.message)
    const list = ((data as any[]) ?? []).map(r => ({ ...r, subfator: null })) as LostReasonRow[]
    schoolLostIndex = Object.fromEntries(list.map(r => [r.value, r]))
    setRows(list)
    setLoading(false)
  }, [institutionId])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { window.addEventListener(LOST_CHANGED, reload); return () => window.removeEventListener(LOST_CHANGED, reload) }, [reload])

  const configured = rows.length > 0
  const reasons: LostReason[] = configured ? rows.filter(r => r.active) : LOST_REASONS
  // valor → motivo, com os desligados e os padrão como reserva (leads antigos).
  const byValue: Record<string, LostReason> = { ...Object.fromEntries(LOST_REASONS.map(r => [r.value, r])), ...Object.fromEntries(rows.map(r => [r.value, r])) }
  return { rows, configured, reasons, byValue, loading, reload }
}
