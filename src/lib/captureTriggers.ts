// =============================================================================
// src/lib/captureTriggers.ts
//
// Compartilhado pelo módulo Captação Inteligente (src/pages/gestor/
// CaptacaoInteligente.tsx) e pelos badges de origem do WhatsAppHub.
// Tabelas: capture_triggers / capture_trigger_assignees / capture_trigger_hits
// (20260925000000_capture_triggers.sql). O match em si roda no webhook
// (api/whatsapp/webhook.ts:applyCaptureTrigger).
// =============================================================================

export type CaptureChannel = 'meta_ads' | 'google_ads' | 'instagram' | 'facebook' | 'tiktok' | 'site' | 'outro'

export interface CaptureTrigger {
  id: string
  institution_id: string
  name: string
  channel: CaptureChannel
  trigger_text: string
  meta_ad_ids: string[]
  auto_reply: string | null
  skip_bot_flow: boolean
  tag_name: string | null
  rr_index: number
  is_active: boolean
  archived_at: string | null
  created_at: string
}

// Mesmos pares cor/fundo pastel usados nos badges do resto do sistema
// (Sidebar NAV_CFG, REASON_MAP de GestorTransfers).
export const CAPTURE_CHANNELS: Record<CaptureChannel, { label: string; color: string; bg: string }> = {
  meta_ads:   { label: 'Meta Ads',            color: '#2563EB', bg: '#DBEAFE' },
  google_ads: { label: 'Google Ads',          color: '#D97706', bg: '#FEF3C7' },
  instagram:  { label: 'Instagram orgânico',  color: '#DB2777', bg: '#FCE7F3' },
  facebook:   { label: 'Facebook orgânico',   color: '#4F46E5', bg: '#E0E7FF' },
  tiktok:     { label: 'TikTok',              color: '#1A2B4A', bg: '#E2E8F0' },
  site:       { label: 'Site / Landing page', color: '#059669', bg: '#D1FAE5' },
  outro:      { label: 'Outro',               color: '#64748B', bg: '#F1F5F9' },
}

// Mesmo mínimo do CHECK da tabela (trigger_text >= 10 caracteres).
export const CAPTURE_TEXT_MIN = 10

// Espelho de normalizeCaptureText do webhook — api/ não importa de src/lib
// neste projeto, então a regra existe nos dois lugares; manter iguais.
// Ignora pontuação (\p{P}) dos dois lados; emojis (\p{So}) continuam.
export function normalizeCaptureText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\p{P}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Link wa.me com o texto do gatilho pronto pra colar no gerenciador de
// anúncios. encodeURIComponent (não replace(' ', '%20'), como o link gerado
// de aion_keywords) — codifica acento, &, #, quebra de linha, que do
// contrário cortariam ou alterariam o texto e quebrariam o match.
// Não passa por normalizePhone: número da escola pode ser fixo (8 dígitos) e
// ganharia um 9 indevido. Só tira a formatação e garante o 55.
//
// encodeURIComponent deixa . ! ' ( ) * ~ crus — uma URL terminando em "."
// tem o ponto cortado por quem transforma texto em link clicável (WhatsApp,
// Notas, bio do Instagram), que trata como pontuação da frase. Codificar
// esses também garante que o link nunca termine em pontuação solta.
export function buildWaMeLink(schoolPhone: string, text: string): string | null {
  let digits = (schoolPhone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  const encoded = encodeURIComponent(text.trim())
    .replace(/[.!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return `https://wa.me/${digits}?text=${encoded}`
}

// Retorna os outros gatilhos ativos cujo texto contém ou está contido no
// texto informado — no "contém" do webhook, o mais longo vence, então o mais
// curto deixa de pegar mensagens do mais longo. Não bloqueia salvar, só avisa.
export function findOverlappingTriggers(text: string, others: CaptureTrigger[]): CaptureTrigger[] {
  const norm = normalizeCaptureText(text)
  if (norm.length < CAPTURE_TEXT_MIN) return []
  return others.filter(t => {
    if (!t.is_active || t.archived_at) return false
    const o = normalizeCaptureText(t.trigger_text)
    return o.includes(norm) || norm.includes(o)
  })
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = seconds / 60
  if (mins < 60) return `${Math.round(mins)} min`
  const hours = mins / 60
  if (hours < 24) return `${hours.toFixed(1).replace('.', ',')} h`
  return `${(hours / 24).toFixed(1).replace('.', ',')} d`
}
