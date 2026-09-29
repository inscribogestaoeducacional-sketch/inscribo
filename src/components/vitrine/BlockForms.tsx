// Formulário de edição de cada tipo de bloco da Vitrine. Só edita o config
// em memória (onChange); salvar é com o editor (autosave com validação).
// Imagem removida aqui NÃO é apagada do bucket na hora — o editor apaga
// depois que a alteração foi salva (senão um bloco inválido, que não salva,
// deixaria a página publicada apontando pra arquivo apagado).
import React from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ImagePlus, Megaphone, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  type BlockType, type LinkStyle, type BannerAspect, normalizeUrl, parseVideoUrl, uploadVitrineImage,
  IMAGE_ACCEPT, IMAGE_WIDTH, BANNER_ASPECTS, SOCIAL, detectSocial,
} from '../../lib/vitrine'
import { Field, TextInput, TextArea, Toggle, Segmented, ImagePicker, hintStyle } from './ui'

export interface BlockFormContext {
  institutionId: string
  schoolPhone: string | null
  onError: (msg: string) => void
  // Outro bloco com a mesma mensagem de WhatsApp (origem ambígua no Captação)
  duplicateMessage: boolean
  hasCaptureTrigger: boolean
  institutionName: string
}

interface Props {
  type: BlockType
  config: Record<string, any>
  onChange: (patch: Record<string, any>) => void
  ctx: BlockFormContext
}

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function fmtPhone(p: string | null) {
  const d = (p || '').replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p || ''
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 6, lineHeight: 1.5 }}>
      <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} /> <span>{children}</span>
    </p>
  )
}

function CaptureNote({ active }: { active: boolean }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: '#0F766E', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 6, lineHeight: 1.5 }}>
      <Megaphone size={14} style={{ flex: 'none', marginTop: 2 }} />
      <span>
        {active ? 'Gatilho criado no Captação: ' : 'Ao salvar, vira um gatilho no Captação: '}
        quem mandar essa mensagem chega marcado com a origem “Vitrine” e vira lead automaticamente.
        {active && <> Resposta automática e distribuição podem ser ajustadas em <Link to="/captacao" style={{ color: '#0F766E', fontWeight: 600 }}>Captação</Link>.</>}
      </span>
    </p>
  )
}

function MessageField({ config, onChange, ctx, hint }: Pick<Props, 'config' | 'onChange' | 'ctx'> & { hint: string }) {
  return (
    <>
      <Field label="Mensagem pré-preenchida" counter={{ value: config.message || '', max: 500 }} hint={hint}>
        <TextArea rows={3} value={config.message || ''} maxLength={500} onChange={e => onChange({ message: e.target.value })} />
      </Field>
      {ctx.duplicateMessage && (
        <Warn>Outro bloco usa a mesma mensagem. Use textos diferentes pra saber qual botão trouxe cada conversa.</Warn>
      )}
    </>
  )
}

