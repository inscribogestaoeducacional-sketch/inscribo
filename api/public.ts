// api/public.ts
//
// Uma função só pras páginas públicas servidas pelo servidor. O plano Hobby
// da Vercel aceita no máximo 12 funções por deploy (api/*.ts fora de _lib/)
// e o projeto já estava no limite — a 13ª (Vitrine) derrubou o deploy.
// Página pública nova entra aqui como mais um route, não como arquivo novo
// em api/.
//
// Rotas (rewrites do vercel.json):
//   /pagar/:codigo → ?route=pagar&codigo=  (link de cobrança manual)
//   /:slug         → ?route=vitrine&slug=  (Vitrine da escola)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import pagarRedirect from './_lib/pagarRedirect.js'
import vitrinePage from './_lib/vitrinePage.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  switch (req.query.route) {
    case 'pagar':   return pagarRedirect(req, res)
    case 'vitrine': return vitrinePage(req, res)
    default:        return res.status(404).end()
  }
}
