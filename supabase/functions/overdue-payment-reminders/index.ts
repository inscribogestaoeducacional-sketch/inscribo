// @ts-nocheck
// =============================================================================
// supabase/functions/overdue-payment-reminders/index.ts
// Roda diariamente (via pg_cron, ver instruções no fim deste arquivo). Para
// cada `payments` com status='overdue' que estiver EXATAMENTE em um dos 4
// marcos de dias configurados em platform_settings — overdue_warning1_days,
// overdue_warning2_days, overdue_warning3_days, overdue_suspend_days (os
// MESMOS campos editáveis na tela de Configurações, AdminSettings.tsx,
// default 3/7/15/20) — dispara um e-mail via `send-email` (Brevo, mesma
// Edge Function já usada pelo resto do projeto) usando os templates
// overdue_1/2/3/4, e grava um alerta em `system_notifications` pro gestor
// da escola ver no painel.
//
// Substituiu o envio por WhatsApp (que dependia de templates Meta ainda não
// aprovados) — e-mail não tem esse bloqueio, os 4 templates já existem em
// supabase/functions/send-email/index.ts e são customizáveis em
// AdminSettings.tsx (seção de templates de e-mail).
//
// ⚠️ Por segurança, a function só ENVIA de verdade se a config
// `overdue_reminders_enabled` em platform_settings valer 'true'. Enquanto
// isso não for setado, ela roda em modo "dry-run": loga o que enviaria e
// NÃO grava em overdue_reminders_sent nem em system_notifications (pra não
// "queimar" o marco antes de alguém revisar o texto dos templates/os prazos
// configurados). Ative só depois de conferir os 4 templates em
// Configurações → Templates de e-mail.
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fallback individual por campo — só usado se a chave estiver ausente/vazia/
// não-numérica/≤0 em platform_settings, nunca substitui um valor válido.
// A ordem aqui também define a prioridade de desempate quando dois campos
// têm o mesmo número de dias (ver loadMilestones).
const MILESTONE_TEMPLATES: { key: string; template: string; fallbackDays: number }[] = [
  { key: 'overdue_warning1_days', template: 'overdue_1', fallbackDays: 3 },
  { key: 'overdue_warning2_days', template: 'overdue_2', fallbackDays: 7 },
  { key: 'overdue_warning3_days', template: 'overdue_3', fallbackDays: 15 },
  { key: 'overdue_suspend_days',  template: 'overdue_4', fallbackDays: 20 },
]

// Lê os 4 marcos configuráveis de platform_settings, com fallback
// individual por campo. Nunca lança erro. Retorna Map<dias, template>,
// mantendo o template do PRIMEIRO campo (warning1 > warning2 > warning3 >
// suspend) caso dois campos configurados colidam no mesmo número de dias.
async function loadMilestoneTemplates(sb: any): Promise<Map<number, string>> {
  const keys = MILESTONE_TEMPLATES.map(m => m.key)
  const { data: rows } = await sb
    .from('platform_settings')
    .select('key, value')
    .in('key', keys)

  const byKey: Record<string, string> = {}
  for (const r of rows || []) byKey[r.key] = r.value

  const map = new Map<number, string>()
  for (const m of MILESTONE_TEMPLATES) {
    const raw = byKey[m.key]
    const parsed = raw != null && raw !== '' ? parseInt(raw, 10) : NaN
    const days = Number.isFinite(parsed) && parsed > 0 ? parsed : m.fallbackDays
    if (!map.has(days)) map.set(days, m.template)
  }
  return map
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

    const milestoneTemplates = await loadMilestoneTemplates(sb)
    const milestones = Array.from(milestoneTemplates.keys())

    const { data: overduePayments, error: fetchErr } = await sb
      .from('payments')
      .select('id, institution_id, amount, due_date, asaas_charge_url, institutions(id, name, email)')
      .eq('status', 'overdue')

    if (fetchErr) throw new Error(fetchErr.message)

    const today = new Date()
    let evaluated = 0, matched = 0, sent = 0, notified = 0, skippedAlreadySent = 0, dryRun = 0
    const errors: any[] = []

    for (const payment of overduePayments || []) {
      evaluated++
      if (!payment.due_date) continue

      const due = new Date(payment.due_date + 'T00:00:00')
      const daysLate = Math.floor((today.getTime() - due.getTime()) / 86400000)
      const templateName = milestoneTemplates.get(daysLate)
      if (!templateName) continue
      matched++

      const { data: already } = await sb
        .from('overdue_reminders_sent')
        .select('id')
        .eq('payment_id', payment.id)
        .eq('milestone', daysLate)
        .maybeSingle()
      if (already) { skippedAlreadySent++; continue }

      const inst = (payment as any).institutions

      if (!enabled) {
        dryRun++
        console.log(`[overdue-payment-reminders] DRY-RUN — enviaria e-mail "${templateName}" para "${inst?.email}" (escola ${inst?.name}, payment ${payment.id}, D+${daysLate}). Ative com platform_settings.overdue_reminders_enabled = 'true'.`)
        continue
      }

      if (!inst?.email) {
        errors.push({ payment_id: payment.id, milestone: daysLate, error: 'Instituição sem e-mail cadastrado' })
        continue
      }

      try {
        const { data: emailResult, error: emailError } = await sb.functions.invoke('send-email', {
          body: {
            type: templateName,
            to: inst.email,
            data: {
              institution_name: inst.name,
              dias_atraso: String(daysLate),
              payment_link: payment.asaas_charge_url || null,
            },
          },
        })
        if (emailError || emailResult?.error) {
          throw new Error(emailResult?.error || emailError?.message || 'Erro ao enviar e-mail')
        }

        await sb.from('overdue_reminders_sent').insert({ payment_id: payment.id, milestone: daysLate })
        sent++

        // Alerta pro gestor ver no painel (banner + sino) — best-effort: se
        // isso falhar, o e-mail já foi enviado e o marco já foi registrado,
        // não desfaz nem repete o envio.
        try {
          const amount = Number(payment.amount || 0)
          const amountFmt = amount > 0 ? ` — R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
          const { error: notifError } = await sb.from('system_notifications').insert({
            institution_id: inst.id,
            type: 'overdue_reminder',
            title: 'Mensalidade em atraso',
            message: `Mensalidade com ${daysLate} dias de atraso${amountFmt}. Regularize para evitar a suspensão do acesso.`,
            severity: 'warning',
            action_url: '/settings',
            created_at: new Date().toISOString(),
          })
          if (notifError) throw notifError
          notified++
        } catch (notifErr) {
          console.error(`[overdue-payment-reminders] falha ao gravar system_notifications (payment ${payment.id}):`, String(notifErr))
        }
      } catch (e) {
        errors.push({ payment_id: payment.id, milestone: daysLate, error: String(e) })
      }
    }

    console.log(`[overdue-payment-reminders] milestones=[${milestones.join(',')}] enabled=${enabled} evaluated=${evaluated} matched=${matched} sent=${sent} notified=${notified} dryRun=${dryRun} skippedAlreadySent=${skippedAlreadySent} errors=${errors.length}`)

    return new Response(
      JSON.stringify({ ok: true, milestones, enabled, evaluated, matched, sent, notified, dryRun, skippedAlreadySent, errors }),
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