export default function BlockForm({ type, config, onChange, ctx }: Props) {
  switch (type) {
    // ── Link ────────────────────────────────────────────────────────────────
    case 'link':
      return <LinkForm config={config} onChange={onChange} ctx={ctx} />

    // ── Banner ──────────────────────────────────────────────────────────────
    case 'banner':
      return <BannerForm config={config} onChange={onChange} ctx={ctx} />

    // ── WhatsApp ────────────────────────────────────────────────────────────
    case 'whatsapp': {
      const custom = config.phone_source === 'custom'
      const tracking = !custom && config.track_capture !== false
      return (
        <Grid>
          <Field label="Texto do botão" counter={{ value: config.label || '', max: 80 }}>
            <TextInput value={config.label || ''} maxLength={80} placeholder="Ex.: Fale com a secretaria" onChange={e => onChange({ label: e.target.value })} />
          </Field>
          <Field label="Número">
            <Segmented value={custom ? 'custom' : 'school'} onChange={v => onChange({ phone_source: v })}
              options={[{ value: 'school', label: 'WhatsApp da escola' }, { value: 'custom', label: 'Outro número' }]} />
          </Field>
          {!custom && (ctx.schoolPhone
            ? <p style={{ ...hintStyle, marginTop: -8 }}>Número conectado ao Áion: <strong style={{ color: '#475569' }}>{fmtPhone(ctx.schoolPhone)}</strong></p>
            : <Warn>A escola não tem WhatsApp conectado ao Áion. O botão só aparece na página depois que o número for conectado.</Warn>)}
          {custom && (
            <Field label="Número de WhatsApp" hint="DDD + número, só dígitos. Ex.: 83999998888">
              <TextInput value={config.custom_phone || ''} inputMode="numeric" maxLength={13} placeholder="83999998888"
                onChange={e => onChange({ custom_phone: e.target.value.replace(/\D/g, '') })} />
            </Field>
          )}
          <MessageField config={config} onChange={onChange} ctx={ctx}
            hint="Texto que já vem digitado quando a pessoa abre o WhatsApp." />
          {custom
            ? <Warn>Com outro número, o Áion conta os cliques mas não identifica a conversa no Captação (ela não passa pelo WhatsApp da escola).</Warn>
            : <Toggle checked={tracking} onChange={v => onChange({ track_capture: v })}
                label="Identificar origem no Captação"
                description="Marca a conversa com a origem “Vitrine” e cria o lead automaticamente." />}
          {tracking && <CaptureNote active={ctx.hasCaptureTrigger} />}
        </Grid>
      )
    }

    // ── Matrícula ───────────────────────────────────────────────────────────
    case 'enroll': {
      const isLink = config.mode === 'link'
      return (
        <Grid>
          <Field label="Texto do botão" counter={{ value: config.label || '', max: 80 }}>
            <TextInput value={config.label || ''} maxLength={80} placeholder="Ex.: Matrículas 2027" onChange={e => onChange({ label: e.target.value })} />
          </Field>
          <Field label="O botão abre">
            <Segmented value={isLink ? 'link' : 'whatsapp'} onChange={v => onChange({ mode: v })}
              options={[{ value: 'whatsapp', label: 'WhatsApp da escola' }, { value: 'link', label: 'Link externo' }]} />
          </Field>
          {isLink ? (
            <Field label="Link da matrícula" hint="Ex.: formulário ou sistema de matrícula da escola.">
              <TextInput value={config.url || ''} placeholder="https://..." inputMode="url"
                onChange={e => onChange({ url: e.target.value })}
                onBlur={e => { const v = normalizeUrl(e.target.value); if (v !== config.url) onChange({ url: v }) }} />
            </Field>
          ) : (
            <>
              {!ctx.schoolPhone && <Warn>A escola não tem WhatsApp conectado ao Áion. O botão só aparece na página depois que o número for conectado.</Warn>}
              <MessageField config={config} onChange={onChange} ctx={ctx}
                hint="Texto que já vem digitado quando a pessoa abre o WhatsApp." />
              <CaptureNote active={ctx.hasCaptureTrigger} />
            </>
          )}
        </Grid>
      )
    }

    // ── Texto ───────────────────────────────────────────────────────────────
    case 'text':
      return (
        <Grid>
          <Field label="Título (opcional)" counter={{ value: config.title || '', max: 100 }}>
            <TextInput value={config.title || ''} maxLength={100} onChange={e => onChange({ title: e.target.value })} />
          </Field>
          <Field label="Texto" counter={{ value: config.body || '', max: 2000 }} hint="Deixe uma linha em branco pra separar parágrafos.">
            <TextArea rows={6} value={config.body || ''} maxLength={2000} onChange={e => onChange({ body: e.target.value })} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
            <Field label="Tamanho do título">
              <Segmented value={config.title_size || 'md'} onChange={v => onChange({ title_size: v })}
                options={[{ value: 'sm', label: 'P' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'G' }]} />
            </Field>
            <Field label="Peso do título">
              <Segmented value={config.title_weight || 'bold'} onChange={v => onChange({ title_weight: v })}
                options={[{ value: 'regular', label: 'Normal' }, { value: 'semibold', label: 'Médio' }, { value: 'bold', label: 'Negrito' }]} />
            </Field>
            <Field label="Cor do título">
              <Segmented value={config.title_color || 'text'} onChange={v => onChange({ title_color: v })}
                options={[{ value: 'text', label: 'Cor do texto' }, { value: 'primary', label: 'Cor principal' }]} />
            </Field>
            <Field label="Tamanho do texto">
              <Segmented value={config.body_size || 'md'} onChange={v => onChange({ body_size: v })}
                options={[{ value: 'sm', label: 'P' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'G' }]} />
            </Field>
            <Field label="Alinhamento">
              <Segmented value={config.align || 'left'} onChange={v => onChange({ align: v })}
                options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }]} />
            </Field>
            <Field label="Fundo">
              <Segmented value={config.surface || 'card'} onChange={v => onChange({ surface: v })}
                options={[{ value: 'card', label: 'Cartão' }, { value: 'plain', label: 'Sem fundo' }]} />
            </Field>
          </div>
        </Grid>
      )

    // ── Galeria ─────────────────────────────────────────────────────────────
    case 'gallery':
      return <GalleryForm config={config} onChange={onChange} ctx={ctx} />

    // ── Vídeo ───────────────────────────────────────────────────────────────
    case 'video': {
      const invalid = !!config.url && !config.video_id
      return (
        <Grid>
          <Field label="Link do vídeo" hint="Cole o link do YouTube ou do Vimeo (ex.: https://youtu.be/...).">
            <TextInput value={config.url || ''} placeholder="https://www.youtube.com/watch?v=..." inputMode="url"
              onChange={e => {
                const parsed = parseVideoUrl(e.target.value)
                onChange({ url: e.target.value, provider: parsed?.provider || '', video_id: parsed?.video_id || '' })
              }} />
          </Field>
          {invalid && <Warn>Não reconheci esse link. Use um link de vídeo do YouTube ou do Vimeo.</Warn>}
          <Field label="Título (opcional)" counter={{ value: config.title || '', max: 100 }}>
            <TextInput value={config.title || ''} maxLength={100} placeholder="Ex.: Conheça nossa estrutura" onChange={e => onChange({ title: e.target.value })} />
          </Field>
        </Grid>
      )
    }

    // ── Mapa ────────────────────────────────────────────────────────────────
    case 'map':
      return (
        <Grid>
          <Field label="Título" counter={{ value: config.label || '', max: 80 }}>
            <TextInput value={config.label || ''} maxLength={80} placeholder="Onde estamos" onChange={e => onChange({ label: e.target.value })} />
          </Field>
          <Field label="Endereço" counter={{ value: config.address || '', max: 300 }} hint="Rua, número, bairro e cidade. Aparece escrito na página.">
            <TextArea rows={2} value={config.address || ''} maxLength={300} onChange={e => onChange({ address: e.target.value })} />
          </Field>
          <Field label="Nome no Google Maps" counter={{ value: config.place_name ?? ctx.institutionName, max: 120 }}
            hint="Como a escola aparece no Google Maps. Com o nome, o pino cai exatamente na escola; só com o endereço, o Google estima a posição do número e o pino pode ficar alguns metros ao lado. Deixe em branco se a escola não estiver no Google Maps.">
            <TextInput value={config.place_name ?? ctx.institutionName} maxLength={120} placeholder="Ex.: Colégio Exemplo" onChange={e => onChange({ place_name: e.target.value })} />
          </Field>
        </Grid>
      )

    // ── Horário ─────────────────────────────────────────────────────────────
    case 'hours':
      return <HoursForm config={config} onChange={onChange} />
  }
}

