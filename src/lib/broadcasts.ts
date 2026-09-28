// =============================================================================
// src/lib/broadcasts.ts
//
// Transmissões (campanhas de disparo em massa por escola) — tipos, rótulos e
// chamadas ao backend. Toda escrita de campanha passa pela Edge Function
// broadcast-campaigns (a RLS só deixa o navegador LER campanhas); a cobrança
// é o asaas-create-charge { campaign_id }; o envio de template da escola pra
// Meta é a ação submit_school_template de /api/whatsapp/template-definitions.
// =============================================================================
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Módulo liberado pra escola (broadcast_settings.enabled, só a Áion liga).
// Antes do lançamento oficial, escola sem o módulo não vê nem o menu — não é
// "vitrine" por padrão. null = ainda carregando (o menu não mostra até saber).
export function useBroadcastEnabled(institutionId: string | null | undefined): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (!institutionId) { setEnabled(false); return }
    let alive = true
    setEnabled(null)
    supabase.from('broadcast_settings').select('enabled').eq('institution_id', institutionId).maybeSingle()
      .then(({ data }) => { if (alive) setEnabled(!!(data as any)?.enabled) })
    return () => { alive = false }
  }, [institutionId])
  return enabled
}

export type CampaignStatus =
  | 'draft' | 'pending_template' | 'pending_payment' | 'scheduled'
  | 'sending' | 'paused' | 'completed' | 'cancelled'

export interface Campaign {
  id: string
  institution_id: string
  name: string
  template_definition_id: string
  template_name: string
  status: CampaignStatus
  paused_reason: string | null
  send_mode: 'now' | 'scheduled'
  scheduled_at: string | null
  priced_category: string | null
  priced_own_account: boolean | null
  priced_recipients: number | null
  unit_meta_cost_brl: number | null
  unit_fee_brl: number | null
  subtotal_brl: number | null
  credit_applied_brl: number
  total_charged_brl: number | null
  priced_at: string | null
  payment_id: string | null
  paid_at: string | null
  template_approved_at: string | null
  total_recipients: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  replied_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  has_imported_list: boolean
}

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft:            { label: 'Rascunho',              color: '#64748B', bg: '#F1F5F9' },
  pending_template: { label: 'Aguardando template',   color: '#B45309', bg: '#FEF3C7' },
  pending_payment:  { label: 'Aguardando pagamento',  color: '#B45309', bg: '#FEF3C7' },
  scheduled:        { label: 'Agendada',              color: '#1D4ED8', bg: '#DBEAFE' },
  sending:          { label: 'Enviando',              color: '#047857', bg: '#D1FAE5' },
  paused:           { label: 'Pausada',               color: '#C2410C', bg: '#FFEDD5' },
  completed:        { label: 'Concluída',             color: '#1e2d6b', bg: '#E0E7FF' },
  cancelled:        { label: 'Cancelada',             color: '#991B1B', bg: '#FEE2E2' },
}

export const PAUSED_REASON: Record<string, string> = {
  manual:                    'Pausada pela escola',
  template_paused:           'Template pausado pela Meta',
  template_disabled:         'Template desativado pela Meta',
  template_error:            'Erro no template (parâmetros) — revise antes de retomar',
  payment_refunded:          'Pagamento estornado',
  payment_cancelled:         'Cobrança cancelada',
  meta_131042:               'Problema de pagamento na conta da Meta',
  meta_131048:               'Limite de spam da Meta atingido',
  no_phone_number:           'Escola sem número de WhatsApp ativo',
  shared_number_unsupported: 'Número compartilhado de grupo escolar',
  no_access_token:           'Configuração do WhatsApp incompleta',
}

export const EXCLUDED_REASON: Record<string, string> = {
  suppressed:    'Pediram pra não receber',
  blacklisted:   'Bloqueados na escola',
  non_br:        'Número estrangeiro',
  invalid_phone: 'Número inválido',
  deselected:    'Desmarcados',
}

export const FAILURE_KIND: Record<string, string> = {
  permanent:           'Número não recebe',
  temporary_exhausted: 'Meta segurou o envio',
  unknown:             'Sem confirmação da Meta',
  suppressed:          'Pediu pra não receber',
  cancelled:           'Campanha cancelada',
}

