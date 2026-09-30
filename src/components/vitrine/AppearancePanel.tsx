// Aba "Aparência" do editor da Vitrine: identidade (logo, capa, nome,
// descrição) e tema (fundo, cores, fontes, botões, acabamento, animação).
// Só edita o rascunho da página (onChange); o editor salva sozinho.
// Opções = listas fechadas validadas no banco (20260929090000_vitrine_theme_v2).
import React, { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  type VitrinePageRow, type VitrineTheme, type ButtonStyle,
  FONT_PAIRS, HEX_RE, IMAGE_WIDTH, contrastRatio, currentFontPair, readTheme,
} from '../../lib/vitrine'
import { Field, TextInput, TextArea, Segmented, ImagePicker, cardStyle, hintStyle, sectionTitleStyle } from './ui'

interface Props {
  page: VitrinePageRow
  institution: { name: string; logo_url: string | null; primary_color: string | null }
  institutionId: string
  onChange: (patch: Partial<VitrinePageRow>) => void
  onError: (msg: string) => void
}

const PRIMARY_SWATCHES = ['#00A896', '#3B82F6', '#1A2B4A', '#7C3AED', '#DB2777', '#DC2626', '#F59E0B', '#16A34A']
const BG_SWATCHES = ['#FFFFFF', '#F8FAFC', '#FFF7ED', '#F0FDFA', '#EFF6FF', '#F8F5EE', '#0F172A', '#111827']
const TEXT_SWATCHES = ['#111827', '#1E293B', '#1A2B4A', '#FFFFFF', '#F8FAFC']
const ANGLES: { value: 0 | 45 | 90 | 135 | 180; label: string }[] = [
  { value: 180, label: '↓' }, { value: 135, label: '↘' }, { value: 90, label: '→' }, { value: 45, label: '↗' }, { value: 0, label: '↑' },
]
const BUTTONS: { value: ButtonStyle; label: string }[] = [
  { value: 'filled', label: 'Preenchido' }, { value: 'soft', label: 'Suave' }, { value: 'outline', label: 'Contorno' },
  { value: 'glass', label: 'Vidro' }, { value: 'shadow', label: 'Sombra marcada' }, { value: 'minimal', label: 'Minimalista' },
]
const ANIMATIONS = {
  none:   'Os blocos aparecem direto, sem movimento.',
  subtle: 'Os blocos surgem com um deslizar curto e os botões sobem levemente ao passar o mouse.',
  lively: 'Os blocos entram em cascata, os botões sobem com sombra e o botão de matrícula pulsa 3 vezes. Continua leve pro 4G.',
}

// Fontes de amostra dos cartões de par (só no editor; a página pública
// carrega apenas o par escolhido).
const SAMPLE_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Plus+Jakarta+Sans:wght@400;700'
  + '&family=Poppins:wght@400;700&family=Playfair+Display:wght@700&family=Merriweather:wght@700&family=DM+Sans:wght@400'
  + '&family=Fredoka:wght@700&family=Nunito:wght@400&family=Montserrat:wght@700&family=Source+Sans+3:wght@400'
  + '&family=DM+Serif+Display&display=swap'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...cardStyle, padding: 24 }}>
      <h3 style={{ ...sectionTitleStyle, margin: '0 0 18px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </section>
  )
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 6, lineHeight: 1.5 }}>
      <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} /> <span>{children}</span>
    </p>
  )
}

function ColorField({ label, value, swatches, onChange, hint }: { label: string; value: string; swatches: string[]; onChange: (v: string) => void; hint?: string }) {
  const [text, setText] = React.useState(value)
  React.useEffect(() => setText(value), [value])
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())} aria-label={`${label}: escolher cor`}
          style={{ width: 38, height: 38, padding: 2, border: '1.5px solid #E2E8F0', borderRadius: 9, background: '#fff', cursor: 'pointer', flex: 'none' }} />
        <TextInput value={text} maxLength={7} aria-label={`${label}: código`} style={{ width: 96, fontFamily: 'ui-monospace, monospace', flex: 'none' }}
          onChange={e => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            setText(v)
            if (HEX_RE.test(v)) onChange(v.toUpperCase())
          }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {swatches.map(s => (
            <button key={s} type="button" onClick={() => onChange(s)} title={s} aria-label={`Usar ${s}`}
              style={{
                width: 26, height: 26, borderRadius: 7, background: s, cursor: 'pointer', padding: 0,
                border: s.toUpperCase() === value.toUpperCase() ? '2px solid #1e2d6b' : '1px solid #CBD5E1',
                boxShadow: s.toUpperCase() === value.toUpperCase() ? '0 0 0 2px #fff inset' : 'none',
              }} />
          ))}
        </div>
      </div>
    </Field>
  )
}

