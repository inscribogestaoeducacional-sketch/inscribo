import React from 'react'
import { Document } from '@react-pdf/renderer'
import type { RaioXCtx } from '../data'
import type { IgAnalise } from '../ig'
import { anoEtapas } from '../insights'
import { Capa, PagePosicao } from './pages_a'
import { PageCrescimento, PagePerda, PageEnem, PageNascimentos, PageEstrutura } from './pages_b'
import { PageMapa, PageDigital1, PageDigital2, PageDigital3, PageDigital4 } from './pages_c'
import { PageAtendimento, PageIA, PageMetas, PageOportunidades } from './pages_d'
import { registerFonts } from './ui'

export interface RelatorioProps { c: RaioXCtx; ig?: IgAnalise | null }

// Cada página só entra se existir dado público (ou resposta) que a sustente.
export function paginasDoRelatorio({ c, ig }: RelatorioProps) {
  const R: any = c.R, temIg = !!ig?.amostra?.n
  return [
    { k: 'posicao', icon: 'pin', t: 'Posição entre as particulares', ok: true, el: <PagePosicao c={c} /> },
    { k: 'cresc', icon: 'trend', t: 'Crescimento em 5 anos', ok: (R.serie?.length ?? 0) >= 2, el: <PageCrescimento c={c} /> },
    { k: 'perda', icon: 'compass', t: 'Perda entre etapas', ok: !!anoEtapas(c), el: <PagePerda c={c} /> },
    { k: 'enem', icon: 'cap', t: 'ENEM', ok: !!R.enem, el: <PageEnem c={c} /> },
    { k: 'mapa', icon: 'map', t: 'Mapa de bairros', ok: c.B.length > 0, el: <PageMapa c={c} /> },
    { k: 'nasc', icon: 'baby', t: 'Nascimentos', ok: (R.nascimentos?.length ?? 0) > 1, el: <PageNascimentos c={c} /> },
    { k: 'estr', icon: 'school', t: 'Estrutura frente aos concorrentes', ok: !!R.estrutura, el: <PageEstrutura c={c} /> },
    { k: 'd1', icon: 'phone', t: 'Presença digital', ok: temIg, el: temIg ? <PageDigital1 c={c} ig={ig!} /> : null },
    { k: 'd2', icon: 'chat', t: 'O que a família responde', ok: temIg, el: temIg ? <PageDigital2 c={c} ig={ig!} /> : null },
    { k: 'd3', icon: 'check', t: 'Critérios da nota digital', ok: temIg, el: temIg ? <PageDigital3 c={c} ig={ig!} /> : null },
    { k: 'd4', icon: 'rocket', t: 'Captação e Vitrine', ok: temIg, el: temIg ? <PageDigital4 c={c} ig={ig!} /> : null },
    { k: 'atend', icon: 'call', t: 'Diagnóstico de atendimento', ok: true, el: <PageAtendimento c={c} /> },
    { k: 'ia', icon: 'bot', t: 'Diagnóstico da IA', ok: true, el: <PageIA c={c} /> },
    { k: 'metas', icon: 'target', t: 'Metas e relatórios com IA', ok: true, el: <PageMetas c={c} /> },
    { k: 'op', icon: 'star', t: 'As 3 maiores oportunidades', ok: true, el: <PageOportunidades c={c} /> },
  ].filter(p => p.ok)
}

export function Relatorio(p: RelatorioProps) {
  registerFonts()
  const ps = paginasDoRelatorio(p)
  return <Document title={`Raio-X Estratégico · ${p.c.nome}`} author="Áion Soluções Tecnológicas"><Capa c={p.c} lista={ps.map(x => ({ icon: x.icon, t: x.t }))} />{ps.map(x => React.cloneElement(x.el as any, { key: x.k }))}</Document>
}
