import { useEffect, useRef, useState } from 'react'
import { Bell, Share, PlusSquare, Smartphone, X, Download, MoreVertical } from 'lucide-react'
import { BRAND, GRAD } from '../../lib/brand'
import { Z } from '../../lib/layers'
import { PUSH_CHANGED_EVENT, INSTALL_READY_EVENT, canPromptInstall, enablePush, isIOS, isStandalone, promptInstall, pushState } from '../../lib/push'

// Convite discreto, no máximo 1x por dia (localStorage), até a pessoa ativar:
//  1) celular fora do app instalado → "Instale o Áion" (Android: botão do navegador; iPhone: passo a passo da Tela de Início);
//  2) sem aparelho cadastrado (pushState 'desligado') → "Ative as notificações" (botão em clique, exigência do navegador).
// "Agora não" (ou só ter visto o convite) esconde até o dia seguinte.
const SKIP_KEY = 'aion-install-card-day'
const today = () => new Date().toLocaleDateString('sv-SE')
const seenToday = () => { try { return localStorage.getItem(SKIP_KEY) === today() } catch { return false } }
const markToday = () => { try { localStorage.setItem(SKIP_KEY, today()) } catch { /* ok */ } }
type Mode = 'instalar' | 'avisos' | null

const isPhone = () => window.matchMedia?.('(max-width: 820px)').matches && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)

export default function InstallAppCard() {
  const [mode, setMode] = useState<Mode>(null)
  const [canInstall, setCanInstall] = useState(canPromptInstall())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const shown = useRef(false)   // já mostrado nesta abertura: não some sozinho ao reavaliar

  const decide = async () => {
    if (!shown.current && seenToday()) { setMode(null); return }
    const show = (m: Mode) => { if (m) { shown.current = true; markToday() } setMode(m) }
    if (isPhone() && !isStandalone()) { show('instalar'); return }
    const st = await pushState().catch(() => 'sem_suporte' as const)
    show(st === 'desligado' ? 'avisos' : null)
  }

  useEffect(() => {
    const t = setTimeout(decide, 1200)   // deixa a tela carregar antes
    const onReady = () => { setCanInstall(canPromptInstall()); decide() }
    window.addEventListener(INSTALL_READY_EVENT, onReady)
    window.addEventListener(PUSH_CHANGED_EVENT, decide)
    return () => { clearTimeout(t); window.removeEventListener(INSTALL_READY_EVENT, onReady); window.removeEventListener(PUSH_CHANGED_EVENT, decide) }
  }, [])

  const skip = () => { markToday(); shown.current = false; setMode(null) }
  const install = async () => { setBusy(true); const ok = await promptInstall(); setBusy(false); setCanInstall(canPromptInstall()); if (ok) setMode(null) }
  const activate = async () => {
    setBusy(true); setErr('')
    const r = await enablePush()
    setBusy(false)
    if (r.ok) { shown.current = false; window.dispatchEvent(new Event(PUSH_CHANGED_EVENT)); setMode(null) } else setErr(r.error || 'Não foi possível ativar')
  }

  if (!mode) return null
  const ios = isIOS()
  return (
    <div role="dialog" aria-label={mode === 'instalar' ? 'Instalar o aplicativo' : 'Ativar notificações'}
      style={{ position: 'fixed', left: 10, right: 10, maxWidth: 440, bottom: 'calc(10px + max(env(safe-area-inset-bottom), var(--dock, 0px)))', zIndex: Z.modal, animation: 'aionSheetUp .38s cubic-bezier(.2,.9,.25,1.05) both', background: '#fff', borderRadius: 18, border: `1px solid ${BRAND.line}`, boxShadow: '0 18px 50px rgba(26,43,74,.28)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {mode === 'instalar' ? <img src="/icon-192.png" alt="" style={{ width: 46, height: 46, borderRadius: 14 }} /> : <Bell size={22} color="#fff" />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: BRAND.ink }}>{mode === 'instalar' ? 'Instale o Áion Edu no seu celular' : 'Ative as notificações'}</div>
          <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2, lineHeight: 1.45 }}>
            {mode === 'instalar'
              ? 'Abre como aplicativo, direto pelo ícone, em tela cheia e mais rápido.'
              : 'Seja avisado de mensagem nova, lead novo, visita e transferência, mesmo com o app fechado.'}
          </div>
        </div>
        <button aria-label="Fechar" onClick={skip} style={{ border: 'none', background: 'none', color: BRAND.faint, padding: 4, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
      </div>

      {mode === 'instalar' && ios && (
        <ol style={{ margin: 0, padding: 12, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, background: '#F5FAF9', border: `1px solid ${BRAND.line}`, borderRadius: 12 }}>
          {[
            [<Share size={15} />, <>No <b>Safari</b>, toque em <b>Compartilhar</b> (o quadrado com a seta, embaixo).</>],
            [<PlusSquare size={15} />, <>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</>],
            [<Smartphone size={15} />, <>Abra o <b>Áion</b> pelo ícone novo na tela inicial.</>],
          ].map(([ic, t], i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: BRAND.text, lineHeight: 1.45 }}>
              <span style={{ width: 24, height: 24, borderRadius: 8, background: BRAND.soft, color: BRAND.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ic}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      )}
      {mode === 'instalar' && !ios && !canInstall && (
        <div style={{ fontSize: 13, color: BRAND.text, background: '#F5FAF9', border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 12, display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.45 }}>
          <MoreVertical size={16} color={BRAND.primary} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>No menu do navegador (os três pontinhos), toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</span>
        </div>
      )}
      {err && <div role="alert" style={{ fontSize: 12.5, color: '#B91C1C', background: '#FEF2F2', borderRadius: 10, padding: '8px 10px' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={skip} style={{ flex: 1, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, borderRadius: 12, padding: '11px 10px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Agora não</button>
        {mode === 'instalar' && !ios && canInstall && (
          <button disabled={busy} onClick={install} style={{ flex: 1.4, border: 'none', background: GRAD, color: '#fff', borderRadius: 12, padding: '11px 10px', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Download size={16} /> Instalar app</button>
        )}
        {mode === 'avisos' && (
          <button disabled={busy} onClick={activate} style={{ flex: 1.4, border: 'none', background: '#05907B', color: '#fff', borderRadius: 12, padding: '11px 10px', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Bell size={16} /> Ativar avisos</button>
        )}
      </div>
    </div>
  )
}
