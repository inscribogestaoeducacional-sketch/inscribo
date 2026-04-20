// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AUTENTIQUE_KEY = Deno.env.get('AUTENTIQUE_API_KEY')
const AUTENTIQUE_URL = 'https://api.autentique.com.br/v2/graphql'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const {
      institution_id, contract_id,
      school_name, school_cnpj, school_address, school_city, school_state,
      signer_name, signer_email, signer_phone, signer_cpf, signer_role,
      monthly_value, implementation_value, contract_start_date,
    } = body

    if (!AUTENTIQUE_KEY) throw new Error('AUTENTIQUE_API_KEY não configurada')
    if (!signer_email || !signer_name) throw new Error('Nome e e-mail do signatário são obrigatórios')

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Buscar template e configurações
    const { data: cfg } = await sb.from('platform_settings').select('key, value')
      .in('key', ['contract_template_text', 'billing_due_day', 'platform_name', 'platform_cnpj', 'platform_address', 'platform_email'])
    const settings: Record<string, string> = {}
    for (const row of cfg || []) settings[row.key] = row.value

    // 2. Buscar dados da instituição
    const { data: inst } = await sb.from('institutions')
      .select('name, cnpj, city, state, email, address, phone')
      .eq('id', institution_id)
      .single()

    // 3. Substituir variáveis no template
    const fmtBRL = (n: number) => n?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
    const startDate = contract_start_date
      ? new Date(contract_start_date + 'T12:00:00').toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR')

    const vars: Record<string, string> = {
      escola:            inst?.name || school_name || '',
      cnpj:              inst?.cnpj || school_cnpj || '',
      endereco:          inst?.address || school_address || '',
      cidade_uf:         `${inst?.city || school_city || ''}/${inst?.state || school_state || ''}`,
      gestor:            signer_name,
      cargo_gestor:      signer_role || 'Diretor',
      cpf_gestor:        signer_cpf || '',
      email_gestor:      signer_email,
      telefone_gestor:   signer_phone || inst?.phone || '',
      valor_implantacao: implementation_value ? fmtBRL(Number(implementation_value)) : '',
      valor_mensal:      monthly_value ? fmtBRL(Number(monthly_value)) : '',
      dia_vencimento:    settings.billing_due_day || '10',
      data_inicio:       startDate,
      consultor:         'Equipe Áion Edu',
      data_hoje:         new Date().toLocaleDateString('pt-BR'),
      plataforma:        settings.platform_name || 'Áion Soluções Tecnológicas LTDA',
      cnpj_plataforma:   settings.platform_cnpj || '65.835.064/0001-58',
      endereco_plataforma: settings.platform_address || 'Patos/PB',
      email_plataforma:  settings.platform_email || 'contato@aionedu.com.br',
    }

    let contractText = settings.contract_template_text || ''
    contractText = contractText.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`)

    // 4. Montar HTML do contrato
    const isHtml = contractText.trim().startsWith('<')
    const htmlContent = isHtml
      ? contractText
      : `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;padding:40px;color:#222;white-space:pre-wrap;">${contractText.replace(/\n/g, '<br>')}</body></html>`

    // 5. Montar mutation GraphQL
    const mutation = `
      mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
        createDocument(document: $document, signers: $signers, file: $file) {
          id
          name
          signatures {
            public_id
            name
            email
            link { short_link }
          }
        }
      }
    `

    const encoder = new TextEncoder()
    const htmlBytes = encoder.encode(htmlContent)
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const enc = (s: string) => encoder.encode(s)

    const operations = JSON.stringify({
      query: mutation,
      variables: {
        document: { name: `Contrato — ${inst?.name || school_name}` },
        signers: [{ email: signer_email, name: signer_name, action: 'SIGN' }],
        file: null,
      },
    })

    const map = JSON.stringify({ '0': ['variables.file'] })

    const parts: Uint8Array[] = [
      enc(`--${boundary}\r\nContent-Disposition: form-data; name="operations"\r\n\r\n${operations}\r\n`),
      enc(`--${boundary}\r\nContent-Disposition: form-data; name="map"\r\n\r\n${map}\r\n`),
      enc(`--${boundary}\r\nContent-Disposition: form-data; name="0"; filename="contrato.html"\r\nContent-Type: text/html\r\n\r\n`),
      htmlBytes,
      enc(`\r\n--${boundary}--\r\n`),
    ]

    const totalLength = parts.reduce((s, p) => s + p.length, 0)
    const bodyBytes = new Uint8Array(totalLength)
    let offset = 0
    for (const part of parts) { bodyBytes.set(part, offset); offset += part.length }

    // 6. Chamar API Autentique
    const autRes = await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTENTIQUE_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBytes,
    })

    const autData = await autRes.json()
    console.log('[autentique] response:', JSON.stringify(autData))

    if (autData.errors) throw new Error(autData.errors[0]?.message || 'Erro na Autentique')

    const document = autData.data?.createDocument
    const documentId = document?.id

    // 7. Buscar link de assinatura (segunda chamada pois vem null na criação)
    let signUrl: string | null = null

    if (documentId) {
      await new Promise(r => setTimeout(r, 3000))

      const fetchQuery = `
        query {
          document(id: "${documentId}") {
            id
            signatures {
              public_id
              name
              email
              link { short_link }
            }
          }
        }
      `

      const fetchRes = await fetch(AUTENTIQUE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTENTIQUE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: fetchQuery }),
      })

      const fetchData = await fetchRes.json()
      console.log('[autentique] fetch signatures:', JSON.stringify(fetchData))

      const sigs = fetchData?.data?.document?.signatures || []
      const signerSig = sigs.find((s: any) =>
        s.email === signer_email
      ) || sigs.find((s: any) =>
        s.email !== 'contato@aionedu.com.br'
      ) || sigs[sigs.length - 1]

      signUrl = signerSig?.link?.short_link || null
      console.log('[autentique] signUrl:', signUrl)
    }

    // 8. Salvar no banco
    const contractData = {
      status: 'sent',
      sign_url: signUrl,
      autentique_document_id: documentId,
      signer_name,
      signer_email,
    }

    if (contract_id) {
      await sb.from('contracts').update(contractData).eq('id', contract_id)
    } else if (institution_id) {
      await sb.from('contracts').insert({
        institution_id,
        ...contractData,
        plan: 'escola',
        monthly_value: monthly_value || 0,
      })
    }

    if (institution_id) {
      await sb.from('institutions')
        .update({ plan_status: 'pending_contract' })
        .eq('id', institution_id)
    }

    // 9. Notificação para admin
    await sb.from('system_notifications').insert({
      institution_id: null,
      title: `Contrato enviado — ${inst?.name || school_name}`,
      message: `Contrato enviado para assinatura de ${signer_name} (${signer_email}).`,
      type: 'info',
      read: false,
    })

    return new Response(
      JSON.stringify({ ok: true, signUrl, documentId }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[autentique] erro:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: CORS }
    )
  }
})
