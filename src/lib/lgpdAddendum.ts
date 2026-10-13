// src/lib/lgpdAddendum.ts
//
// Aditivo de Proteção de Dados (LGPD) — Áion Edu.
// O texto completo de cada versão fica em public/legal/aditivo-lgpd-<versão>.md
// (cópia versionada no repositório, byte a byte: .gitattributes marca -text).
// Uma versão só pode ser aceita depois de PUBLICADA no banco
// (lgpd_text_versions: versão + SHA-256 do arquivo servido). O aceite manda o
// hash do texto que a pessoa abriu; o banco recusa se não bater.

export const lgpdTextUrl = (version: string) => `/legal/aditivo-lgpd-${version}.md`

// Resumo de 5 linhas mostrado antes do aceite (conferir com o texto final).
export const LGPD_SUMMARY: string[] = [
  'A escola é a controladora dos dados; a Áion é a operadora e só trata os dados seguindo as instruções da escola.',
  'Dados: nome, matrícula, série, turma e situação dos alunos; nome e contato dos responsáveis (CPF só como código irreversível). Nada de notas, frequência, saúde ou financeiro.',
  'Suboperadores: Supabase, Vercel, Meta (WhatsApp), Brevo/Resend, Asaas, Autentique e o provedor de inteligência artificial, com as regras do texto completo.',
  'Direitos dos titulares: pedidos de acesso, correção ou eliminação vão para a escola; a escola pode pedir a eliminação de um aluno ou de um ano a qualquer momento.',
  'Segurança: dados isolados por escola e acesso por perfil; incidentes são avisados à escola, e no fim do contrato os dados são devolvidos e eliminados.',
]

// Busca o texto servido e devolve { text, sha256 } — ou null se a versão
// ainda não estiver no ar (o SPA devolve o index.html para arquivo ausente).
export async function fetchLgpdText(version: string): Promise<{ text: string; sha256: string } | null> {
  const res = await fetch(lgpdTextUrl(version), { cache: 'no-store' })
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  const head = new TextDecoder().decode(buf.slice(0, 200)).trimStart().toLowerCase()
  if (head.startsWith('<!doctype') || head.startsWith('<html')) return null
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  return { text: new TextDecoder().decode(buf), sha256 }
}

// Campos da escola no modelo (preenchidos pelo sistema com a escola que aceita).
// No arquivo da versão aparecem como {{escola_nome}}, {{escola_cnpj}}, …
export type LgpdFields = { escola_nome?: string | null; escola_cnpj?: string | null; escola_endereco?: string | null; representante?: string | null; data?: string | null }
const FIELD_LABEL: Record<keyof LgpdFields, string> = {
  escola_nome: 'nome da escola', escola_cnpj: 'CNPJ da escola', escola_endereco: 'endereço da escola',
  representante: 'administrador(a) que aceita', data: 'data do aceite',
}
export function fillLgpdTemplate(text: string, f: LgpdFields): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => {
    const v = (f as Record<string, string | null | undefined>)[k]
    if (v && v.trim()) return v.trim()
    const label = FIELD_LABEL[k as keyof LgpdFields]
    return label ? `[${label}]` : m
  })
}
