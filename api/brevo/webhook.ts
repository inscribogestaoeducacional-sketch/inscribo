import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const events = Array.isArray(req.body) ? req.body : [req.body]

    for (const event of events) {
      const eventType: string = event.event || ''
      const proposalId: string | undefined = event.params?.proposal_id

      if (!proposalId) continue

      if (eventType === 'delivered') {
        await supabase
          .from('proposals')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', proposalId)
          .in('status', ['sent', 'draft'])
      } else if (eventType === 'opened') {
        await supabase
          .from('proposals')
          .update({ status: 'opened', opened_email_at: new Date().toISOString() })
          .eq('id', proposalId)
          .in('status', ['sent', 'delivered'])
      }
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[brevo/webhook]', err)
    return res.status(500).json({ error: String(err) })
  }
}
