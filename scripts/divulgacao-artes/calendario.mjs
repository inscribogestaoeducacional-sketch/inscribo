// Lê docs/marketing/calendario-divulgacao-v2.md e devolve os textos EXATOS de
// cada peça (nada é reescrito aqui):
//   artes[A04] = { tipo: 'carrossel', telas: [{ title, text } x4], fecho, telaSistema }
//   artes[A06] = { tipo: 'unica', titulo, explicacao, pontos: [3], fecho, telaSistema }
//   reels[R01] = { abertura, narracao: [4], fecho, telaSistema }
// Os pontos (" / ") e as frases da narração ('" / "') são separados como o
// calendário define. Fecho padrão quando a peça não indica outro.
import { readFileSync } from 'node:fs'

export const FECHO_PADRAO = 'Fale com a nossa equipe e veja funcionando na sua escola.'

export function lerCalendario(path) {
  const md = readFileSync(path, 'utf8').replace(/\r/g, '')
  const artes = {}, reels = {}
  const blocos = md.split(/^### /m).slice(1)
  for (const b of blocos) {
    const [head, ...linhas] = b.split('\n')
    const code = head.match(/^([AR]\d\d)/)?.[1]
    if (!code) continue
    const campo = nome => {
      const l = linhas.find(x => x.startsWith(`- ${nome}:`))
      return l ? l.slice(`- ${nome}:`.length).trim() : null
    }
    const telaSistema = campo('Tela do sistema')
    if (code.startsWith('R')) {
      const narr = campo('Narração')
      reels[code] = {
        titulo: head,
        abertura: campo('Abertura na tela'),
        narracao: narr ? narr.replace(/^"|"$/g, '').split(/"\s*\/\s*"/) : [],
        fecho: campo('Fecho') || FECHO_PADRAO,
        telaSistema,
      }
      continue
    }
    if (/Carrossel/.test(head)) {
      const telas = [1, 2, 3, 4].map(n => {
        const v = campo(`Tela ${n}`)
        const m = v && v.match(/^\*\*(.+?)\*\*\s+—\s+(.+)$/)
        return m ? { title: m[1], text: m[2] } : null
      })
      artes[code] = { tipo: 'carrossel', titulo: head, telas, fecho: campo('Fecho') || FECHO_PADRAO, telaSistema }
    } else {
      const pontos = campo('Pontos')
      artes[code] = {
        tipo: 'unica', titulo: head,
        title: campo('Título'), explicacao: campo('Explicação'),
        pontos: pontos && !pontos.startsWith('(') ? pontos.split(' / ') : [],
        fecho: pontos && pontos.startsWith('(') ? null : (campo('Fecho') || FECHO_PADRAO),
        telaSistema,
      }
    }
  }
  return { artes, reels }
}
