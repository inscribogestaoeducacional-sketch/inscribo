// src/pages/AditivoLgpd.tsx — /aditivo-lgpd?v=v1
// Texto completo do Aditivo de Proteção de Dados (LGPD) — Áion Edu, lido da
// cópia versionada em public/legal/aditivo-lgpd-<versão>.md. Página pública
// (o texto não é sigiloso). Markdown simples: títulos, listas, tabelas e parágrafos.
// Logado: os campos {{escola_*}} vêm preenchidos com a escola de quem lê;
// sem login aparecem como [nome da escola] etc.
import { useEffect, useState, type ReactNode } from 'react'
import { fetchLgpdText, fillLgpdTemplate, type LgpdFields } from '../lib/lgpdAddendum'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p)
}

function render(md: string): ReactNode[] {
  const out: ReactNode[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) continue
    const h = l.match(/^(#{1,3})\s+(.*)$/)
    if (h) { const T = (['h1', 'h2', 'h3'] as const)[h[1].length - 1]; out.push(<T key={i} style={{ color: '#1A2B4A', margin: '22px 0 8px' }}>{inline(h[2])}</T>); continue }
    if (l.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      i--
      out.push(<table key={i} style={{ borderCollapse: 'collapse', width: '100%', margin: '8px 0', fontSize: 14 }}><tbody>
        {rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => ri === 0
          ? <th key={ci} style={{ border: '1px solid #E2E8F0', padding: 6, background: '#F8FAFC', textAlign: 'left' }}>{inline(c)}</th>
          : <td key={ci} style={{ border: '1px solid #E2E8F0', padding: 6 }}>{inline(c)}</td>)}</tr>)}
      </tbody></table>)
      continue
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
      i--
      out.push(<ul key={i} style={{ margin: '6px 0', paddingLeft: 22, lineHeight: 1.6 }}>{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>)
      continue
    }
    out.push(<p key={i} style={{ margin: '6px 0', lineHeight: 1.6 }}>{inline(l)}</p>)
  }
  return out
}

export default function AditivoLgpd() {
  const version = new URLSearchParams(window.location.search).get('v') || 'v1'
  const [text, setText] = useState<string | null | undefined>(undefined)
  const { user } = useAuth()
  const [fields, setFields] = useState<LgpdFields>({})
  useEffect(() => {
    const inst = user?.institution_id
    if (!inst) { setFields({}); return }
    supabase.from('institutions').select('name, cnpj, address, city, state').eq('id', inst).maybeSingle().then(({ data }) => {
      const d = data as { name?: string; cnpj?: string; address?: string; city?: string; state?: string } | null
      setFields({
        escola_nome: d?.name, escola_cnpj: d?.cnpj,
        escola_endereco: [d?.address, d?.city, d?.state].filter(Boolean).join(', ') || null,
        representante: user?.role === 'admin' ? user?.full_name : null,
      })
    })
  }, [user?.institution_id, user?.role, user?.full_name])
  useEffect(() => {
    if (!/^v\d+$/.test(version)) { setText(null); return }
    fetchLgpdText(version).then(t => setText(t?.text ?? null)).catch(() => setText(null))
  }, [version])
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px', color: '#334155', fontSize: 15 }}>
      <p style={{ fontSize: 12, color: '#94A3B8' }}>Versão {version}</p>
      {text === undefined && <p>Carregando…</p>}
      {text === null && <p>O texto desta versão do aditivo ainda não foi publicado.</p>}
      {text && render(fillLgpdTemplate(text, fields))}
    </div>
  )
}
