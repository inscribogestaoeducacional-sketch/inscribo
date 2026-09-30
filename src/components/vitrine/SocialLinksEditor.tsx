// Seção fixa "Redes sociais" do editor da Vitrine: fileira de ícones logo
// abaixo da logo/descrição na página (vitrine_pages.social_links), separada
// da lista de blocos. A escola digita só o perfil; o link é montado por
// socialUrl (api/_lib/vitrineRender.ts), a mesma função da página pública.
// Só entradas válidas vão pro rascunho da página — linha inválida mostra o
// erro e fica fora até ser corrigida (senão o banco recusaria o save todo).
import React, { useEffect, useMemo, useState } from 'react'
import { Plus, X, AlertCircle, Check } from 'lucide-react'
import {
  type SocialLink, type SocialNet, type VitrineTheme,
  SOCIAL, TOP_NETWORKS, socialUrl, normalizeHandle,
} from '../../lib/vitrine'
import { Segmented, cardStyle, hintStyle, inputStyle, sectionTitleStyle } from './ui'

// Já aparecem prontas pra preencher; as demais entram por "+ adicionar".
const DEFAULT_NETS: SocialNet[] = ['instagram', 'facebook', 'whatsapp', 'tiktok', 'youtube']

const PREFIX: Record<SocialNet, string> = {
  instagram: 'instagram.com/', facebook: 'facebook.com/', whatsapp: 'wa.me/+55 ', tiktok: 'tiktok.com/@',
  youtube: 'youtube.com/@', linkedin: 'linkedin.com/company/', x: 'x.com/', threads: 'threads.net/@', telegram: 't.me/',
}
const PLACEHOLDER: Partial<Record<SocialNet, string>> = {
  whatsapp: 'DDD + número, ex.: 83999998888', linkedin: 'nome-da-escola (ou in/nome)',
}

interface Row { network: SocialNet; value: string }

interface Props {
  links: SocialLink[]
  theme: VitrineTheme
  schoolPhone: string | null
  onChange: (links: SocialLink[]) => void
  onThemeChange: (patch: Partial<VitrineTheme>) => void
  position: 'top' | 'bottom'
  onPositionChange: (p: 'top' | 'bottom') => void
}

function Icon({ net, size = 30 }: { net: SocialNet; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: SOCIAL[net].bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
      dangerouslySetInnerHTML={{ __html: SOCIAL[net].svg.replace('<svg ', `<svg width="${Math.round(size * 0.52)}" height="${Math.round(size * 0.52)}" `) }} />
  )
}

