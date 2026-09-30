// =============================================================================
// src/pages/gestor/Vitrine.tsx
//
// Editor da "Vitrine Áion": a página pública tipo Linktree da escola em
// aionedu.com.br/<slug> (banco: 20260929060000_vitrine.sql; página pública:
// api/_lib/vitrinePage.ts). Três abas — Blocos, Aparência, Configurações —
// e prévia ao vivo com o MESMO renderizador da página publicada
// (api/_lib/vitrineRender.ts, em iframe isolado).
//
// Salvamento automático (800 ms depois da última edição):
//   - página: um update por vez (fila), com o rascunho mais recente;
//   - blocos: fila por bloco; bloco novo só vai pro banco quando fica válido
//     (validateBlock, espelho do banco) e aparece como "Incompleto" até lá;
//     depois de cada bloco novo e de cada arraste, a ordem é regravada
//     (vitrine_reorder_blocks);
//   - imagem que saiu da página só é apagada do bucket DEPOIS do save.
// O gatilho do Captação dos blocos de WhatsApp é criado/atualizado/arquivado
// pelo próprio banco (trigger em vitrine_blocks) — aqui só aparece o selo.
// =============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Store, Plus, Check, ExternalLink, Loader2, Eye, EyeOff, X, AlertCircle, AlertTriangle, Smartphone, Copy, Play,
  Monitor, LayoutList, Palette, SlidersHorizontal, Globe, Layers, MousePointerClick, Users, Share2, BarChart3,
} from 'lucide-react'
import { arrayMove } from '@dnd-kit/sortable'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  type BlockType, type VitrineBlockRow, type VitrinePageRow,
  BLOCK_TYPES, blockSummary, scheduleState, fmtWhen, VITRINE_MAX_BLOCKS, defaultConfig, validateBlock, buildPreviewData,
  blockImageUrls, removeVitrineImage, publicUrl, VITRINE_SITE_URL, readTheme,
} from '../../lib/vitrine'
import { renderVitrinePage } from '../../../api/_lib/vitrineRender'
import BlockList, { type EditorBlock, BLOCK_ICONS } from '../../components/vitrine/BlockList'
import BlockGallery from '../../components/vitrine/BlockGallery'
import BlockEditor from '../../components/vitrine/BlockEditor'
import { KpiCard } from '../../components/transmissoes/ui'
import AppearancePanel from '../../components/vitrine/AppearancePanel'
import SettingsPanel from '../../components/vitrine/SettingsPanel'
import SocialLinksEditor from '../../components/vitrine/SocialLinksEditor'
import { DS } from '../../components/vitrine/ui'
import ScheduleFields, { scheduleError } from '../../components/vitrine/ScheduleFields'

type Tab = 'blocks' | 'social' | 'appearance' | 'settings' | 'stats'
type PageSaveState = 'saved' | 'dirty' | 'saving' | 'error'

interface InstitutionInfo { name: string; logo_url: string | null; primary_color: string | null; address: string | null }
interface SavedBlock { type: BlockType; config: Record<string, any> }

const SAVE_DELAY = 800
const PAGE_FIELDS = ['title', 'bio', 'logo_url', 'cover_url', 'theme', 'seo_description', 'social_links', 'floating_block_id', 'show_share', 'social_position', 'cover_video_url', 'publish_at', 'unpublish_at'] as const

let tempSeq = 0
const tempKey = () => `novo-${Date.now()}-${++tempSeq}`
const normMsg = (s: unknown) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

// Mensagem de WhatsApp que vira gatilho do Captação (pra avisar duplicata).
function captureMessage(b: EditorBlock): string | null {
  if (b.type === 'whatsapp' && b.config.phone_source !== 'custom' && b.config.track_capture !== false) return normMsg(b.config.message)
  if (b.type === 'enroll' && b.config.mode === 'whatsapp') return normMsg(b.config.message)
  return null
}

