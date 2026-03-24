import { supabase } from './supabase'

export const sendEmail = async (
  type: 'welcome' | 'campaign_ready',
  to: string,
  data: Record<string, any>
): Promise<boolean> => {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { type, to, data }
    })
    if (error) console.error('[Email]', error)
    return !error
  } catch (err) {
    console.error('[Email] Erro:', err)
    return false
  }
}
