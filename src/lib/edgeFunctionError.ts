// supabase.functions.invoke devolve em error.message só "Edge Function
// returned a non-2xx status code" — a mensagem de verdade (ex.: o motivo do
// Asaas ter recusado a cobrança) vem no corpo da resposta, em error.context.
export async function edgeFunctionErrorMessage(error: any, fallback = 'Erro inesperado'): Promise<string> {
  try {
    const body = await error?.context?.json?.()
    if (body?.error) return String(body.error).replace(/^Error:\s*/, '')
  } catch { /* corpo não-JSON: usa a mensagem genérica */ }
  return error?.message || fallback
}
