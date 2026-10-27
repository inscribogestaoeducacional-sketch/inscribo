import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { fetchRaioX } from '../fetch'
import { Relatorio } from './Relatorio'
import { setBase } from './ui'
import type { AtendCtx } from '../data'
import type { IgAnalise } from '../ig'

export interface ExtrasRelatorio { ig?: IgAnalise | null; atend?: AtendCtx | null; textoIA?: string | null }

/** Busca os dados públicos da escola e monta o PDF novo. Devolve null se a escola não tem dados. */
export async function gerarRaioXBlob(co: string, ex: ExtrasRelatorio = {}): Promise<Blob | null> {
  if (typeof window !== 'undefined') setBase(window.location.origin)
  const c = await fetchRaioX(co)
  if (!c) return null
  c.atend = ex.atend ?? null
  c.textoIA = ex.textoIA ?? null
  return pdf(<Relatorio c={c} ig={ex.ig ?? null} />).toBlob()
}