function LinkForm({ config, onChange, ctx }: Pick<Props, 'config' | 'onChange' | 'ctx'>) {
  const style: LinkStyle = ['icon', 'card', 'featured'].includes(config.style) ? config.style : 'button'
  const net = detectSocial(normalizeUrl(config.url || ''))
  const netInfo = net ? SOCIAL[net] : null

  // Colou o link de uma rede com o texto vazio (ou com o nome de outra rede
  // preenchido automaticamente antes): usa o nome da rede.
  function setUrl(v: string) {
    const n = detectSocial(normalizeUrl(v))
    const autoLabels = Object.values(SOCIAL).map(s => s.label)
    const patch: Record<string, any> = { url: v }
    if (n && (!config.label || autoLabels.includes(config.label))) patch.label = SOCIAL[n].label
    onChange(patch)
  }

  return (
    <Grid>
      <Field label="Link" hint="Endereço completo da página que o botão abre.">
        <TextInput value={config.url || ''} placeholder="https://instagram.com/suaescola" inputMode="url"
          onChange={e => setUrl(e.target.value)}
          onBlur={e => { const v = normalizeUrl(e.target.value); if (v !== config.url) onChange({ url: v }) }} />
      </Field>
      {netInfo && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#475569', background: '#F8FAFC', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px' }}>
          <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', background: netInfo.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
            dangerouslySetInnerHTML={{ __html: netInfo.svg.replace('<svg ', '<svg width="15" height="15" ') }} />
          <span style={{ lineHeight: 1.5 }}>
            <strong>{netInfo.label} reconhecido.</strong>{' '}
            {style === 'icon'
              ? 'Aparece como bolinha. Outros links marcados como “Ícone” logo antes ou depois ficam juntos na mesma fileira.'
              : style === 'button'
                ? 'Pode aparecer como botão ou como ícone (bolinha) — escolha abaixo.'
                : 'Como cartão, aparece com a cor e o ícone da rede.'}
          </span>
        </div>
      )}
      <Field label={netInfo && style === 'icon' ? 'Nome (aparece ao passar o mouse e pra leitores de tela)' : 'Texto do botão'} counter={{ value: config.label || '', max: 80 }}>
        <TextInput value={config.label || ''} maxLength={80} placeholder="Ex.: Nosso Instagram" onChange={e => onChange({ label: e.target.value })} />
      </Field>
      <Field label="Aparência">
        <Segmented value={style} onChange={v => onChange({ style: v })}
          options={[
            { value: 'button', label: 'Botão' },
            // Ícone só pra rede reconhecida (link comum não tem ícone próprio).
            ...(netInfo || style === 'icon' ? [{ value: 'icon' as LinkStyle, label: 'Ícone' }] : []),
            { value: 'card', label: 'Cartão' }, { value: 'featured', label: 'Destaque' },
          ]} />
        {style === 'icon' && !netInfo && <Warn>Esse link não é de uma rede social reconhecida: aparece como botão.</Warn>}
      </Field>
      {(style === 'card' || style === 'featured') && (
        <Field label="Descrição (opcional)" counter={{ value: config.description || '', max: 120 }} hint="Uma frase curta embaixo do título do cartão.">
          <TextInput value={config.description || ''} maxLength={120} placeholder="Ex.: Fotos do dia a dia da escola" onChange={e => onChange({ description: e.target.value || undefined })} />
        </Field>
      )}
      {!(style === 'icon' && netInfo) && <Field label={style === 'button' || style === 'icon' ? 'Miniatura (opcional)' : 'Imagem do cartão (opcional)'}
        hint={style === 'button' ? 'Aparece à esquerda do texto do botão.'
          : style === 'card' ? 'Quadrada, à esquerda. Sem imagem, aparece o ícone do link.'
          : 'Grande, em cima do título (proporção 16:9, ex.: 1200 × 675 px).'}>
        <ImagePicker institutionId={ctx.institutionId} value={config.thumbnail_url || null} height={style === 'featured' ? 110 : 56}
          maxWidth={style === 'featured' ? IMAGE_WIDTH.large : IMAGE_WIDTH.small}
          emptyLabel={style === 'button' ? 'Enviar miniatura' : 'Enviar imagem'} onError={ctx.onError}
          onChange={url => onChange({ thumbnail_url: url || undefined })} />
      </Field>}
    </Grid>
  )
}

