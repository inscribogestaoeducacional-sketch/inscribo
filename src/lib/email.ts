import { supabase } from './supabase'

export type EmailType =
  | 'welcome'
  | 'campaign_ready'
  | 'new_institution'
  | 'user_welcome'
  | 'password_reset'

export const sendEmail = async (
  type: EmailType,
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
