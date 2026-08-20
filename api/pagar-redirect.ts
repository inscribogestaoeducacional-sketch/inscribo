// api/pagar-redirect.ts
//
// Endpoint público (sem autenticação) por trás de /pagar/:codigo — ver regra
// de rewrite em vercel.json. Recebido no clique do botão do template de
// cobrança manual (AdminFinancial.tsx → "Enviar cobrança via WhatsApp"), que
// manda a Meta montar a URL como {base cadastrada}/{{4}}, onde {{4}} é o
// código curto gerado em manual_collection_sends.
//
// Usa a service role key de propósito: manual_collection_sends tem RLS
// restrita a super admin (ver migration 20260820000000), então o único jeito
// de resolver o redirect público é bypassando a RLS aqui — mas só devolvendo
// um 302 pro link real, nunca expondo o resto da linha (telefone, instituição
// etc.) pro visitante.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const INVALID_LINK_HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Link inválido</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #F9FAFB; color: #1A2B4A;
         min-height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 420px; text-align: center; background: #fff; border: 1px solid #E2E8F0; border-radius: 20px; padding: 40px 32px; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 14px; color: #64748B; margin: 0; line-height: 1.5; }
</style></head>
<body><div class="card">
  <h1>Link inválido ou expirado</h1>
  <p>Esse link de pagamento não foi encontrado. Entre em contato com a escola para receber um novo link.</p>
</div></body></html>`

// Escapa os caracteres especiais do LIKE/ILIKE (%, _, \) antes de usar o
// valor recebido como padrão do ilike() abaixo — sem isso, alguém acessando
// /pagar/% (ou com _ no meio) conseguiria fazer o ilike casar com qualquer
// linha da tabela em vez de comparar literalmente.
function escapeForIlike(s: string): string {
  return s.replace(/[\\%_]/g, m => '\\' + m)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const codigoParam = req.query.codigo
  const rawCodigo = Array.isArray(codigoParam) ? codigoParam[0] : codigoParam
  const codigo = (rawCodigo || '').trim()

  if (!codigo || !/^[A-Za-z0-9]+$/.test(codigo)) {
    console.log('[pagar-redirect] código ausente ou com caracteres inesperados:', JSON.stringify(rawCodigo))
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(INVALID_LINK_HTML)
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Bug 2 — causa raiz: o código era gerado com maiúsculas e minúsculas
  // misturadas, e algo no caminho até o clique (app/navegador do WhatsApp)
  // normaliza a URL pra minúsculas antes de chegar aqui, então uma comparação
  // exata (.eq) nunca batia. ilike (case-insensitive) resolve tanto os
  // códigos novos (gerados só em minúsculas, ver AdminFinancial.tsx) quanto
  // os que já foram enviados antes deste fix.
  const { data, error } = await supabase
    .from('manual_collection_sends')
    .select('codigo, payment_link_real')
    .ilike('codigo', escapeForIlike(codigo))
    .maybeSingle()

  console.log('[pagar-redirect] código recebido:', JSON.stringify(codigo), '| encontrado no banco:', JSON.stringify(data?.codigo ?? null), '| erro:', error?.message ?? null)

  if (!data?.payment_link_real) {
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(INVALID_LINK_HTML)
  }

  res.writeHead(302, { Location: data.payment_link_real })
  res.end()
}