function BannerForm({ config, onChange, ctx }: Pick<Props, 'config' | 'onChange' | 'ctx'>) {
  const aspect: BannerAspect = config.aspect === '16:9' ? '16:9' : '3:1'
  const info = BANNER_ASPECTS[aspect]
  const [natural, setNatural] = React.useState<number | null>(null)
  React.useEffect(() => setNatural(null), [config.image_url])
  // Proporção da imagem enviada × a do formato: mais de 15% de diferença
  // = parte da imagem vai ser cortada (a prévia abaixo mostra o corte).
  const cropped = natural !== null && Math.abs(natural - info.ratio) / info.ratio > 0.15
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try { onChange({ image_url: await uploadVitrineImage(ctx.institutionId, file) }) }
    catch (e: any) { ctx.onError(e?.message || 'Não foi possível enviar a imagem.') }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Grid>
      <Field label="Formato">
        <Segmented value={aspect} onChange={v => onChange({ aspect: v })}
          options={(Object.keys(BANNER_ASPECTS) as BannerAspect[]).map(k => ({ value: k, label: `${BANNER_ASPECTS[k].label} ${k}` }))} />
      </Field>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Imagem</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0F766E', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 999, padding: '2px 10px' }}>
            Tamanho recomendado: {info.size}
          </span>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          aria-label={config.image_url ? 'Trocar imagem do banner' : 'Enviar imagem do banner'}
          style={{
            marginTop: 6, width: '100%', aspectRatio: String(info.ratio), borderRadius: 12, overflow: 'hidden', padding: 0,
            cursor: busy ? 'wait' : 'pointer', border: config.image_url ? '1px solid #e2e8f0' : '1.5px dashed #CBD5E1',
            background: config.image_url ? '#f8fafc' : '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#64748b', fontSize: 13, fontWeight: 600, gap: 6, position: 'relative',
          }}>
          {config.image_url
            ? <img src={config.image_url} alt="" onLoad={e => setNatural(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <><ImagePlus size={18} /> {busy ? 'Enviando…' : `Enviar imagem (${info.size})`}</>}
          {busy && config.image_url && <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Enviando…</span>}
        </button>
        <p style={hintStyle}>
          A prévia acima já mostra o corte na proporção {aspect}. JPG, PNG ou WebP; fotos grandes são reduzidas antes de enviar.
          {config.image_url && <> <button type="button" onClick={() => onChange({ image_url: '' })} style={{ background: 'none', border: 'none', padding: 0, color: '#dc2626', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Remover imagem</button></>}
        </p>
        {cropped && <Warn>A imagem enviada tem outra proporção: as bordas vão ser cortadas como na prévia acima. Pra aparecer inteira, use {info.size}.</Warn>}
        <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={e => pick(e.target.files?.[0])} />
      </div>
      <Field label="Descrição da imagem" counter={{ value: config.alt || '', max: 150 }}
        hint="Pra quem usa leitor de tela. Ex.: “Matrículas 2027 abertas — Educação Infantil ao Ensino Médio”.">
        <TextInput value={config.alt || ''} maxLength={150} onChange={e => onChange({ alt: e.target.value })} />
      </Field>
      <Field label="Link ao tocar no banner (opcional)" hint="Sem link, o banner é só imagem.">
        <TextInput value={config.link_url || ''} placeholder="https://..." inputMode="url"
          onChange={e => onChange({ link_url: e.target.value })}
          onBlur={e => { const v = normalizeUrl(e.target.value); if (v !== config.link_url) onChange({ link_url: v }) }} />
      </Field>
    </Grid>
  )
}

function GalleryForm({ config, onChange, ctx }: Pick<Props, 'config' | 'onChange' | 'ctx'>) {
  const images: { url: string; caption?: string }[] = Array.isArray(config.images) ? config.images : []
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const set = (imgs: typeof images) => onChange({ images: imgs })

  async function add(files: FileList | null) {
    if (!files?.length) return
    const room = 12 - images.length
    const list = Array.from(files).slice(0, room)
    if (files.length > room) ctx.onError(`A galeria aceita até 12 imagens — ${files.length - room} ficaram de fora.`)
    setBusy(true)
    const added: typeof images = []
    for (const f of list) {
      try { added.push({ url: await uploadVitrineImage(ctx.institutionId, f) }) }
      catch (e: any) { ctx.onError(e?.message || 'Não foi possível enviar a imagem.') }
    }
    setBusy(false)
    if (added.length) set([...images, ...added])
    if (inputRef.current) inputRef.current.value = ''
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= images.length) return
    const next = [...images];[next[i], next[j]] = [next[j], next[i]]
    set(next)
  }

  const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }

  return (
    <Grid>
      <Field label="Layout">
        <Segmented value={config.layout === 'carousel' ? 'carousel' : 'grid'} onChange={v => onChange({ layout: v })}
          options={[{ value: 'grid', label: 'Grade' }, { value: 'carousel', label: 'Carrossel' }]} />
      </Field>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Imagens</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{images.length}/12</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          {images.map((img, i) => (
            <div key={img.url + i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <img src={img.url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flex: 'none', border: '1px solid #e2e8f0' }} />
              <TextInput value={img.caption || ''} maxLength={150} placeholder="Legenda (opcional)"
                onChange={e => set(images.map((x, k) => k === i ? { ...x, caption: e.target.value } : x))} />
              <button type="button" style={iconBtn} title="Subir" aria-label="Subir imagem" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={13} /></button>
              <button type="button" style={iconBtn} title="Descer" aria-label="Descer imagem" onClick={() => move(i, 1)} disabled={i === images.length - 1}><ArrowDown size={13} /></button>
              <button type="button" style={{ ...iconBtn, color: '#dc2626' }} title="Remover" aria-label="Remover imagem" onClick={() => set(images.filter((_, k) => k !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
          {images.length < 12 && (
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
              style={{ height: 52, borderRadius: 10, border: '1.5px dashed #CBD5E1', background: '#FAFAFA', cursor: busy ? 'wait' : 'pointer', color: '#64748b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ImagePlus size={15} /> {busy ? 'Enviando…' : 'Adicionar imagens'}
            </button>
          )}
          <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={e => add(e.target.files)} />
        </div>
        <p style={hintStyle}>JPG, PNG ou WebP. Fotos grandes são reduzidas automaticamente antes de enviar.</p>
      </div>
    </Grid>
  )
}

function HoursForm({ config, onChange }: Pick<Props, 'config' | 'onChange'>) {
  const days: { dow: number; open?: string; close?: string; closed?: boolean }[] = Array.isArray(config.days) ? config.days : []
  const get = (dow: number) => days.find(d => d.dow === dow) || { dow, closed: true }
  const setDay = (dow: number, patch: Record<string, any>) => {
    const cur = get(dow)
    const next = { ...cur, ...patch }
    if (!next.closed) { next.open = next.open || '07:00'; next.close = next.close || '18:00' }
    onChange({ days: [...days.filter(d => d.dow !== dow), next].sort((a, b) => DAY_ORDER.indexOf(a.dow) - DAY_ORDER.indexOf(b.dow)) })
  }
  const time: React.CSSProperties = { width: 96, padding: '7px 8px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#FAFAFA', fontSize: 13, fontFamily: 'inherit' }

  return (
    <Grid>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {DAY_ORDER.map(dow => {
          const d = get(dow)
          return (
            <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 110, fontSize: 13, color: '#1e293b', cursor: 'pointer' }}>
                <input type="checkbox" checked={!d.closed} onChange={e => setDay(dow, { closed: !e.target.checked })} style={{ accentColor: '#00A896' }} />
                {DAYS[dow]}
              </label>
              {d.closed
                ? <span style={{ fontSize: 13, color: '#94a3b8' }}>Fechado</span>
                : <>
                    <input type="time" aria-label={`${DAYS[dow]}: abre`} value={d.open || ''} onChange={e => setDay(dow, { open: e.target.value })} style={time} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>até</span>
                    <input type="time" aria-label={`${DAYS[dow]}: fecha`} value={d.close || ''} onChange={e => setDay(dow, { close: e.target.value })} style={time} />
                  </>}
            </div>
          )
        })}
      </div>
      <Field label="Observação (opcional)" counter={{ value: config.note || '', max: 200 }}>
        <TextInput value={config.note || ''} maxLength={200} placeholder="Ex.: Visitas com agendamento" onChange={e => onChange({ note: e.target.value })} />
      </Field>
    </Grid>
  )
}
