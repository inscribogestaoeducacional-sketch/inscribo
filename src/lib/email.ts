import { supabase } from './supabase'

export type EmailType =
  | 'new_institution'
  | 'gestor_welcome'
  | 'payment_link'
  | 'monthly_payment'
  | 'contract_sign'
  | 'suspended'
  | 'reactivated'
  | 'overdue_1'
  | 'overdue_2'
  | 'overdue_3'
  | 'overdue_4'

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
