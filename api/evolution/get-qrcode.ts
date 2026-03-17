import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  EVOLUTION_URL,
  evolutionHeaders,
  getSupabaseAdmin,
  getInstanceForInstitution,
  APP_URL,
  errorResponse,
} from './_config.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const institutionId = (req.query.institutionId || req.body?.institutionId) as string | undefined

  if (!institutionId) {
    return errorResponse(res, 400, 'institutionId required')
  }

  try {
    const supabase = getSupabaseAdmin()

    // Look up (or derive) the evolution instance name for this institution
    let instanceName = await getInstanceForInstitution(institutionId)

    if (!instanceName) {
      // Create a new instance name and persist it
      instanceName = `inst_${institutionId.replace(/-/g, '').slice(0, 16)}`
      await supabase
        .from('institutions')
        .update({ evolution_instance: instanceName } as never)
        .eq('id', institutionId)
    }

    // ── Check current connection state ───────────────────────────────────────
    const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
      headers: evolutionHeaders(),
      signal: AbortSignal.timeout(8000),
    })

    if (stateRes.ok) {
      const stateData = await stateRes.json()
      const state = stateData?.instance?.state || stateData?.state || ''
      if (state === 'open') {
        return res.json({ connected: true, instanceName })
      }
    }

    // ── Try to connect / get QR ──────────────────────────────────────────────
    const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
      headers: evolutionHeaders(),
      signal: AbortSignal.timeout(10000),
    })

    if (!connectRes.ok) {
      // Instance may not exist yet — create it first
      const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: evolutionHeaders(),
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (!createRes.ok) {
        const err = await createRes.text().catch(() => '')
        console.error('[get-qrcode] create instance failed:', createRes.status, err.slice(0, 300))
        return errorResponse(res, 502, 'Failed to create Evolution instance')
      }

      // Register webhook with stable APP_URL
      if (APP_URL) {
        const webhookUrl = `${APP_URL}/api/evolution/webhook?institution_id=${institutionId}`
        await fetch(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhookByEvents: false,
              webhookBase64: false,
              events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
            },
          }),
          signal: AbortSignal.timeout(10000),
        }).catch(e => console.warn('[get-qrcode] webhook set error:', e))
      }

      // Now connect again
      const connectRes2 = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
        headers: evolutionHeaders(),
        signal: AbortSignal.timeout(10000),
      })
      const data2 = await connectRes2.json()
      return res.json({ ...data2, instanceName })
    }

    const data = await connectRes.json()
    return res.json({ ...data, instanceName })
  } catch (err) {
    console.error('[get-qrcode] error:', err)
    return errorResponse(res, 500, (err as Error).message || 'Internal error')
  }
}
