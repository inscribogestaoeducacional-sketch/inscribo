// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Webhook externo — não valida JWT do Supabase
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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
        description: `Mensalidade ${dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
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
