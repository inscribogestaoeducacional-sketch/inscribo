// Escola nova (ou WhatsApp recém-conectado): manda para a Meta todos os modelos padrão
// cadastrados em Templates Automáticos (visita, reativação, pesquisa de saída etc.),
// não só os dois antigos. Roda no servidor; erros só vão para o console para não
// travar a configuração do WhatsApp.
import { supabase } from './supabase'

export async function submitDefaultTemplates(institutionId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch('/api/whatsapp/template-definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'submit', institution_ids: [institutionId] }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) console.error('[templates] envio dos modelos padrão falhou:', data?.error)
    else console.log('[templates] modelos padrão enviados:', (data.results || []).length)
  } catch (e) {
    console.error('[templates] erro ao enviar modelos padrão:', e)
  }
}
