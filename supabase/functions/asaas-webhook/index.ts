// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
}

// Comparação em tempo constante — evita timing attack na validação do token
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Asaas não usa HMAC de payload: a autenticação do webhook é feita via um token
// estático configurado no painel Asaas (Integrações > Webhooks > "Token de autenticação"),
// que a Asaas ecoa de volta no header `asaas-access-token` em toda chamada.
async function isValidAsaasRequest(req: Request, sb: ReturnType<typeof createClient>): Promise<boolean> {
  const incomingToken = req.headers.get('asaas-access-token') || ''
  if (!incomingToken) return false

  const { data } = await sb
    .from('platform_settings')
    .select('value')
    .eq('key', 'asaas_webhook_token')
    .maybeSingle()

  const expectedToken = data?.value || Deno.env.get('ASAAS_WEBHOOK_TOKEN') || ''
  if (!expectedToken) {
    console.error('[asaas-webhook] asaas_webhook_token/ASAAS_WEBHOOK_TOKEN não configurado — rejeitando por segurança')
    return false
  }

  return timingSafeEqual(incomingToken, expectedToken)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (!(await isValidAsaasRequest(req, sb))) {
      console.error('[asaas-webhook] token inválido ou ausente — requisição rejeitada')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    console.log('[asaas-webhook] payload:', JSON.stringify(body))

    const { event, payment } = body

    if (!payment?.externalReference) {
      console.log('[asaas-webhook] sem externalReference, ignorando')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // externalReference = "institution_id:payment_id" ou apenas "institution_id"
    const parts = payment.externalReference.split(':')
    const institutionId = parts[0]
    const paymentId = parts[1] || null

    console.log(`[asaas-webhook] event=${event} institution=${institutionId} payment=${paymentId}`)

    // ── PAYMENT_RECEIVED / PAYMENT_CONFIRMED ──────────────────────────────────
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {

      // 1. Atualiza o registro na tabela payments
      if (paymentId) {
        await sb.from('payments')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            asaas_payment_id: payment.id,
          })
          .eq('id', paymentId)

        console.log('[asaas-webhook] payment atualizado:', paymentId)
      } else {
        // Tenta encontrar pelo asaas_payment_id
        await sb.from('payments')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('asaas_payment_id', payment.id)
      }

      // 2. Busca o pagamento para saber o tipo
      const { data: pmt } = paymentId
        ? await sb.from('payments').select('*').eq('id', paymentId).single()
        : await sb.from('payments').select('*').eq('asaas_payment_id', payment.id).single()

      // 2b. Nota Fiscal — cria a linha de controle em payment_invoices assim
      // que o pagamento é confirmado, se ainda não existir uma pra esse
      // payment_id. Idempotente (webhook da Asaas pode repetir o evento) e
      // também cobre o caso em que a escola emite nota ANTES do pagamento
      // (nf_issue_timing='before_payment'): nesse caso a linha já foi criada
      // na criação da cobrança (asaas-create-charge/asaas-generate-monthly)
      // e este insert vira no-op.
      if (pmt?.id) {
        await createPendingInvoice(sb, pmt.id, institutionId, pmt.amount)
      }

      if (pmt?.payment_type === 'implementation') {
        // 3a. Implantação paga → ativa a instituição e gera mensalidades
        await sb.from('institutions')
          .update({ plan_status: 'active' })
          .eq('id', institutionId)

        console.log('[asaas-webhook] instituição ativada:', institutionId)

        // 4. Gera mensalidades dos próximos 12 meses
        await generateMonthlyPayments(sb, institutionId, payment)

        // 5. Envia email de boas-vindas
        const { data: inst } = await sb.from('institutions')
          .select('name, email')
          .eq('id', institutionId)
          .single()

        if (inst?.email) {
          await sb.functions.invoke('send-email', {
            body: {
              type: 'new_institution',
              to: inst.email,
              data: {
                institution_name: inst.name,
                login_url: 'https://app.aionedu.com.br/login',
              },
            },
          })
          console.log('[asaas-webhook] email boas-vindas enviado para:', inst.email)
        }

        // 6. Notificação admin
        await sb.from('system_notifications').insert({
          institution_id: institutionId,
          title: `Implantação paga — ${inst?.name || institutionId}`,
          message: `Pagamento da implantação confirmado. Escola ativada automaticamente.`,
          type: 'success',
          read: false,
        })

      } else if (pmt?.payment_type === 'monthly') {
        // 3b. Mensalidade paga → verifica inadimplência
        const { data: overdue } = await sb.from('payments')
          .select('id')
          .eq('institution_id', institutionId)
          .eq('payment_type', 'monthly')
          .in('status', ['overdue', 'pending'])
          .lt('due_date', new Date().toISOString().split('T')[0])

        // Se não há mais pendências → reativa se estava suspensa
        const { data: inst } = await sb.from('institutions')
          .select('name, email, plan_status')
          .eq('id', institutionId)
          .single()

        if (inst?.plan_status === 'suspended' && (!overdue || overdue.length === 0)) {
          await sb.from('institutions')
            .update({ plan_status: 'active' })
            .eq('id', institutionId)

          if (inst?.email) {
            await sb.functions.invoke('send-email', {
              body: {
                type: 'reactivated',
                to: inst.email,
                data: {
                  institution_name: inst.name,
                  link_acesso: 'https://app.aionedu.com.br/login',
                },
              },
            })
          }

          await sb.from('system_notifications').insert({
            institution_id: institutionId,
            title: `Mensalidade paga — ${inst?.name}`,
            message: `Mensalidade confirmada. Acesso reativado automaticamente.`,
            type: 'success',
            read: false,
          })
        }
      }
    }

    // ── PAYMENT_OVERDUE ───────────────────────────────────────────────────────
    if (event === 'PAYMENT_OVERDUE') {
      if (paymentId) {
        await sb.from('payments')
          .update({ status: 'overdue' })
          .eq('id', paymentId)
      } else {
        await sb.from('payments')
          .update({ status: 'overdue' })
          .eq('asaas_payment_id', payment.id)
      }

      // Conta quantos dias de atraso
      const diasAtraso = payment.daysOverdue || 1

      const { data: inst } = await sb.from('institutions')
        .select('name, email, plan_status')
        .eq('id', institutionId)
        .single()

      // Suspende se >30 dias de atraso
      if (diasAtraso >= 30 && inst?.plan_status === 'active') {
        await sb.from('institutions')
          .update({ plan_status: 'suspended' })
          .eq('id', institutionId)

        if (inst?.email) {
          await sb.functions.invoke('send-email', {
            body: {
              type: 'suspended',
              to: inst.email,
              data: {
                institution_name: inst.name,
                dias_atraso: String(diasAtraso),
              },
            },
          })
        }

        await sb.from('system_notifications').insert({
          institution_id: institutionId,
          title: `Escola suspensa — ${inst?.name}`,
          message: `Acesso suspenso por ${diasAtraso} dias de inadimplência.`,
          type: 'warning',
          read: false,
        })
      }

      console.log('[asaas-webhook] pagamento em atraso:', payment.id, 'dias:', diasAtraso)
    }

    // ── PAYMENT_DELETED / PAYMENT_RESTORED ───────────────────────────────────
    if (event === 'PAYMENT_DELETED') {
      if (paymentId) {
        await sb.from('payments').update({ status: 'cancelled' }).eq('id', paymentId)
      } else {
        await sb.from('payments').update({ status: 'cancelled' }).eq('asaas_payment_id', payment.id)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[asaas-webhook] erro:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS
    })
  }
})

