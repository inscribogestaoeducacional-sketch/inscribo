// @ts-nocheck
// =============================================================================
// supabase/functions/overdue-payment-reminders/index.ts
// Roda diariamente (via pg_cron, ver instruções no fim deste arquivo). Para
// cada `payments` com status='overdue' que estiver EXATAMENTE em um dos 4
// marcos de dias configurados em platform_settings — overdue_warning1_days,
// overdue_warning2_days, overdue_warning3_days, overdue_suspend_days (os
// MESMOS campos editáveis na tela de Configurações, AdminSettings.tsx,
// default 3/7/15/20) — dispara um template de WhatsApp via
// api/whatsapp/send-template (o mesmo endpoint que o resto do projeto já usa
// pra enviar template — não um mecanismo de envio novo). O nome do template
// é montado dinamicamente como `cobranca_atraso_d{marco}`.
//
// ⚠️ NÃO ATIVAR EM PRODUÇÃO AINDA:
// 1) Os templates cobranca_atraso_d{N} (N = valor configurado em cada um dos
//    4 campos acima, ex: cobranca_atraso_d3 se overdue_warning1_days=3)
//    ainda NÃO existem e NÃO foram aprovados no Meta Business Manager.
//    `components` abaixo é um placeholder mínimo (só o nome da escola) —
//    precisa ser reescrito com os parâmetros reais do template aprovado
//    (valor em atraso, dias de atraso, link de pagamento, etc.).
// 2) Por segurança, a function só ENVIA de verdade se a config
//    `overdue_reminders_enabled` em platform_settings valer 'true'. Enquanto
//    isso não for setado, ela roda em modo "dry-run": loga o que enviaria e
//    NÃO grava em overdue_reminders_sent (pra não "queimar" o marco antes da
//    função estar pronta pra valer).
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fallback individual por campo — só usado se a chave estiver ausente/vazia/
// não-numérica/≤0 em platform_settings, nunca substitui um valor válido.
const DEFAULT_MILESTONES: Record<string, number> = {
  overdue_warning1_days: 3,
  overdue_warning2_days: 7,
  overdue_warning3_days: 15,
  overdue_suspend_days:  20,
}

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://app.aionedu.com.br'

// Lê os 4 marcos configuráveis de platform_settings, com fallback
// individual por campo. Nunca lança erro — sempre retorna 4 números > 0.
async function loadMilestones(sb: any): Promise<number[]> {
  const keys = Object.keys(DEFAULT_MILESTONES)
  const { data: rows } = await sb
    .from('platform_settings')
    .select('key, value')
    .in('key', keys)

  const byKey: Record<string, string> = {}
  for (const r of rows || []) byKey[r.key] = r.value

  const milestones = keys.map(k => {
    const raw = byKey[k]
    const parsed = raw != null && raw !== '' ? parseInt(raw, 10) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MILESTONES[k]
  })

  // Remove duplicatas (ex: dois campos configurados com o mesmo número de
  // dias) — cada marco só precisa ser checado uma vez por pagamento.
  return Array.from(new Set(milestones))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: enabledRow } = await sb
      .from('platform_settings')
      .select('value')
      .eq('key', 'overdue_reminders_enabled')
      .maybeSingle()
    const enabled = enabledRow?.value === 'true'

    const milestones = await loadMilestones(sb)

    const { data: overduePayments, error: fetchErr } = await sb
      .from('payments')
      .select('id, institution_id, amount, due_date, institutions(id, name, phone)')
      .eq('status', 'overdue')

    if (fetchErr) throw new Error(fetchErr.message)

    const today = new Date()
    let evaluated = 0, matched = 0, sent = 0, skippedAlreadySent = 0, dryRun = 0
    const errors: any[] = []

    for (const payment of overduePayments || []) {
      evaluated++
      if (!payment.due_date) continue

      const due = new Date(payment.due_date + 'T00:00:00')
      const daysLate = Math.floor((today.getTime() - due.getTime()) / 86400000)
      if (!milestones.includes(daysLate)) continue
      matched++

      const { data: already } = await sb
        .from('overdue_reminders_sent')
        .select('id')
        .eq('payment_id', payment.id)
        .eq('milestone', daysLate)
        .maybeSingle()
      if (already) { skippedAlreadySent++; continue }

      const inst = (payment as any).institutions
      const templateName = `cobranca_atraso_d${daysLate}`

      if (!enabled) {
        dryRun++
        console.log(`[overdue-payment-reminders] DRY-RUN — enviaria "${templateName}" para "${inst?.name}" (payment ${payment.id}, D+${daysLate}). Ative com platform_settings.overdue_reminders_enabled = 'true'.`)
        continue
      }

      if (!inst?.phone) {
        errors.push({ payment_id: payment.id, milestone: daysLate, error: 'Instituição sem telefone cadastrado' })
        continue
      }

      try {
        const to = '55' + String(inst.phone).replace(/\D/g, '')
        const res = await fetch(`${APP_BASE_URL}/api/whatsapp/send-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institution_id: inst.id,
            to,
            template_name: templateName,
            language: 'pt_BR',
            // TODO: placeholder mínimo — trocar pelos parâmetros reais do
            // template aprovado na Meta (valor em atraso, dias de atraso,
            // link de pagamento) quando cobranca_atraso_d{3,7,15,20}
            // existirem de verdade.
            components: [
              { type: 'body', parameters: [{ type: 'text', text: inst.name || '' }] },
            ],
          }),
        })
        const data = await res.json()
        if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`)

        await sb.from('overdue_reminders_sent').insert({ payment_id: payment.id, milestone: daysLate })
        sent++
      } catch (e) {
        errors.push({ payment_id: payment.id, milestone: daysLate, error: String(e) })
      }
    }

    console.log(`[overdue-payment-reminders] milestones=[${milestones.join(',')}] enabled=${enabled} evaluated=${evaluated} matched=${matched} sent=${sent} dryRun=${dryRun} skippedAlreadySent=${skippedAlreadySent} errors=${errors.length}`)

    return new Response(
      JSON.stringify({ ok: true, milestones, enabled, evaluated, matched, sent, dryRun, skippedAlreadySent, errors }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[overdue-payment-reminders] erro:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})

// =============================================================================
// AGENDAMENTO — este projeto já usa pg_cron + pg_net pra Edge Functions
// diárias/periódicas (ver supabase/migrations/bot_timeout_cron.sql e
// cron_notifications.sql), em vez de cron externo tipo Vercel Cron Jobs.
// Segui o mesmo padrão: o SQL de agendamento está em
// supabase/migrations/20260720001000_overdue_payment_reminders_cron.sql
// (mesmo tratamento dado a bot_timeout_cron.sql — arquivo pra rodar
// manualmente no SQL Editor do Supabase, não uma migration automática).
// =============================================================================