export const TEMPLATE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  not_submitted: { label: 'Rascunho',          color: '#64748B', bg: '#F1F5F9' },
  pending:       { label: 'Em análise na Meta', color: '#B45309', bg: '#FEF3C7' },
  approved:      { label: 'Aprovado',          color: '#047857', bg: '#D1FAE5' },
  rejected:      { label: 'Rejeitado',         color: '#991B1B', bg: '#FEE2E2' },
  paused:        { label: 'Pausado pela Meta', color: '#C2410C', bg: '#FFEDD5' },
  disabled:      { label: 'Desativado',        color: '#475569', bg: '#E2E8F0' },
}

export const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação',
}

export const brl = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Chamadas ────────────────────────────────────────────────────────────────

export class BroadcastError extends Error {
  constructor(message: string, public details?: string[]) { super(message) }
}

// supabase.functions.invoke devolve só "Edge Function returned a non-2xx
// status code" no erro — a mensagem de verdade vem no corpo da resposta.
async function unwrapInvoke<T>(res: { data: T | null; error: any }): Promise<T> {
  if (!res.error) return res.data as T
  let message = res.error.message || 'Erro inesperado'
  let details: string[] | undefined
  try {
    const body = await res.error.context?.json?.()
    if (body?.error) message = body.error
    if (Array.isArray(body?.details)) details = body.details
  } catch { /* corpo não-JSON: fica a mensagem genérica */ }
  throw new BroadcastError(message, details)
}

export async function broadcastAction<T = any>(action: string, body: Record<string, unknown>): Promise<T> {
  return unwrapInvoke<T>(await supabase.functions.invoke('broadcast-campaigns', { body: { action, ...body } }))
}

export async function chargeCampaign(campaignId: string): Promise<{ paymentLink: string; reused?: boolean }> {
  return unwrapInvoke(await supabase.functions.invoke('asaas-create-charge', { body: { campaign_id: campaignId } }))
}

export async function submitSchoolTemplate(templateDefinitionId: string): Promise<{ results: { status: string; error_message: string | null }[] }> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/whatsapp/template-definitions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ action: 'submit_school_template', template_definition_id: templateDefinitionId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new BroadcastError(body?.error || `Erro ${res.status}`, Array.isArray(body?.details) ? body.details : undefined)
  return body
}

// ── Lista importada (CSV) ───────────────────────────────────────────────────
// Primeira linha = cabeçalho. Coluna de telefone reconhecida por nome
// (telefone/celular/whatsapp/phone/fone); "nome"/"name" vira o nome; as
// demais viram variáveis ({ turma: "3º A" }) usáveis no template.
export interface ImportRow { phone: string; name?: string; variables: Record<string, string> }

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted
    } else if (ch === sep && !quoted) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

export function parseImportCsv(text: string): { rows: ImportRow[]; columns: string[]; error?: string } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { rows: [], columns: [], error: 'O arquivo precisa ter um cabeçalho e pelo menos uma linha' }
  const sep = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ','
  const header = splitCsvLine(lines[0], sep).map(h => h.toLowerCase())
  const phoneIdx = header.findIndex(h => /^(telefone|celular|whatsapp|phone|fone|numero|número)/.test(h))
  if (phoneIdx < 0) return { rows: [], columns: [], error: 'Não achei a coluna de telefone (use "telefone", "celular" ou "whatsapp" no cabeçalho)' }
  const nameIdx = header.findIndex(h => /^(nome|name|responsavel|responsável)/.test(h))
  const varCols = header.map((h, i) => ({ h, i })).filter(c => c.i !== phoneIdx && c.i !== nameIdx && c.h)

  const rows: ImportRow[] = []
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, sep)
    const phone = cells[phoneIdx] || ''
    if (!phone.replace(/\D/g, '')) continue
    const variables: Record<string, string> = {}
    for (const c of varCols) if (cells[c.i]) variables[c.h] = cells[c.i]
    rows.push({ phone, name: nameIdx >= 0 ? cells[nameIdx] || undefined : undefined, variables })
  }
  return { rows, columns: varCols.map(c => c.h) }
}