export default function Vitrine() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || ''

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState<VitrinePageRow | null>(null)
  const [pageState, setPageState] = useState<PageSaveState>('saved')
  const [pageError, setPageError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<EditorBlock[]>([])
  const [institution, setInstitution] = useState<InstitutionInfo>({ name: '', logo_url: null, primary_color: null, address: null })
  const [schoolPhone, setSchoolPhone] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('blocks')
  const [openKey, setOpenKey] = useState<string | null>(null)
  // Adicionar bloco: undefined = fechado; null = no fim; número = posição.
  const [pickerAt, setPickerAt] = useState<number | null | undefined>(undefined)
  const showPicker = pickerAt !== undefined
  const setShowPicker = (open: boolean) => setPickerAt(open ? null : undefined)
  // Microinterações da lista: destaque ao voltar da edição / bloco novo.
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const [headerH, setHeaderH] = useState(120)
  const [deleteTarget, setDeleteTarget] = useState<EditorBlock | null>(null)
  const [scheduleDraft, setScheduleDraft] = useState<{ key: string; from: string | null; until: string | null } | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1180)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
  // Indicadores dos últimos 7 dias (vitrine_stats; o painel completo é a Fase 4).
  const [stats7, setStats7] = useState<{ views: number; visitors: number; clicks: number } | null>(null)

  // Espelhos pra código assíncrono (timers/filas) ler o estado mais novo.
  const pageRef = useRef<VitrinePageRow | null>(null)
  const savedPageRef = useRef<VitrinePageRow | null>(null)
  const blocksRef = useRef<EditorBlock[]>([])
  const savedBlocksRef = useRef<Map<string, SavedBlock>>(new Map())
  const pageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageChain = useRef<Promise<void>>(Promise.resolve())
  const blockTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const blockChains = useRef<Map<string, Promise<void>>>(new Map())

  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  const showToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error })
    setTimeout(() => setToast(t => (t?.msg === msg ? null : t)), error ? 6000 : 3500)
  }, [])

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1180)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Carga ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!institutionId) return
    let cancelled = false
    ;(async () => {
      setLoading(true); setLoadError(null)
      const { data: pg, error: pgErr } = await supabase.rpc('vitrine_ensure_page', { p_institution_id: institutionId })
      if (cancelled) return
      if (pgErr || !pg) { setLoadError(pgErr?.message || 'Não foi possível abrir a Vitrine.'); setLoading(false); return }
      const pageRow = pg as VitrinePageRow
      const [blkRes, instRes, phoneRes] = await Promise.all([
        supabase.from('vitrine_blocks').select('id, institution_id, page_id, type, position, is_visible, config, capture_trigger_id, visible_from, visible_until')
          .eq('page_id', pageRow.id).order('position').order('created_at'),
        supabase.from('institutions').select('name, logo_url, primary_color, address').eq('id', institutionId).maybeSingle(),
        supabase.from('whatsapp_phone_numbers').select('phone_number').eq('institution_id', institutionId).eq('is_active', true)
          .order('created_at').limit(1).maybeSingle(),
      ])
      if (cancelled) return
      if (blkRes.error) { setLoadError(blkRes.error.message); setLoading(false); return }
      const rows = (blkRes.data || []) as VitrineBlockRow[]
      const saved = new Map<string, SavedBlock>()
      const eb: EditorBlock[] = rows.map(r => {
        saved.set(r.id, { type: r.type, config: r.config })
        return { key: r.id, id: r.id, type: r.type, config: r.config, is_visible: r.is_visible, capture_trigger_id: r.capture_trigger_id, visible_from: r.visible_from ?? null, visible_until: r.visible_until ?? null, state: 'saved', error: null }
      })
      savedBlocksRef.current = saved
      savedPageRef.current = pageRow
      setPage(pageRow)
      setBlocks(eb)
      const inst = instRes.data as any
      setInstitution({ name: inst?.name || '', logo_url: inst?.logo_url || null, primary_color: inst?.primary_color || null, address: inst?.address || null })
      setSchoolPhone((phoneRes.data as any)?.phone_number || null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [institutionId])

  // Visitas e cliques dos últimos 7 dias (RLS: só a própria escola). Sem
  // dado ainda = 0; erro = indicador some (não trava o editor).
  useEffect(() => {
    if (!institutionId || loading) return
    const end = new Date(), start = new Date(end.getTime() - 7 * 86400000)
    supabase.rpc('vitrine_stats', { p_institution_id: institutionId, p_start: start.toISOString(), p_end: end.toISOString() })
      .then(({ data, error }) => {
        if (error) { setStats7(null); return }
        const rows = (data || []) as { block_id: string | null; event_type: string; events: number; visitors: number }[]
        const views = rows.filter(r => r.event_type === 'view')
        setStats7({
          views: views.reduce((s, r) => s + Number(r.events), 0),
          visitors: views.reduce((s, r) => s + Number(r.visitors), 0),
          clicks: rows.filter(r => r.event_type === 'click').reduce((s, r) => s + Number(r.events), 0),
        })
      })
  }, [institutionId, loading])

  // Aviso ao sair com alteração pendente.
  const pending = pageState === 'dirty' || pageState === 'saving' || blocks.some(b => b.state === 'dirty' || b.state === 'saving')
  useEffect(() => {
    if (!pending) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [pending])

  // ── Página: rascunho + salvamento automático ───────────────────────────────
  const flushPage = useCallback(async () => {
    const p = pageRef.current
    if (!p) return
    const payload: Record<string, any> = {}
    for (const f of PAGE_FIELDS) payload[f] = (p as any)[f]
    setPageState('saving')
    const { error } = await supabase.from('vitrine_pages').update(payload).eq('id', p.id)
    if (error) { setPageState('error'); setPageError(error.message); return }
    const prev = savedPageRef.current
    savedPageRef.current = { ...(prev || p), ...payload } as VitrinePageRow
    if (prev && prev.logo_url !== p.logo_url) removeVitrineImage(institutionId, prev.logo_url)
    if (prev && prev.cover_url !== p.cover_url) removeVitrineImage(institutionId, prev.cover_url)
    if (prev && prev.cover_video_url && prev.cover_video_url !== p.cover_video_url) removeVitrineImage(institutionId, prev.cover_video_url)
    const prevBg = (prev?.theme as any)?.bg_image_url, curBg = (p.theme as any)?.bg_image_url
    if (prev && prevBg && prevBg !== curBg) removeVitrineImage(institutionId, prevBg)
    setPageError(null)
    // Se editaram durante o save, o timer pendente salva de novo.
    setPageState(PAGE_FIELDS.some(f => JSON.stringify((pageRef.current as any)?.[f]) !== JSON.stringify(payload[f])) ? 'dirty' : 'saved')
  }, [institutionId])

  const updatePage = useCallback((patch: Partial<VitrinePageRow>) => {
    setPage(p => (p ? { ...p, ...patch } : p))
    setPageState('dirty'); setPageError(null)
    if (pageTimer.current) clearTimeout(pageTimer.current)
    pageTimer.current = setTimeout(() => { pageChain.current = pageChain.current.then(flushPage) }, SAVE_DELAY)
  }, [flushPage])

  // ── Blocos ──────────────────────────────────────────────────────────────────
  const patchBlock = (key: string, patch: Partial<EditorBlock>) =>
    setBlocks(bs => bs.map(b => (b.key === key ? { ...b, ...patch } : b)))

  const reorderRemote = useCallback(async () => {
    const p = pageRef.current
    const ids = blocksRef.current.filter(b => b.id).map(b => b.id!)
    if (!p || !ids.length) return
    const { error } = await supabase.rpc('vitrine_reorder_blocks', { p_page_id: p.id, p_block_ids: ids })
    if (error) showToast(`Não foi possível salvar a ordem: ${error.message}`, true)
  }, [showToast])

  const flushBlock = useCallback(async (key: string) => {
    const b = blocksRef.current.find(x => x.key === key)
    const p = pageRef.current
    if (!b || !p) return
    const invalid = validateBlock(b.type, b.config)
    if (invalid) { patchBlock(key, { state: 'invalid', error: invalid }); return }

    const snapshot = b.config
    patchBlock(key, { state: 'saving', error: null })
    let id = b.id
    let captureId: string | null = b.capture_trigger_id
    if (!id) {
      const position = blocksRef.current.findIndex(x => x.key === key) + 1
      const { data, error } = await supabase.from('vitrine_blocks')
        .insert({ institution_id: institutionId, page_id: p.id, type: b.type, position, config: snapshot, is_visible: b.is_visible })
        .select('id, capture_trigger_id').single()
      if (error || !data) { patchBlock(key, { state: 'error', error: error?.message || 'Erro ao salvar.' }); return }
      id = (data as any).id; captureId = (data as any).capture_trigger_id
      // Excluído enquanto era criado: apaga a linha que acabou de nascer.
      if (!blocksRef.current.some(x => x.key === key)) {
        await supabase.from('vitrine_blocks').delete().eq('id', id)
        return
      }
      patchBlock(key, { id })
      blocksRef.current = blocksRef.current.map(x => (x.key === key ? { ...x, id } : x))
      reorderRemote()
    } else {
      const { data, error } = await supabase.from('vitrine_blocks')
        .update({ type: b.type, config: snapshot }).eq('id', id)
        .select('capture_trigger_id').single()
      if (error) { patchBlock(key, { state: 'error', error: error.message }); return }
      captureId = (data as any)?.capture_trigger_id ?? null
    }

    const prev = savedBlocksRef.current.get(key)
    savedBlocksRef.current.set(key, { type: b.type, config: snapshot })
    if (prev) {
      const keep = new Set(blockImageUrls(b.type, snapshot))
      blockImageUrls(prev.type, prev.config).filter(u => !keep.has(u)).forEach(u => removeVitrineImage(institutionId, u))
    }
    const now = blocksRef.current.find(x => x.key === key)
    patchBlock(key, { capture_trigger_id: captureId, state: now && now.config !== snapshot ? 'dirty' : 'saved', error: null })
  }, [institutionId, reorderRemote])

  const enqueueBlock = useCallback((key: string, delay = SAVE_DELAY) => {
    const t = blockTimers.current.get(key)
    if (t) clearTimeout(t)
    blockTimers.current.set(key, setTimeout(() => {
      blockTimers.current.delete(key)
      const chain = blockChains.current.get(key) || Promise.resolve()
      blockChains.current.set(key, chain.then(() => flushBlock(key)))
    }, delay))
  }, [flushBlock])

  const changeBlock = useCallback((key: string, patch: Record<string, any>) => {
    setBlocks(bs => bs.map(b => {
      if (b.key !== key) return b
      const config = { ...b.config, ...patch }
      for (const k of Object.keys(config)) if (config[k] === undefined) delete config[k]
      return { ...b, config, state: 'dirty', error: null }
    }))
    enqueueBlock(key)
  }, [enqueueBlock])

  function addBlock(type: BlockType, at?: number, config?: Record<string, any>) {
    if (blocks.length >= VITRINE_MAX_BLOCKS) { showToast(`Limite de ${VITRINE_MAX_BLOCKS} blocos por página.`, true); return }
    const cfg = config || defaultConfig(type, { address: institution.address, placeName: institution.name })
    const invalid = validateBlock(type, cfg)
    // Bloco novo em branco não mostra o motivo de estar incompleto (seria
    // aviso antes de digitar); cópia mostra (ex.: banner duplicado sem imagem).
    const nb: EditorBlock = { key: tempKey(), id: null, type, config: cfg, is_visible: true, capture_trigger_id: null, state: invalid ? 'invalid' : 'dirty', error: config ? invalid : null }
    const next = [...blocks]
    next.splice(at ?? pickerAt ?? next.length, 0, nb)
    blocksRef.current = next
    setBlocks(next)
    setOpenKey(nb.key)
    setPickerAt(undefined)
    setTab('blocks')
    if (!invalid) enqueueBlock(nb.key, 0)
  }

  function duplicateBlock(key: string) {
    const i = blocks.findIndex(b => b.key === key)
    if (i < 0) return
    const src = blocks[i]
    const cfg = JSON.parse(JSON.stringify(src.config))
    if (cfg.label) cfg.label = `${cfg.label} (cópia)`.slice(0, 80)
    // Galeria/miniatura duplicadas apontam pras MESMAS imagens: se uma cópia
    // remover a foto, o arquivo não pode sumir da outra. Duplica sem imagens.
    if (src.type === 'gallery') cfg.images = []
    if (src.type === 'link') delete cfg.thumbnail_url
    if (src.type === 'banner') cfg.image_url = ''
    if (src.type === 'pdf') { cfg.file_url = ''; delete cfg.file_name; delete cfg.file_size }
    if ((src.type === 'testimonials' || src.type === 'team') && Array.isArray(cfg.items)) cfg.items.forEach((it: any) => { it.photo_url = '' })
    addBlock(src.type, i + 1, cfg)
  }

  async function toggleVisible(key: string) {
    const b = blocks.find(x => x.key === key)
    if (!b) return
    patchBlock(key, { is_visible: !b.is_visible })
    if (!b.id) return
    const { error } = await supabase.from('vitrine_blocks').update({ is_visible: !b.is_visible }).eq('id', b.id)
    if (error) { patchBlock(key, { is_visible: b.is_visible }); showToast(`Não foi possível ${b.is_visible ? 'ocultar' : 'mostrar'} o bloco: ${error.message}`, true) }
  }

  // Agenda do bloco: colunas próprias (fora do config), salva na hora.
  async function saveSchedule() {
    const d = scheduleDraft
    const b = d && blocks.find(x => x.key === d.key)
    if (!d || !b?.id) return
    setScheduleSaving(true)
    const { error } = await supabase.from('vitrine_blocks').update({ visible_from: d.from, visible_until: d.until }).eq('id', b.id)
    setScheduleSaving(false)
    if (error) { showToast(`Não foi possível salvar a agenda: ${error.message}`, true); return }
    patchBlock(d.key, { visible_from: d.from, visible_until: d.until })
    setScheduleDraft(null)
    showToast(d.from || d.until ? 'Agenda do bloco salva.' : 'Agenda removida: o bloco aparece sempre.')
  }

  async function confirmDelete() {
    const b = deleteTarget
    setDeleteTarget(null)
    if (!b) return
    const t = blockTimers.current.get(b.key)
    if (t) { clearTimeout(t); blockTimers.current.delete(b.key) }
    const prevBlocks = blocks
    const next = blocks.filter(x => x.key !== b.key)
    blocksRef.current = next
    setBlocks(next)
    if (openKey === b.key) setOpenKey(null)   // volta pra lista
    if (!b.id) return // ainda não salvo (se estiver sendo criado, o flush apaga)
    const { error } = await supabase.from('vitrine_blocks').delete().eq('id', b.id)
    if (error) {
      blocksRef.current = prevBlocks
      setBlocks(prevBlocks)
      showToast(`Não foi possível excluir: ${error.message}`, true)
      return
    }
    // O banco zera o flutuante que usava este bloco (ON DELETE SET NULL); o
    // editor acompanha, senão o próximo salvamento da página seria recusado.
    if (pageRef.current?.floating_block_id === b.id) updatePage({ floating_block_id: null })
    const saved = savedBlocksRef.current.get(b.key)
    savedBlocksRef.current.delete(b.key)
    if (saved) blockImageUrls(saved.type, saved.config).forEach(u => removeVitrineImage(institutionId, u))
    showToast(b.capture_trigger_id ? 'Bloco excluído. O gatilho no Captação foi arquivado (o histórico continua lá).' : 'Bloco excluído.')
  }

  function reorder(fromKey: string, toKey: string) {
    const from = blocks.findIndex(b => b.key === fromKey)
    const to = blocks.findIndex(b => b.key === toKey)
    if (from < 0 || to < 0) return
    const next = arrayMove(blocks, from, to)
    blocksRef.current = next
    setBlocks(next)
    reorderRemote()
  }

  // ── Publicação ──────────────────────────────────────────────────────────────
  async function togglePublish() {
    if (!page) return
    const publish = !page.is_published
    if (publish && !blocks.some(b => b.id && b.is_visible)) {
      showToast('Adicione pelo menos um bloco antes de publicar.', true)
      return
    }
    setPublishing(true)
    const { data, error } = await supabase.from('vitrine_pages').update({ is_published: publish }).eq('id', page.id)
      .select('is_published, published_at').single()
    setPublishing(false)
    if (error) { showToast(`Não foi possível ${publish ? 'publicar' : 'despublicar'}: ${error.message}`, true); return }
    setPage(p => (p ? { ...p, ...(data as any) } : p))
    showToast(publish ? 'Página publicada! Pode levar até 1 minuto pra aparecer no link.' : 'Página despublicada. O link mostra “Página não encontrada”.')
  }

  // ── Prévia (mesmo HTML da página pública, sem script) ──────────────────────
  const [previewHtml, setPreviewHtml] = useState('')
  // "Ver animação": a prévia normalmente fica sem a entrada animada (senão
  // repetiria a cada tecla); o botão renderiza uma vez com ela. O comentário
  // com o contador força o iframe a recarregar mesmo com HTML igual.
  const [animNonce, setAnimNonce] = useState(0)
  const animRequested = useRef(false)
  useEffect(() => {
    if (!page) return
    const t = setTimeout(() => {
      const animatePreview = animRequested.current
      animRequested.current = false
      const data = buildPreviewData(page, blocks.map(b => ({ id: b.id || b.key, type: b.type, config: b.config, is_visible: b.is_visible })),
        { schoolPhone, institutionName: institution.name })
      setPreviewHtml(renderVitrinePage(data, { siteUrl: VITRINE_SITE_URL, preview: true, animatePreview })
        + (animatePreview ? `<!--anim ${animNonce}-->` : ''))
    }, animRequested.current ? 0 : 250)
    return () => clearTimeout(t)
  }, [page, blocks, schoolPhone, institution.name, animNonce])

  const playAnimation = () => { animRequested.current = true; setAnimNonce(n => n + 1) }
  const hasAnimation = !!page && (page.theme as any)?.animation && (page.theme as any).animation !== 'none'

  // ── Derivados ───────────────────────────────────────────────────────────────
  const dupMessages = useMemo(() => {
    const count = new Map<string, number>()
    for (const b of blocks) { const m = captureMessage(b); if (m) count.set(m, (count.get(m) || 0) + 1) }
    return count
  }, [blocks])

  const incomplete = blocks.filter(b => b.state === 'invalid' || b.state === 'error').length
  const anySaving = pageState === 'saving' || blocks.some(b => b.state === 'saving')
  const anyDirty = pageState === 'dirty' || blocks.some(b => b.state === 'dirty')

  // ── Microinterações e prévia ligada ─────────────────────────────────────────
  // "Salvo agora": quando tudo que estava pendente termina de salvar.
  const busy = anySaving || anyDirty
  const wasBusy = useRef(false)
  useEffect(() => {
    if (wasBusy.current && !busy && pageState !== 'error' && !blocks.some(b => b.state === 'error')) {
      setJustSaved(true)
      const t = setTimeout(() => setJustSaved(false), 2500)
      wasBusy.current = busy
      return () => clearTimeout(t)
    }
    wasBusy.current = busy
  }, [busy]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clique num bloco da prévia abre a edição dele (postMessage do iframe
  // isolado; só aceita mensagem do próprio iframe e id de bloco existente).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return
      const id = (e.data as any)?.vitrinePick
      if (typeof id !== 'string') return
      const b = blocksRef.current.find(x => (x.id || x.key) === id)
      if (!b) return
      setTab('blocks'); setOpenKey(b.key); setPreviewOpen(false)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Altura do cabeçalho fixo (a prévia gruda logo abaixo dele).
  useEffect(() => {
    const el = headerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setHeaderH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  })

  function openBlock(key: string) { setOpenKey(key) }
  function backToList() {
    const k = openKey
    setOpenKey(null)
    if (k) { setFlashKey(k); setTimeout(() => setFlashKey(f => (f === k ? null : f)), 1200) }
  }
  function goTab(t: Tab) { setTab(t); if (t !== 'blocks') setOpenKey(null) }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: '#f8f9fb', minHeight: '100%' }}>
        {[...Array(4)].map((_, i) => <div key={i} style={{ height: i ? 64 : 48, borderRadius: 12, background: '#eef2f6' }} className="animate-pulse" />)}
      </div>
    )
  }
  if (loadError || !page) {
    return (
      <div style={{ padding: 24, background: '#f8f9fb', minHeight: '100%' }}>
        <div style={{ maxWidth: 520, margin: '48px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: DS.shadowSm }}>
          <AlertCircle size={28} color="#dc2626" />
          <p style={{ margin: '10px 0 4px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>Não foi possível abrir a Vitrine</p>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{loadError}</p>
        </div>
      </div>
    )
  }

  // Situação da página, contando a agenda (Configurações → Agendamento).
  const pageSched = scheduleState(page.publish_at, page.unpublish_at)
  const pageStatus = !page.is_published
    ? { label: 'Rascunho', hint: 'Só você vê — publique quando estiver pronta', bg: '#F1F5F9', color: '#64748B' }
    : pageSched === 'future'
      ? { label: 'Agendada', hint: `Entra no ar em ${fmtWhen(page.publish_at!)}`, bg: '#FEF3C7', color: '#D97706' }
      : pageSched === 'expired'
        ? { label: 'Fora do ar', hint: `Saiu do ar em ${fmtWhen(page.unpublish_at!)} (agendamento)`, bg: '#FEF2F2', color: '#DC2626' }
        : { label: 'Publicada', hint: page.unpublish_at ? `No ar até ${fmtWhen(page.unpublish_at)}` : 'Visível pra quem tem o link', bg: '#D1FAE5', color: '#059669' }

  // Selo de salvamento (centro do cabeçalho): erro > salvando > "Salvo agora"
  // (2,5 s logo depois de salvar) > incompleto > "Tudo salvo".
  const firstProblem = blocks.find(b => b.state === 'error') || blocks.find(b => b.state === 'invalid')
  const blockError = blocks.some(b => b.state === 'error')
  const save = pageState === 'error' || blockError
    ? { tone: 'error', text: pageState === 'error' ? 'Erro ao salvar a aparência' : 'Erro ao salvar um bloco', click: !!firstProblem }
    : busy ? { tone: 'saving', text: 'Salvando…', click: false }
    : justSaved ? { tone: 'saved', text: 'Salvo agora', click: false }
    : incomplete > 0 ? { tone: 'warn', text: incomplete === 1 ? '1 bloco incompleto' : `${incomplete} blocos incompletos`, click: true }
    : { tone: 'idle', text: 'Tudo salvo', click: false }
  const SAVE_TONE: Record<string, React.CSSProperties> = {
    error: { background: '#FEF2F2', color: '#DC2626' }, saving: { background: '#E6F7F5', color: '#00A896' },
    warn: { background: '#FEF3C7', color: '#D97706' }, saved: { background: '#D1FAE5', color: '#059669' }, idle: { background: '#F1F5F9', color: '#64748B' },
  }

  const editing = tab === 'blocks' && openKey ? blocks.find(b => b.key === openKey) || null : null
  const selectedPreviewId = editing ? (editing.id || editing.key) : null
  // Prévia: o HTML da página + destaque do bloco em edição + clique pra editar.
  const previewDoc = previewHtml + `<style>
[data-pb]{cursor:pointer;outline:2px solid transparent;outline-offset:4px;border-radius:14px;transition:outline-color .2s ease}
[data-pb]:hover{outline-color:rgba(0,168,150,.45)}
${selectedPreviewId ? `[data-pb="${selectedPreviewId.replace(/[^a-zA-Z0-9-]/g, '')}"]{outline:2px solid #00A896!important;position:relative}
[data-pb="${selectedPreviewId.replace(/[^a-zA-Z0-9-]/g, '')}"]::before{content:'Editando';position:absolute;top:-11px;right:10px;z-index:5;font:700 10px/1 -apple-system,'Segoe UI',sans-serif;letter-spacing:.02em;background:#00A896;color:#fff;padding:4px 8px;border-radius:999px}` : ''}
</style><script>(function(){document.addEventListener('click',function(e){var el=e.target&&e.target.closest&&e.target.closest('[data-pb]');if(!el)return;e.preventDefault();e.stopPropagation();parent.postMessage({vitrinePick:el.getAttribute('data-pb')},'*')},true);
${selectedPreviewId ? `var s=document.querySelector('[data-pb="${selectedPreviewId.replace(/[^a-zA-Z0-9-]/g, '')}"]');if(s){var r=s.getBoundingClientRect(),se=document.scrollingElement||document.documentElement;se.scrollTop+=r.top-(innerHeight-r.height)/2}` : ''}})();</script>`

  const iframe = (style: React.CSSProperties) => (
    <iframe ref={iframeRef} title="Prévia da página" srcDoc={previewDoc} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      style={{ border: 0, display: 'block', background: '#fff', ...style }} />
  )
  // Celular: moldura com "ilha" no topo. Computador: janela de navegador com
  // a página em 1150 px de largura, reduzida pra caber no painel.
  const phoneFrame = (height: number | string) => device === 'mobile' ? (
    <div className="vit-device" style={{ position: 'relative', width: 380, maxWidth: '100%', height, borderRadius: 44, padding: 10, background: 'linear-gradient(160deg,#1e293b,#0f172a)', boxShadow: '0 24px 48px rgba(15,23,42,.18), 0 8px 16px rgba(0,168,150,.08)' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 34, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        {/* Barra de status com a "ilha" — a página começa abaixo dela, como no aparelho. */}
        <div aria-hidden="true" style={{ flex: 'none', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', background: '#fff', fontSize: 12, fontWeight: 700, color: '#0f172a', position: 'relative' }}>
          <span>9:41</span>
          <span style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', width: 92, height: 24, borderRadius: 999, background: '#0b1120' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 10 }}>{[4, 6, 8, 10].map(h => <span key={h} style={{ width: 3, height: h, borderRadius: 1, background: '#0f172a' }} />)}</span>
            <span style={{ width: 20, height: 10, borderRadius: 3, border: '1.5px solid #0f172a', padding: 1, display: 'flex' }}><span style={{ flex: 1, borderRadius: 1, background: '#0f172a' }} /></span>
          </span>
        </div>
        {iframe({ width: '100%', flex: 1, minHeight: 0 })}
      </div>
    </div>
  ) : (
    <div className="vit-device" style={{ width: 460, maxWidth: '100%', borderRadius: 12, overflow: 'hidden', background: '#fff', border: '1px solid #E2E8F0', boxShadow: DS.shadowXl }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
        {['#F87171', '#FBBF24', '#34D399'].map(c => <span key={c} aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
        <span style={{ flex: 1, marginLeft: 8, padding: '3px 10px', borderRadius: 6, background: '#fff', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {publicUrl(page.slug).replace(/^https:\/\//, '')}
        </span>
      </div>
      <div style={{ width: 460, height: 520, overflow: 'hidden' }}>
        {iframe({ width: 1150, height: 1300, transform: 'scale(0.4)', transformOrigin: 'top left' })}
      </div>
    </div>
  )

  const NAV: { key: Tab; label: string; Icon: React.ElementType; count?: number; soon?: boolean }[] = [
    { key: 'blocks', label: 'Blocos', Icon: LayoutList, count: blocks.length },
    { key: 'social', label: 'Redes sociais', Icon: Share2, count: (page.social_links || []).length || undefined },
    { key: 'appearance', label: 'Aparência', Icon: Palette },
    { key: 'settings', label: 'Configurações', Icon: SlidersHorizontal },
    { key: 'stats', label: 'Desempenho', Icon: BarChart3 },
  ]
  const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, boxShadow: DS.shadowSm, color: '#1e293b', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }
  const viewKey = tab === 'blocks' ? (editing ? `edit:${editing.key}` : 'list') : tab
  const viewAnim = tab === 'blocks' ? (editing ? 'vitInRight' : 'vitInLeft') : 'vitRise'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#f8f9fb' }}>
      {/* Movimento do editor: mesma transição do app (index.css --transition),
          sombras com tom teal (--shadow-sm/md/lg). Menos movimento = parado. */}
      <style>{`
        @keyframes vitInRight{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
        @keyframes vitInLeft{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}
        @keyframes vitRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes vitEnter{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes vitFlash{0%,100%{box-shadow:0 1px 3px rgba(0,168,150,0.06),0 1px 2px rgba(0,0,0,0.04)}30%{box-shadow:0 0 0 4px rgba(0,168,150,0.20),0 4px 16px rgba(0,168,150,0.10)}}
        @keyframes vitBlink{50%{opacity:.3}}
        @keyframes vitPop{from{transform:scale(0)}to{transform:scale(1)}}
        .vit-view{animation:var(--vit-anim) .28s cubic-bezier(0.4,0,0.2,1) backwards}
        .vit-group{animation:vitRise .32s cubic-bezier(0.4,0,0.2,1) backwards}
        .vit-card{transition:box-shadow .18s cubic-bezier(0.4,0,0.2,1),transform .18s cubic-bezier(0.4,0,0.2,1),border-color .18s cubic-bezier(0.4,0,0.2,1);box-shadow:0 1px 3px rgba(0,168,150,0.06),0 1px 2px rgba(0,0,0,0.04)}
        .vit-card:hover{border-color:#CBD5E1!important;box-shadow:0 4px 16px rgba(0,168,150,0.10),0 2px 4px rgba(0,0,0,0.04);transform:translateY(-1px)}
        .vit-card .vit-grip{opacity:0;transition:opacity .15s ease}
        .vit-card:hover .vit-grip,.vit-card:focus-within .vit-grip{opacity:1}
        .vit-card-focus:focus-visible{box-shadow:0 0 0 3px rgba(0,168,150,0.25)}
        .vit-card.vit-flash{animation:vitFlash 1.1s cubic-bezier(0.4,0,0.2,1)}
        .vit-card.vit-enter{animation:vitEnter .4s cubic-bezier(.34,1.56,.64,1)}
        .vit-lifted{box-shadow:0 24px 48px rgba(15,23,42,0.14),0 8px 16px rgba(0,168,150,0.08)!important;transform:rotate(-1.2deg) scale(1.02);cursor:grabbing}
        .vit-icon{transition:background .15s ease,color .15s ease}
        .vit-icon:hover{background:#F1F5F9!important;color:#1e293b!important}
        .vit-gap{position:relative;height:12px;display:flex;align-items:center}
        .vit-gap::before{content:'';position:absolute;left:18px;right:18px;height:2px;border-radius:2px;background:#00A896;opacity:0;transform:scaleX(.4);transition:all .2s cubic-bezier(0.4,0,0.2,1)}
        .vit-gap:hover::before{opacity:.35;transform:none}
        .vit-gap button{position:absolute;left:50%;z-index:2;width:24px;height:24px;border-radius:50%;border:1px solid #00A896;background:#fff;color:#00A896;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transform:translateX(-50%) scale(.6);transition:all .18s cubic-bezier(0.4,0,0.2,1)}
        .vit-gap:hover button,.vit-gap button:focus-visible{opacity:1;transform:translateX(-50%) scale(1)}
        .vit-btn{transition:all .18s cubic-bezier(0.4,0,0.2,1)}
        .vit-btn:hover:not(:disabled){box-shadow:0 4px 16px rgba(0,168,150,0.10),0 2px 4px rgba(0,0,0,0.04);transform:translateY(-1px)}
        .vit-btn:active:not(:disabled){transform:scale(.98)}
        .vit-ghost{transition:background .15s ease,color .15s ease}
        .vit-ghost:hover{background:#F1F5F9!important;color:#1e293b!important}
        .vit-nav{transition:background .18s ease,color .18s ease,box-shadow .18s ease}
        .vit-nav:hover:not([aria-selected="true"]){color:#1e293b!important}
        .vit-save{transition:background .25s ease,color .25s ease}
        .vit-save .vit-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}
        .vit-save[data-tone="saving"] .vit-dot{animation:vitBlink .8s ease infinite}
        .vit-save[data-tone="saved"] svg{animation:vitPop .35s cubic-bezier(.34,1.56,.64,1)}
        .vit-footbar{background:linear-gradient(to top,#f8f9fb 72%,rgba(248,249,251,0))}
        .vit-device{transition:width .3s cubic-bezier(0.4,0,0.2,1)}
        .vit-upload:focus-visible,.vit-pick:focus-visible{outline:3px solid #D1FAE5;outline-offset:2px}
        @media (max-width:760px){.vit-tags{display:none!important}}
        @media (prefers-reduced-motion: reduce){.vit-view,.vit-group,.vit-card,.vit-lifted,.vit-save *,.vit-gap *,[role=dialog]{transition:none!important;animation:none!important}}
      `}</style>
      {toast && (
        <div role="status" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999, maxWidth: 420,
          background: toast.error ? '#991B1B' : '#1e2d6b', color: 'white', fontSize: 13, fontWeight: 500,
          padding: '14px 18px', borderRadius: 12, boxShadow: '0 12px 32px rgba(15,23,42,0.22), 0 4px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 8, alignItems: 'flex-start', animation: 'slideInRight 0.2s ease',
        }}>
          {toast.error ? <AlertCircle size={15} style={{ flex: 'none', marginTop: 1 }} /> : <Check size={15} style={{ flex: 'none', marginTop: 1 }} />} {toast.msg}
        </div>
      )}

      {/* ── Cabeçalho fixo: identidade · salvamento · ação principal; e a
          navegação entre as áreas (abas em pílula, padrão do painel) ────── */}
      <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(248,249,251,0.92)', backdropFilter: 'saturate(180%) blur(8px)', WebkitBackdropFilter: 'saturate(180%) blur(8px)', borderBottom: '1px solid #E2E8F0', padding: '18px 24px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={18} color="#00A896" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Vitrine</h1>
              <span title={pageStatus.hint} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: pageStatus.bg, color: pageStatus.color, transition: 'all .25s ease' }}>{pageStatus.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <a href={publicUrl(page.slug)} target="_blank" rel="noopener noreferrer" style={{ color: '#00A896', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {publicUrl(page.slug).replace(/^https:\/\//, '')}
              </a>
              <button type="button" title="Copiar link" aria-label="Copiar link" className="vit-ghost"
                onClick={() => navigator.clipboard.writeText(publicUrl(page.slug)).then(() => showToast('Link copiado.'), () => {})}
                style={{ background: 'none', border: 'none', padding: 4, borderRadius: 6, cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                <Copy size={13} />
              </button>
            </p>
          </div>

          <button type="button" className="vit-save" data-tone={save.tone} aria-live="polite" disabled={!save.click}
            onClick={() => { if (firstProblem) { setTab('blocks'); setOpenKey(firstProblem.key) } }}
            title={save.click ? 'Abrir o bloco' : undefined}
            style={{ ...SAVE_TONE[save.tone], display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 999, border: 'none', fontSize: 13, fontWeight: 600, cursor: save.click ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
            {save.tone === 'saved' || save.tone === 'idle' ? <Check size={14} /> : save.tone === 'error' ? <AlertCircle size={14} /> : <span className="vit-dot" />}
            {save.text}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {stats7 && (
              <button type="button" onClick={() => goTab('stats')} className="vit-ghost" title="Últimos 7 dias"
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 10px', borderRadius: 10, border: 'none', background: 'transparent', fontSize: 12, color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <span><strong style={{ color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{stats7.views.toLocaleString('pt-BR')}</strong> visitas</span>
                <span><strong style={{ color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{stats7.clicks.toLocaleString('pt-BR')}</strong> cliques</span>
                <span style={{ color: '#94a3b8' }}>7 dias</span>
              </button>
            )}
            {!wide && (
              <button type="button" onClick={() => setPreviewOpen(true)} className="vit-btn" style={btn}>
                <Smartphone size={15} /> Prévia
              </button>
            )}
            {page.is_published && (
              <a href={publicUrl(page.slug)} target="_blank" rel="noopener noreferrer" className="vit-btn" style={btn}>
                <ExternalLink size={15} /> Ver página
              </a>
            )}
            <button type="button" onClick={togglePublish} disabled={publishing} className="vit-btn"
              style={page.is_published
                ? { ...btn, color: '#64748b', cursor: publishing ? 'wait' : 'pointer' }
                : { ...btn, border: '1px solid #00A896', background: '#00A896', color: '#fff', boxShadow: '0 4px 14px rgba(0,168,150,0.25)', padding: '9px 20px', cursor: publishing ? 'wait' : 'pointer' }}>
              {publishing ? <Loader2 size={15} className="animate-spin" /> : page.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
              {page.is_published ? 'Despublicar' : 'Publicar página'}
            </button>
          </div>
        </div>

        <div role="tablist" aria-label="Áreas do editor" style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
          {NAV.map(t => {
            const sel = tab === t.key
            return (
              <button key={t.key} role="tab" aria-selected={sel} onClick={() => goTab(t.key)} className="vit-nav" style={{
                display: 'flex', alignItems: 'center', gap: 7, flex: 'none',
                padding: '8px 16px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: sel ? '#fff' : 'transparent', color: sel ? '#1e2d6b' : '#64748b',
                boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
              }}>
                <t.Icon size={15} color={sel ? '#00A896' : '#94a3b8'} /> {t.label}
                {t.count !== undefined && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: sel ? '#E6F7F5' : '#E2E8F0', color: sel ? '#00A896' : '#64748b', fontVariantNumeric: 'tabular-nums' }}>{t.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pageError && (
          <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 12, padding: '12px 16px', fontSize: 13, lineHeight: 1.5, display: 'flex', gap: 10 }}>
            <AlertCircle size={15} style={{ flex: 'none', marginTop: 1 }} /> {pageError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
          {/* ── Área de trabalho: lista ↔ edição, ou a área escolhida ─────── */}
          <div key={viewKey} role="tabpanel" className="vit-view" style={{ ['--vit-anim' as any]: viewAnim, flex: 1, minWidth: 0, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tab === 'blocks' && editing && (
              <BlockEditor block={editing}
                ctx={{
                  institutionId, schoolPhone, onError: msg => showToast(msg, true),
                  duplicateMessage: (() => { const m = captureMessage(editing); return !!m && (dupMessages.get(m) || 0) > 1 })(),
                  hasCaptureTrigger: !!editing.capture_trigger_id, institutionName: institution.name,
                }}
                onChange={patch => changeBlock(editing.key, patch)}
                onBack={backToList}
                onToggleVisible={() => toggleVisible(editing.key)}
                onSchedule={() => setScheduleDraft({ key: editing.key, from: editing.visible_from ?? null, until: editing.visible_until ?? null })}
                onDuplicate={() => duplicateBlock(editing.key)}
                onDelete={() => setDeleteTarget(editing)} />
            )}

            {tab === 'blocks' && !editing && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e2d6b', letterSpacing: '-0.01em' }}>Blocos da página</h2>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                      {blocks.length ? 'Clique num bloco para editar. Arraste pela alça para mudar a ordem.' : 'Botões e informações que aparecem na página, na ordem da lista.'}
                    </p>
                  </div>
                  {blocks.length > 0 && (
                    <button type="button" onClick={() => setShowPicker(true)} disabled={blocks.length >= VITRINE_MAX_BLOCKS} className="vit-btn"
                      style={{ ...btn, border: '1px solid #00A896', background: '#00A896', color: '#fff', boxShadow: '0 4px 14px rgba(0,168,150,0.25)' }}>
                      <Plus size={15} /> Adicionar bloco
                    </button>
                  )}
                </div>
                {blocks.length === 0 ? (
                  <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', padding: '48px 28px', textAlign: 'center', boxShadow: DS.shadowSm }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Store size={24} color="#00A896" />
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#1e2d6b', letterSpacing: '-0.01em' }}>Monte a página da escola</p>
                    <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', maxWidth: 440, marginInline: 'auto', lineHeight: 1.6 }}>
                      Adicione os botões e informações que as famílias precisam: WhatsApp, matrícula, redes sociais, endereço e horário.
                    </p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {(['whatsapp', 'enroll', 'link'] as BlockType[]).map(t => {
                        const Icon = BLOCK_ICONS[t]
                        return (
                          <button key={t} type="button" onClick={() => addBlock(t)} className="vit-btn" style={btn}>
                            <Icon size={15} color={BLOCK_TYPES[t].color} /> {BLOCK_TYPES[t].label}
                          </button>
                        )
                      })}
                      <button type="button" onClick={() => setShowPicker(true)} className="vit-btn"
                        style={{ ...btn, border: '1px solid #00A896', background: '#00A896', color: '#fff', boxShadow: '0 4px 14px rgba(0,168,150,0.25)' }}>
                        <Plus size={15} /> Outros blocos
                      </button>
                    </div>
                  </div>
                ) : (
                  <BlockList blocks={blocks} flashKey={flashKey} enterKey={null}
                    onSelect={openBlock} onReorder={reorder} onToggleVisible={toggleVisible}
                    onInsertAt={i => setPickerAt(i)} />
                )}
              </>
            )}

            {tab === 'social' && (
              <SocialLinksEditor links={page.social_links || []} theme={readTheme(page.theme)} schoolPhone={schoolPhone}
                onChange={social_links => updatePage({ social_links })}
                onThemeChange={patch => updatePage({ theme: { ...readTheme(page.theme), ...patch } })}
                position={page.social_position === 'bottom' ? 'bottom' : 'top'} onPositionChange={social_position => updatePage({ social_position })} />
            )}

            {tab === 'appearance' && (
              <AppearancePanel page={page} institution={institution} institutionId={institutionId}
                onChange={updatePage} onError={msg => showToast(msg, true)} />
            )}

            {tab === 'settings' && (
              <SettingsPanel page={page} onChange={updatePage} onToast={msg => showToast(msg)}
                floatingOptions={blocks.filter(b => b.id && (b.type === 'whatsapp' || (b.type === 'enroll' && b.config.mode === 'whatsapp')))
                  .map(b => ({ id: b.id!, label: `${BLOCK_TYPES[b.type].label}: ${blockSummary(b.type, b.config)}${b.is_visible ? '' : ' (oculto)'}` }))}
                onSlugSaved={slug => {
                  setPage(p => (p ? { ...p, slug } : p))
                  if (savedPageRef.current) savedPageRef.current = { ...savedPageRef.current, slug }
                }} />
            )}

            {tab === 'stats' && (
              <>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e2d6b', letterSpacing: '-0.01em' }}>Desempenho</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Resumo dos últimos 7 dias. O painel completo (por bloco, por origem e funil do Captação) chega na próxima fase.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <KpiCard label="Página" value={pageStatus.label} hint={pageStatus.hint}
                    icon={<Globe size={16} color={pageStatus.color} />} bg={pageStatus.bg} />
                  <KpiCard label="Blocos na página" value={String(blocks.filter(b => b.id && b.is_visible).length)}
                    hint={blocks.some(b => !b.is_visible) ? `${blocks.filter(b => !b.is_visible).length} oculto(s)` : 'Todos visíveis'}
                    icon={<Layers size={16} color="#00A896" />} bg="#E6F7F5" />
                  <KpiCard label="Visitas · 7 dias" value={stats7 ? stats7.views.toLocaleString('pt-BR') : '—'}
                    hint={stats7 ? `${stats7.visitors.toLocaleString('pt-BR')} pessoa(s)` : undefined}
                    icon={<Users size={16} color="#0284C7" />} bg="#E0F2FE" />
                  <KpiCard label="Cliques · 7 dias" value={stats7 ? stats7.clicks.toLocaleString('pt-BR') : '—'}
                    hint={stats7 && stats7.views ? `${Math.round((stats7.clicks / stats7.views) * 100)}% das visitas` : 'Botões, links e redes'}
                    icon={<MousePointerClick size={16} color="#7C3AED" />} bg="#EDE9FE" />
                </div>
              </>
            )}
          </div>

          {/* ── Prévia ligada à edição ────────────────────────────────────── */}
          {wide && (
            <aside aria-label="Prévia da página" style={{ position: 'sticky', top: headerH + 16, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 30 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                  <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#00A896', boxShadow: '0 0 0 3px #E6F7F5' }} /> Prévia ao vivo
                </span>
                <div role="radiogroup" aria-label="Tamanho da prévia" style={{ display: 'flex', gap: 2, background: '#F1F5F9', borderRadius: 999, padding: 3 }}>
                  {([{ v: 'mobile' as const, label: 'Celular', Icon: Smartphone }, { v: 'desktop' as const, label: 'Computador', Icon: Monitor }]).map(({ v, label, Icon }) => (
                    <button key={v} type="button" role="radio" aria-checked={device === v} onClick={() => setDevice(v)} className="vit-nav"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: device === v ? '#fff' : 'transparent', color: device === v ? '#1e2d6b' : '#64748b', boxShadow: device === v ? '0 1px 3px rgba(0,0,0,.10)' : 'none' }}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
                {hasAnimation && (
                  <button type="button" onClick={playAnimation} className="vit-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, border: '1px solid #D1FAE5', background: '#F0FDFB', fontSize: 12, fontWeight: 600, color: '#00A896', cursor: 'pointer' }}>
                    <Play size={12} /> Ver animação
                  </button>
                )}
              </div>
              {phoneFrame(`min(740px, calc(100vh - ${headerH + 90}px))`)}
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Clique num bloco da prévia para editá-lo.</p>
            </aside>
          )}
        </div>
      </div>

      {/* ── Escolha do tipo de bloco ─────────────────────────────────────── */}
      {showPicker && (
        <Modal title={pickerAt === null ? 'Adicionar bloco' : `Inserir bloco na posição ${(pickerAt ?? 0) + 1}`} onClose={() => setShowPicker(false)} wide>
          <BlockGallery onPick={t => addBlock(t)} />
        </Modal>
      )}

      {/* ── Agenda do bloco ──────────────────────────────────────────────── */}
      {scheduleDraft && (() => {
        const b = blocks.find(x => x.key === scheduleDraft.key)
        if (!b) return null
        const err = scheduleError(scheduleDraft.from, scheduleDraft.until)
        return (
          <Modal title="Agendar bloco" onClose={() => setScheduleDraft(null)}>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: DS.text, lineHeight: 1.55 }}>
              <strong>{BLOCK_TYPES[b.type].label}: {blockSummary(b.type, b.config)}</strong><br />
              <span style={{ color: DS.muted }}>O bloco só aparece na página dentro deste período. Útil pra campanha de matrícula, evento ou aviso com data. Deixe em branco o lado sem limite.</span>
            </p>
            <ScheduleFields from={scheduleDraft.from} until={scheduleDraft.until}
              onChange={v => setScheduleDraft(d => (d ? { ...d, ...v } : d))}
              fromLabel="Mostrar a partir de" untilLabel="Esconder depois de"
              fromHint="Em branco: aparece desde já." untilHint="Em branco: fica sem prazo." />
            <p style={{ margin: '14px 0 0', fontSize: 12, color: DS.faint, lineHeight: 1.5 }}>
              A página publicada troca sozinha no horário marcado (em até 1 minuto). A prévia ao lado mostra todos os blocos, agendados ou não.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" onClick={() => setScheduleDraft(null)} className="vit-btn" style={btn}>Cancelar</button>
              <button type="button" disabled={!!err || scheduleSaving} onClick={saveSchedule} className="vit-btn"
                style={{ ...btn, border: 'none', background: err ? '#E2E8F0' : '#00A896', color: err ? '#94a3b8' : '#fff', cursor: err ? 'not-allowed' : 'pointer', boxShadow: err ? 'none' : '0 4px 14px rgba(0,168,150,0.25)' }}>
                {scheduleSaving ? 'Salvando…' : 'Salvar agenda'}
              </button>
            </div>
          </Modal>
        )
      })()}

      {/* ── Confirmação de exclusão ──────────────────────────────────────── */}
      {deleteTarget && (
        <Modal title="Excluir bloco?" onClose={() => setDeleteTarget(null)} narrow>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#1e293b' }}>
            O bloco <strong>{BLOCK_TYPES[deleteTarget.type].label}</strong> sai da página{deleteTarget.id ? ' e não dá pra desfazer' : ''}.
          </p>
          {deleteTarget.capture_trigger_id && (
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              O gatilho dele no Captação será arquivado — as conversas e o histórico do dashboard continuam lá.
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" onClick={() => setDeleteTarget(null)} className="vit-btn" style={btn}>Cancelar</button>
            <button type="button" onClick={confirmDelete} className="vit-btn"
              style={{ ...btn, border: 'none', background: '#dc2626', color: '#fff', boxShadow: '0 4px 12px rgba(220,38,38,0.18)' }}>Excluir</button>
          </div>
        </Modal>
      )}

      {/* ── Prévia em telas estreitas ────────────────────────────────────── */}
      {previewOpen && !wide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12, animation: 'slideUp 0.2s ease' }}
          onClick={e => { if (e.target === e.currentTarget) setPreviewOpen(false) }}>
          <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Fechar prévia"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: 'none', background: '#fff', fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
            <X size={14} /> Fechar prévia
          </button>
          {phoneFrame('min(760px, calc(100vh - 100px))')}
        </div>
      )}
    </div>
  )
}

function Modal({ title, children, onClose, narrow, wide }: { title: string; children: React.ReactNode; onClose: () => void; narrow?: boolean; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: narrow ? 440 : wide ? 860 : 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'slideUp 0.2s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: DS.navy, letterSpacing: '-0.01em' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 4, borderRadius: 6 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}