export default function SocialLinksEditor({ links, theme, schoolPhone, onChange, onThemeChange, position, onPositionChange }: Props) {
  // Linhas = redes salvas + padrões ainda vazios (na ordem padrão) + extras
  // que a escola abriu nesta sessão.
  const [rows, setRows] = useState<Row[]>(() => {
    const saved = links.map(l => ({ network: l.network, value: l.handle }))
    const missing = DEFAULT_NETS.filter(n => !saved.some(r => r.network === n)).map(n => ({ network: n, value: '' }))
    // Ordem salva primeiro (reordenar aqui dispararia um save sem a escola
    // mexer em nada); padrões ainda vazios depois.
    return [...saved, ...missing]
  })
  const [adding, setAdding] = useState(false)

  const parsed = useMemo(() => rows.map(r => {
    const handle = normalizeHandle(r.network, r.value)
    const url = handle ? socialUrl(r.network, handle) : null
    return { ...r, handle, url, invalid: !!r.value.trim() && !url }
  }), [rows])

  // Rascunho da página = só as válidas, na ordem das linhas.
  useEffect(() => {
    const next: SocialLink[] = parsed.filter(p => p.url).map(p => ({ network: p.network, handle: p.handle }))
    if (JSON.stringify(next) !== JSON.stringify(links)) onChange(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed])

  const setValue = (net: SocialNet, value: string) => setRows(rs => rs.map(r => (r.network === net ? { ...r, value } : r)))
  const remove = (net: SocialNet) => setRows(rs => rs.filter(r => r.network !== net))
  const available = TOP_NETWORKS.filter(n => !rows.some(r => r.network === n))
  const filled = parsed.filter(p => p.url).length
  const schoolDigits = normalizeHandle('whatsapp', schoolPhone || '')

  return (
    <section style={{ ...cardStyle, padding: 24 }} aria-labelledby="vit-social-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <h3 id="vit-social-title" style={sectionTitleStyle}>Redes sociais</h3>
        <span style={{ fontSize: 12, color: filled ? '#059669' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
          {filled ? <><Check size={12} /> {filled} na página</> : 'Nenhuma preenchida'}
        </span>
      </div>
      <p style={{ ...hintStyle, margin: '0 0 14px', fontSize: 12 }}>
        Aparecem como bolinhas logo abaixo da logo, no topo da página. Digite só o nome de usuário — o link é montado sozinho. Rede em branco não aparece.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {parsed.map(p => {
          const id = `vit-social-${p.network}`
          return (
            <div key={p.network}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon net={p.network} />
                <label htmlFor={id} style={{ width: 78, fontSize: 13, fontWeight: 600, color: '#1e293b', flex: 'none' }}>{SOCIAL[p.network].label}</label>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', border: `1.5px solid ${p.invalid ? '#FCA5A5' : '#E2E8F0'}`, borderRadius: 12, background: '#FAFAFA', overflow: 'hidden' }}>
                  <span style={{ padding: '0 0 0 10px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{PREFIX[p.network]}</span>
                  <input id={id} value={p.value} placeholder={PLACEHOLDER[p.network] || 'nomedaescola'}
                    inputMode={p.network === 'whatsapp' ? 'numeric' : 'text'} autoComplete="off" spellCheck={false}
                    onChange={e => setValue(p.network, e.target.value)}
                    onBlur={() => { if (p.handle && p.handle !== p.value) setValue(p.network, p.handle) }}
                    style={{ ...inputStyle, border: 'none', background: 'transparent', paddingLeft: 2, flex: 1, minWidth: 60 }} />
                </div>
                {!DEFAULT_NETS.includes(p.network) ? (
                  <button type="button" onClick={() => remove(p.network)} aria-label={`Remover ${SOCIAL[p.network].label}`} title="Remover"
                    style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <X size={14} />
                  </button>
                ) : <span style={{ width: 30, flex: 'none' }} />}
              </div>
              {p.network === 'whatsapp' && !p.value && schoolDigits && (
                <button type="button" onClick={() => setValue('whatsapp', schoolDigits)}
                  style={{ margin: '4px 0 0 128px', background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: '#00A896', cursor: 'pointer' }}>
                  Usar o WhatsApp da escola
                </button>
              )}
              {p.invalid && (
                <p role="alert" style={{ margin: '4px 0 0 128px', fontSize: 12, color: '#dc2626', display: 'flex', gap: 4, alignItems: 'center' }}>
                  <AlertCircle size={12} /> {p.network === 'whatsapp' ? 'Use DDD + número (10 ou 11 dígitos).' : 'Use só o nome de usuário (letras, números, ponto, hífen ou _).'} Não aparece até corrigir.
                </p>
              )}
              {p.url && <p style={{ ...hintStyle, margin: '3px 0 0 128px', wordBreak: 'break-all' }}>→ {p.url}</p>}
            </div>
          )
        })}
      </div>

      {available.length > 0 && (
        adding ? (
          <div role="group" aria-label="Escolha a rede" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {available.map(n => (
              <button key={n} type="button" onClick={() => { setRows(rs => [...rs, { network: n, value: '' }]); setAdding(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px 5px 5px', borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                <Icon net={n} size={22} /> {SOCIAL[n].label}
              </button>
            ))}
            <button type="button" onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, color: '#00A896', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Adicionar outra rede
          </button>
        )
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Estilo dos ícones</span>
        <Segmented value={theme.social_style || 'brand'} onChange={v => onThemeChange({ social_style: v })}
          options={[{ value: 'brand', label: 'Cores das redes' }, { value: 'theme', label: 'Cor da escola' }, { value: 'plain', label: 'Só o ícone' }]} />
        <p style={{ ...hintStyle, fontSize: 12 }}>Vale também pros links marcados como “Ícone” na lista de blocos.</p>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Posição</span>
        <Segmented value={position} onChange={onPositionChange}
          options={[{ value: 'top', label: 'No topo, abaixo do nome' }, { value: 'bottom', label: 'No rodapé' }]} />
        <p style={{ ...hintStyle, fontSize: 12 }}>No topo, as redes são a primeira coisa que a pessoa vê; no rodapé, os botões da escola (WhatsApp, matrícula) ganham o destaque.</p>
      </div>
    </section>
  )
}
