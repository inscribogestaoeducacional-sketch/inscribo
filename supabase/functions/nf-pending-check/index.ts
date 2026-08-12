// @ts-nocheck
// =============================================================================
// supabase/functions/nf-pending-check/index.ts
// Roda 1x/dia via pg_cron (ver supabase/migrations/20260812000400_nf_pending_check_cron.sql).
//
// Cuida só do caso nf_issue_timing='before_payment': escolas que emitem a
// nota fiscal ANTES do pagamento. A criação da linha payment_invoices pra
// esse caso já foi tentada no momento em que a cobrança nasce
// (asaas-create-charge/asaas-generate-monthly) e foi revertida — as 12
// mensalidades da ativação são geradas de uma vez só na ativação da escola,
// então isso criava 12 pendências de nota simultâneas no dia 0, o que não
// faz sentido nenhum (a escola não vai emitir nota de uma cobrança que só
// vence daqui 11 meses).
//
// Em vez disso, todo dia esta function verifica quais cobranças 'pending'
// têm due_date dentro dos próximos NF_UPCOMING_DAYS dias E pertencem a uma
// escola 'before_payment' E ainda não têm linha em payment_invoices — só aí
// cria a linha 'pending', perto o suficiente do vencimento pra fazer sentido
// a escola emitir a nota agora.
//
// O caso 'after_payment' (a maioria das escolas, default) não passa por
// aqui — continua sendo criado só na confirmação do pagamento, dentro do
// webhook da Asaas (asaas-webhook/index.ts, evento PAYMENT_RECEIVED/
// PAYMENT_CONFIRMED, função createPendingInvoice). Esta function não mexe
// nesse caminho.
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Quantos dias de antecedência do vencimento contam como "perto o
// suficiente" pra criar a pendência de nota fiscal. Único lugar a ajustar
// se o número de dias precisar mudar.
const NF_UPCOMING_DAYS = 5

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const limitDate = new Date(today)
    limitDate.setDate(limitDate.getDate() + NF_UPCOMING_DAYS)
    const limitDateStr = limitDate.toISOString().split('T')[0]

    // 1. Escolas que emitem nota ANTES do pagamento.
    const { data: institutions, error: instErr } = await sb
      .from('institutions')
      .select('id')
      .eq('nf_issue_timing', 'before_payment')
    if (instErr) throw new Error(instErr.message)

    const institutionIds = (institutions || []).map((i: any) => i.id)
    if (institutionIds.length === 0) {
      console.log('[nf-pending-check] nenhuma escola com nf_issue_timing=before_payment — nada a fazer')
      return new Response(
        JSON.stringify({ ok: true, upcomingDays: NF_UPCOMING_DAYS, evaluated: 0, created: 0, skippedExisting: 0, errors: [] }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Cobranças pendentes dessas escolas, vencendo dentro da janela.
    const { data: payments, error: fetchErr } = await sb
      .from('payments')
      .select('id, institution_id, due_date, amount, institutions(name)')
      .eq('status', 'pending')
      .in('institution_id', institutionIds)
      .gte('due_date', todayStr)
      .lte('due_date', limitDateStr)
    if (fetchErr) throw new Error(fetchErr.message)

    // payment_id -> dados pro texto da notificação (evita re-buscar depois).
    const paymentInfoById = new Map<string, { amount: number; institutionName: string }>(
      (payments || []).map((p: any) => [p.id, { amount: p.amount, institutionName: p.institutions?.name || 'Escola' }])
    )

    const evaluated = payments?.length || 0
    if (evaluated === 0) {
      return new Response(
        JSON.stringify({ ok: true, upcomingDays: NF_UPCOMING_DAYS, evaluated: 0, created: 0, skippedExisting: 0, errors: [] }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Quais dessas cobranças já têm linha em payment_invoices (idempotência
    // — o cron roda todo dia, então a maioria já vai ter sido criada em dias
    // anteriores dentro da mesma janela de N dias).
    const candidateIds = payments!.map((p: any) => p.id)
    const { data: existingRows, error: existErr } = await sb
      .from('payment_invoices')
      .select('payment_id')
      .in('payment_id', candidateIds)
    if (existErr) throw new Error(existErr.message)

    const existingIds = new Set((existingRows || []).map((r: any) => r.payment_id))
    const toInsert = payments!
      .filter((p: any) => !existingIds.has(p.id))
      .map((p: any) => ({
        payment_id: p.id,
        institution_id: p.institution_id,
        status: 'pending',
        issue_timing: 'before_payment',
      }))

    let created = 0
    const errors: any[] = []

    if (toInsert.length > 0) {
      const { data: insData, error: insErr } = await sb.from('payment_invoices').insert(toInsert).select('id')
      if (insErr) {
        // Insert em lote falhou — provável corrida rara com o webhook (ex.:
        // pagamento confirmado entre o SELECT acima e este INSERT, colidindo
        // no UNIQUE(payment_id)). Cai pra um-a-um pra não perder as linhas
        // que não colidiram.
        console.error('[nf-pending-check] insert em lote falhou, tentando um a um:', insErr.message)
        for (const row of toInsert) {
          const { error: rowErr } = await sb.from('payment_invoices').insert(row)
          if (rowErr) { errors.push({ payment_id: row.payment_id, error: rowErr.message }); continue }
          created++
          const info = paymentInfoById.get(row.payment_id)
          await notifyNfPending(sb, info?.institutionName, info?.amount ?? 0)
        }
      } else {
        // Insert em lote é atômico (tudo-ou-nada) — se chegou aqui sem erro,
        // toda linha de `toInsert` foi criada de verdade, então dá pra
        // notificar direto a partir dela (sem precisar reler `insData`, que
        // só tem `id`, não `payment_id`).
        created = insData?.length ?? toInsert.length
        for (const row of toInsert) {
          const info = paymentInfoById.get(row.payment_id)
          await notifyNfPending(sb, info?.institutionName, info?.amount ?? 0)
        }
      }
    }

    const skippedExisting = evaluated - toInsert.length

    console.log(`[nf-pending-check] upcomingDays=${NF_UPCOMING_DAYS} evaluated=${evaluated} created=${created} skippedExisting=${skippedExisting} errors=${errors.length}`)

    return new Response(
      JSON.stringify({ ok: true, upcomingDays: NF_UPCOMING_DAYS, evaluated, created, skippedExisting, errors }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[nf-pending-check] erro:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})

// ─── Notifica o sino do admin_geral (institution_id IS NULL, ver
// SuperAdminLayout.tsx:loadNotifications) sobre uma nova nota fiscal
// pendente. Mesma função (duplicada de propósito, cada Edge Function é
// isolada) usada pelo caminho after_payment em asaas-webhook/index.ts. ──
async function notifyNfPending(sb: any, institutionName: string | undefined, amount: number) {
  try {
    const amountFmt = Number(amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const { error } = await sb.from('system_notifications').insert({
      institution_id: null,
      type: 'nf_pending',
      title: 'Nova nota fiscal pendente',
      message: `Nova nota fiscal pendente: ${institutionName || 'Escola'} - R$ ${amountFmt}`,
      severity: 'warning',
      action_url: '/super-admin/financial',
      read: false,
      created_at: new Date().toISOString(),
    })
    if (error) console.error('[nf-pending-check] erro ao notificar nf_pending:', error)
  } catch (e) {
    console.error('[nf-pending-check] erro ao notificar nf_pending:', String(e))
  }
}

// =============================================================================
// AGENDAMENTO — ver supabase/migrations/20260812000400_nf_pending_check_cron.sql
// (mesmo padrão pg_cron + pg_net já usado por overdue-payment-reminders,
// bot_timeout_cron, etc. — arquivo pra rodar manualmente no SQL Editor do
// Supabase, não uma migration automática).
// =============================================================================