// ─── Nota Fiscal — cria a linha 'pending' em payment_invoices, se ainda não existir ──
async function createPendingInvoice(sb: any, paymentId: string, institutionId: string, amount: number) {
  try {
    const { data: existing } = await sb.from('payment_invoices').select('id').eq('payment_id', paymentId).maybeSingle()
    if (existing) return

    const { data: inst } = await sb.from('institutions').select('name, nf_issue_timing').eq('id', institutionId).single()
    const issueTiming = inst?.nf_issue_timing || 'after_payment'

    const { error } = await sb.from('payment_invoices').insert({
      payment_id: paymentId,
      institution_id: institutionId,
      status: 'pending',
      issue_timing: issueTiming,
    })
    if (error) { console.error('[asaas-webhook] erro ao criar payment_invoices:', error); return }
    console.log('[asaas-webhook] payment_invoices criado (pending) para payment:', paymentId)

    // Notifica o sino do admin_geral. Só roda neste ponto — o `existing`
    // checado acima já garante que isso dispara no máximo 1x por payment_id
    // (a linha só é criada uma vez, o UNIQUE(payment_id) impede duplicata).
    await notifyNfPending(sb, inst?.name, amount)
  } catch (e) {
    console.error('[asaas-webhook] erro em createPendingInvoice:', String(e))
  }
}

// ─── Notifica o sino do admin_geral (institution_id IS NULL, ver
// SuperAdminLayout.tsx:loadNotifications) sobre uma nova nota fiscal
// pendente. Reaproveitada pelo caminho after_payment (acima). O caminho
// before_payment tem a mesma função em nf-pending-check/index.ts. ──
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
    if (error) console.error('[asaas-webhook] erro ao notificar nf_pending:', error)
  } catch (e) {
    console.error('[asaas-webhook] erro ao notificar nf_pending:', String(e))
  }
}

// ─── Gera mensalidades dos próximos 12 meses ─────────────────────────────────
async function generateMonthlyPayments(sb: any, institutionId: string, payment: any) {
  try {
    const { data: inst } = await sb.from('institutions')
      .select('monthly_value, billing_due_day, name')
      .eq('id', institutionId)
      .single()

    if (!inst?.monthly_value) {
      console.log('[asaas-webhook] sem monthly_value, pulando geração de mensalidades')
      return
    }

    // Verifica se já existem mensalidades geradas
    const { data: existing } = await sb.from('payments')
      .select('id')
      .eq('institution_id', institutionId)
      .eq('payment_type', 'monthly')
      .limit(1)

    if (existing && existing.length > 0) {
      console.log('[asaas-webhook] mensalidades já existem, pulando')
      return
    }

    const dueDay = inst.billing_due_day || 10
    const monthlyValue = Number(inst.monthly_value)
    const now = new Date()

    const records = []
    for (let i = 1; i <= 12; i++) {
      const dueDate = new Date(now.getFullYear(), now.getMonth() + i, dueDay)
      const dueDateStr = dueDate.toISOString().split('T')[0]

      records.push({
        institution_id: institutionId,
        payment_type: 'monthly',
        amount: monthlyValue,
        status: 'pending',
        due_date: dueDateStr,
        description: `Mensalidade ${dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Fortaleza' })}`,
      })
    }

    const { error } = await sb.from('payments').insert(records)
    if (error) {
      console.error('[asaas-webhook] erro ao inserir mensalidades:', error)
    } else {
      console.log(`[asaas-webhook] ${records.length} mensalidades geradas para ${institutionId}`)
    }
  } catch (e) {
    console.error('[asaas-webhook] erro em generateMonthlyPayments:', String(e))
  }
}
