// @ts-nocheck
// =============================================================================
// supabase/functions/asaas-cancel-charge/index.ts
// Corrige o bug encontrado na investigação read-only anterior: AdminFinancial.tsx
// (handlePaymentAction, ação 'cancel') já chamava esta function via
// supabase.functions.invoke('asaas-cancel-charge', ...), mas ela nunca existiu
// no projeto — o erro era engolido por um try/catch vazio no frontend, e o
// pagamento era marcado 'cancelled' localmente mesmo sem cancelar de fato no
// Asaas. Este arquivo cria a function; o frontend foi corrigido separadamente
// para só marcar como cancelado se esta function confirmar sucesso.
//
// Segue o mesmo padrão de leitura de configuração (platform_settings) e
// montagem de URL sandbox/produção usado em asaas-create-charge/index.ts.
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { payment_id } = body // asaas_payment_id (ID da cobrança no Asaas, não o payments.id local)

    if (!payment_id) throw new Error('payment_id é obrigatório')

    // 1. Buscar configurações do Asaas (mesmo padrão de asaas-create-charge)
    const { data: cfgData } = await sb.from('platform_settings')
      .select('key, value')
      .in('key', ['asaas_api_key', 'asaas_environment'])
    const cfg: Record<string, string> = {}
    cfgData?.forEach((r: any) => { cfg[r.key] = r.value })

    const apiKey = cfg.asaas_api_key || Deno.env.get('ASAAS_API_KEY') || ''
    if (!apiKey) throw new Error('Chave Asaas não configurada. Acesse Configurações → Asaas.')

    const ASAAS_URL = (cfg.asaas_environment || 'production') === 'sandbox'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3'

    // 2. Cancelar a cobrança no Asaas
    const cancelRes = await fetch(`${ASAAS_URL}/payments/${payment_id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
    })

    const result = await cancelRes.json()
    console.log('[asaas-cancel-charge] resultado:', JSON.stringify(result))

    if (!cancelRes.ok) {
      throw new Error(result?.errors?.[0]?.description || 'Erro ao cancelar cobrança no Asaas')
    }

    if (result?.deleted !== true) {
      throw new Error('Asaas não confirmou o cancelamento da cobrança.')
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[asaas-cancel-charge] erro:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
