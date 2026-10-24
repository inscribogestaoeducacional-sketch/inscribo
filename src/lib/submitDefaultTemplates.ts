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

// Super Admin: ao entrar, completa sozinho o que falta. Se algum modelo padrão ainda não
// foi mandado para alguma escola com WhatsApp ativo, manda só esse (o servidor confere na
// Meta antes e nunca duplica). Roda uma vez por sessão do navegador.
export async function syncMissingDefaultTemplates(): Promise<void> {
  try {
    if (sessionStorage.getItem('aion-tpl-sync') === '1') return
    sessionStorage.setItem('aion-tpl-sync', '1')
  } catch { /* segue sem trava */ }
  try {
    const [{ data: defs }, { data: phones }, { data: sts }] = await Promise.all([
      supabase.from('template_definitions').select('id').is('institution_id', null).eq('scope', 'all'),
      supabase.from('whatsapp_phone_numbers').select('institution_id').eq('is_active', true),
      supabase.from('template_institution_status').select('template_definition_id, institution_id'),
    ])
    const have = new Set(((sts || []) as any[]).map(r => `${r.template_definition_id}|${r.institution_id}`))
    const schools = [...new Set(((phones || []) as any[]).map(r => r.institution_id))]
    const missing = new Set<string>()
    for (const d of (defs || []) as any[]) for (const sc of schools) if (!have.has(`${d.id}|${sc}`)) missing.add(d.id)
    if (!missing.size) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch('/api/whatsapp/template-definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'submit', template_definition_ids: [...missing] }),
    })
    const data = await res.json().catch(() => ({}))
    console.log('[templates] sincronização automática:', res.status, (data.results || []).length)
  } catch (e) {
    console.error('[templates] sincronização automática falhou:', e)
  }
}