// Cartão selecionável (pares de fonte, estilos de botão).
function Choice({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} aria-label={label} onClick={onClick}
      style={{
        textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer', background: '#fff', minWidth: 0,
        border: selected ? '2px solid #00A896' : '1px solid #e2e8f0', boxShadow: selected ? '0 0 0 3px #CCFBF1' : '0 1px 3px rgba(0,168,150,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}>
      {children}
    </button>
  )
}

// Miniatura de botão no estilo escolhido, com as cores da escola.
function ButtonSample({ style, theme }: { style: ButtonStyle; theme: VitrineTheme }) {
  const r = theme.radius === 999 ? 999 : theme.radius
  const base: React.CSSProperties = { height: 30, borderRadius: r, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text }
  const s: Record<ButtonStyle, React.CSSProperties> = {
    filled:  { background: theme.primary, color: '#fff', border: `2px solid ${theme.primary}` },
    soft:    { background: theme.primary + '26', border: '2px solid transparent' },
    outline: { background: 'transparent', border: `2px solid ${theme.primary}` },
    glass:   { background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 1px 6px rgba(0,0,0,.12)' },
    shadow:  { background: theme.primary, color: '#fff', border: `2px solid ${theme.text}`, boxShadow: `3px 3px 0 ${theme.text}` },
    minimal: { background: 'transparent', border: 0, borderBottom: `1px solid ${theme.text}33`, borderRadius: 0, justifyContent: 'space-between', padding: '0 2px' },
  }
  return (
    <div style={{ padding: 8, borderRadius: 8, background: style === 'glass' ? `linear-gradient(135deg, ${theme.primary}, ${theme.primary}88)` : theme.background }}>
      <div style={{ ...base, ...s[style] }}>{style === 'minimal' ? <><span>Botão</span><span style={{ color: theme.primary }}>→</span></> : 'Botão'}</div>
    </div>
  )
}

// A logo tem transparência? Lê os pixels numa miniatura (o Storage do
// Supabase libera CORS). true/false; null = não deu pra saber (sem aviso).
function useHasTransparency(url: string | null): boolean | null {
  const [result, setResult] = React.useState<boolean | null>(null)
  useEffect(() => {
    setResult(null)
    if (!url) return
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 48; c.height = 48
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, 48, 48)
        const px = ctx.getImageData(0, 0, 48, 48).data
        let transparent = false
        for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { transparent = true; break }
        if (alive) setResult(transparent)
      } catch { if (alive) setResult(null) }
    }
    img.onerror = () => { if (alive) setResult(null) }
    img.src = url
    return () => { alive = false }
  }, [url])
  return result
}

export default function AppearancePanel({ page, institution, institutionId, onChange, onError }: Props) {
  const theme = readTheme(page.theme)
  const setTheme = (patch: Partial<VitrineTheme>) => onChange({ theme: { ...theme, ...patch } })
  const primarySwatches = institution.primary_color && HEX_RE.test(institution.primary_color)
    ? [institution.primary_color.toUpperCase(), ...PRIMARY_SWATCHES.filter(s => s !== institution.primary_color!.toUpperCase())]
    : PRIMARY_SWATCHES
  const pair = currentFontPair(theme)
  const bgType = theme.bg_type || 'solid'
  const logoTransparent = useHasTransparency(theme.logo_shape === 'none' ? page.logo_url : null)

  // Fontes de amostra dos pares: carrega uma vez, só quando a aba abre.
  useEffect(() => {
    if (document.getElementById('vitrine-font-samples')) return
    const l = document.createElement('link')
    l.id = 'vitrine-font-samples'; l.rel = 'stylesheet'; l.href = SAMPLE_FONTS_HREF
    document.head.appendChild(l)
  }, [])

  // Contraste do texto: sólido = contra o fundo; gradiente = pior ponta;
  // imagem = depende da película (não dá pra medir a foto).
  let contrastWarn: string | null = null
  if (bgType === 'image') {
    const lightText = contrastRatio(theme.text, '#FFFFFF') < contrastRatio(theme.text, '#000000')
    const overlay = theme.bg_overlay ?? 40
    const toneOk = lightText ? theme.bg_overlay_tone !== 'light' : theme.bg_overlay_tone === 'light'
    if (!toneOk || overlay < 40) {
      contrastWarn = lightText
        ? 'Com texto claro sobre foto, use película escura de pelo menos 40% pra garantir a leitura.'
        : 'Com texto escuro sobre foto, use película clara de pelo menos 40% pra garantir a leitura.'
    }
  } else {
    const c = bgType === 'gradient'
      ? Math.min(contrastRatio(theme.text, theme.background), contrastRatio(theme.text, theme.bg_gradient_to || theme.background))
      : contrastRatio(theme.text, theme.background)
    if (c < 4.5) contrastWarn = `O texto está com pouco contraste sobre o fundo (${c.toFixed(1).replace('.', ',')}:1) e pode ficar difícil de ler no celular. O recomendado é pelo menos 4,5:1.`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Identidade">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
          <Field label="Logo">
            <ImagePicker institutionId={institutionId} value={page.logo_url} shape="circle" height={88} maxWidth={IMAGE_WIDTH.small}
              onError={onError} onChange={url => onChange({ logo_url: url })} />
            {institution.logo_url && page.logo_url !== institution.logo_url && (
              <button type="button" onClick={() => onChange({ logo_url: institution.logo_url })}
                style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: '#00A896', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Usar a logo da escola
              </button>
            )}
          </Field>
          <Field label="Capa (opcional)" hint="Imagem larga no topo da página. Sugestão: 1200 × 400 px.">
            <ImagePicker institutionId={institutionId} value={page.cover_url} height={88}
              emptyLabel="Enviar capa" onError={onError} onChange={url => onChange({ cover_url: url })} />
          </Field>
        </div>
        <Field label="Formato da logo" hint={theme.logo_shape === 'none' ? 'Sem moldura, a logo aparece solta e um pouco maior — ideal pra PNG com fundo transparente.' : undefined}>
          <Segmented value={theme.logo_shape || 'circle'} onChange={v => setTheme({ logo_shape: v })}
            options={[{ value: 'circle', label: 'Redonda' }, { value: 'rounded', label: 'Quadrada arredondada' }, { value: 'none', label: 'Sem moldura' }]} />
        </Field>
        {theme.logo_shape === 'none' && logoTransparent === false && (
          <Warn>Essa logo tem fundo (não é transparente): sem moldura, o retângulo do fundo vai aparecer na página. Use um PNG com fundo transparente ou volte pra moldura.</Warn>
        )}
        <Field label="Nome na página" counter={{ value: page.title || '', max: 80 }}>
          <TextInput value={page.title || ''} maxLength={80} placeholder={institution.name} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Descrição curta" counter={{ value: page.bio || '', max: 300 }} hint="Aparece abaixo do nome. Ex.: séries atendidas, cidade, matrículas abertas.">
          <TextArea rows={3} value={page.bio || ''} maxLength={300} onChange={e => onChange({ bio: e.target.value || null })} />
        </Field>
      </Section>

      <Section title="Fundo">
        <Segmented value={bgType} onChange={v => setTheme({ bg_type: v })}
          options={[{ value: 'solid', label: 'Cor sólida' }, { value: 'gradient', label: 'Gradiente' }, { value: 'image', label: 'Imagem' }]} />
        {bgType === 'solid' && (
          <ColorField label="Cor do fundo" value={theme.background} swatches={BG_SWATCHES} onChange={v => setTheme({ background: v })} />
        )}
        {bgType === 'gradient' && (
          <>
            <div aria-hidden="true" style={{ height: 44, borderRadius: 10, border: '1px solid #e2e8f0',
              background: `linear-gradient(${theme.bg_gradient_angle ?? 180}deg, ${theme.background}, ${theme.bg_gradient_to || theme.background})` }} />
            <ColorField label="Cor inicial" value={theme.background} swatches={[...primarySwatches.slice(0, 4), ...BG_SWATCHES.slice(0, 4)]} onChange={v => setTheme({ background: v })} />
            <ColorField label="Cor final" value={theme.bg_gradient_to || theme.background} swatches={[...primarySwatches.slice(0, 4), ...BG_SWATCHES.slice(0, 4)]} onChange={v => setTheme({ bg_gradient_to: v })} />
            <Field label="Direção">
              <Segmented value={theme.bg_gradient_angle ?? 180} onChange={v => setTheme({ bg_gradient_angle: v })} options={ANGLES} />
            </Field>
          </>
        )}
        {bgType === 'image' && (
          <>
            <Field label="Imagem de fundo" hint="Fica parada atrás dos blocos. Imagem vertical funciona melhor (ex.: 1080 × 1920 px); ela é reduzida automaticamente antes de enviar.">
              <ImagePicker institutionId={institutionId} value={theme.bg_image_url || null} height={120}
                emptyLabel="Enviar imagem de fundo" onError={onError} onChange={url => setTheme({ bg_image_url: url })} />
            </Field>
            <Field label={`Película sobre a imagem: ${theme.bg_overlay ?? 40}%`} hint="Escurece ou clareia a foto pra o texto ficar legível.">
              <input type="range" min={0} max={80} step={10} value={theme.bg_overlay ?? 40}
                onChange={e => setTheme({ bg_overlay: Number(e.target.value) })} style={{ width: '100%', accentColor: '#00A896' }} />
            </Field>
            <Field label="Tom da película">
              <Segmented value={theme.bg_overlay_tone || 'dark'} onChange={v => setTheme({ bg_overlay_tone: v })}
                options={[{ value: 'dark', label: 'Escura' }, { value: 'light', label: 'Clara' }]} />
            </Field>
            <ColorField label="Cor de apoio" value={theme.background} swatches={BG_SWATCHES} onChange={v => setTheme({ background: v })}
              hint="Aparece enquanto a imagem carrega e na barra do navegador." />
            {!theme.bg_image_url && <Warn>Sem imagem enviada, a página usa a cor de apoio como fundo.</Warn>}
          </>
        )}
      </Section>

      <Section title="Cores">
        <ColorField label="Cor principal (botões)" value={theme.primary} swatches={primarySwatches} onChange={v => setTheme({ primary: v })} />
        <ColorField label="Texto" value={theme.text} swatches={TEXT_SWATCHES} onChange={v => setTheme({ text: v })} />
        {contrastWarn && <Warn>{contrastWarn}</Warn>}
      </Section>

      <Section title="Fontes">
        {!pair && theme.font && (
          <p style={{ ...hintStyle, marginTop: 0, fontSize: 12 }}>Fonte atual: <strong>{theme.font}</strong> (versão anterior). Escolha um par abaixo pra trocar.</p>
        )}
        <div role="radiogroup" aria-label="Par de fontes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {Object.entries(FONT_PAIRS).map(([key, p]) => (
            <Choice key={key} selected={pair === key} onClick={() => setTheme({ font_pair: key })} label={`${p.label}: ${p.heading} e ${p.body}`}>
              <span style={{ display: 'block', fontFamily: `'${p.heading}'`, fontWeight: p.heading === 'DM Serif Display' ? 400 : 700, fontSize: 18, color: '#1e293b', lineHeight: 1.2 }}>Aa Escola</span>
              <span style={{ display: 'block', fontFamily: `'${p.body}'`, fontSize: 12, color: '#475569', marginTop: 2 }}>Matrículas abertas</span>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 6 }}>{p.label}</span>
            </Choice>
          ))}
        </div>
      </Section>

      <Section title="Botões">
        <div role="radiogroup" aria-label="Estilo dos botões" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {BUTTONS.map(b => (
            <Choice key={b.value} selected={theme.button_style === b.value} onClick={() => setTheme({ button_style: b.value })} label={b.label}>
              <ButtonSample style={b.value} theme={theme} />
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1e293b', marginTop: 6 }}>{b.label}</span>
            </Choice>
          ))}
        </div>
        {theme.button_style === 'glass' && bgType === 'solid' && (
          <p style={{ ...hintStyle, marginTop: 0 }}>O estilo Vidro fica mais bonito sobre gradiente ou imagem.</p>
        )}
        <Field label="Cantos">
          <Segmented value={theme.radius} onChange={v => setTheme({ radius: v })}
            options={[{ value: 0, label: 'Retos' }, { value: 8, label: 'Leves' }, { value: 16, label: 'Arredondados' }, { value: 999, label: 'Pílula' }]} />
        </Field>
      </Section>

      <Section title="Acabamento">
        <Field label="Sombra">
          <Segmented value={theme.shadow || 'none'} onChange={v => setTheme({ shadow: v })}
            options={[{ value: 'none', label: 'Nenhuma' }, { value: 'soft', label: 'Suave' }, { value: 'strong', label: 'Forte' }]} />
        </Field>
        <Field label="Espaço entre blocos">
          <Segmented value={theme.spacing || 'normal'} onChange={v => setTheme({ spacing: v })}
            options={[{ value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplo' }]} />
        </Field>
        <Field label="Cartões (texto, mapa, horário)">
          <Segmented value={theme.card_style || 'bordered'} onChange={v => setTheme({ card_style: v })}
            options={[{ value: 'bordered', label: 'Com borda' }, { value: 'flat', label: 'Lisos' }, { value: 'elevated', label: 'Elevados' }]} />
        </Field>
      </Section>

      <Section title="Animação">
        <Segmented value={theme.animation || 'none'} onChange={v => setTheme({ animation: v })}
          options={[{ value: 'none', label: 'Nenhuma' }, { value: 'subtle', label: 'Sutil' }, { value: 'lively', label: 'Mais chamativa' }]} />
        <p style={{ ...hintStyle, marginTop: 0, fontSize: 12 }}>
          {ANIMATIONS[theme.animation || 'none']}
          {theme.animation && theme.animation !== 'none' && ' Use “Ver animação” acima da prévia pra conferir. Quem configurou o celular pra reduzir movimento não vê animação.'}
        </p>
      </Section>
    </div>
  )
}
