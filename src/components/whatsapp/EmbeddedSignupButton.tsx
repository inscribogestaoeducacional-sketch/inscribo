import { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; version: string }) => void
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>
      ) => void
    }
  }
}

const WA_APP_ID    = import.meta.env.VITE_WA_APP_ID as string | undefined
const WA_CONFIG_ID = import.meta.env.VITE_WA_CONFIG_ID as string | undefined
const SDK_SCRIPT_ID = 'meta-embedded-signup-sdk'
const LOG_PREFIX = '[EmbeddedSignup]'
// Tempo máximo esperando o callback do FB.login() (popup travado, bloqueado
// pelo navegador, ou o handshake interno do SDK nunca completando).
const LOGIN_TIMEOUT_MS = 45000
// Na reconexão em coexistência a escola ainda lê o QR code no celular dentro
// do popup — o callback do FB.login() só chega quando o popup fecha.
const RECONNECT_LOGIN_TIMEOUT_MS = 10 * 60 * 1000

type Status = 'loading-sdk' | 'sdk-error' | 'not-configured' | 'idle' | 'connecting' | 'submitting' | 'success' | 'error'

interface EmbeddedSignupData {
  phoneNumberId?: string
  wabaId?: string
}

interface ReconnectTarget {
  wabaId: string | null
  phoneNumber: string | null
  displayName: string | null
}

interface ReconnectResult {
  phone_id_changed?: boolean
  app_subscribed?: boolean
  meta?: { status?: string | null; platform_type?: string | null; is_on_biz_app?: boolean | null; erro?: string }
}

interface EmbeddedSignupButtonProps {
  institutionId: string
  onConnected: () => void
  // 'reconnect': escola que JÁ tem número e perdeu a coexistência. Mostra um
  // aviso antes do popup e o servidor só aceita o mesmo WABA cadastrado.
  mode?: 'connect' | 'reconnect'
  reconnectTarget?: ReconnectTarget
  // Super Admin conectando pela ficha da escola: todo pedido leva o id desta
  // escola (o servidor só aceita isso de Super Admin). Sempre mostra o aviso
  // + checkbox antes do popup, inclusive na primeira conexão.
  superAdminInstitutionId?: string
}

// Registro no audit_logs (clique / popup não concluído). Fire-and-forget:
// nunca pode atrasar a abertura do popup, senão o navegador o bloqueia.
async function logSignupEvent(payload: { event: string; result?: string; detail?: string; institution_id?: string }) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await fetch('/api/whatsapp/embedded-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.warn(LOG_PREFIX, 'falha ao registrar evento da conexão:', e)
  }
}

export default function EmbeddedSignupButton({ institutionId, onConnected, mode = 'connect', reconnectTarget, superAdminInstitutionId }: EmbeddedSignupButtonProps) {
  const isReconnect = mode === 'reconnect'
  const isSuperAdmin = !!superAdminInstitutionId
  const requireConfirm = isReconnect || isSuperAdmin
  const eventPrefix = isReconnect ? 'reconnect' : 'connect'
  const targetBody = isSuperAdmin ? { institution_id: superAdminInstitutionId } : {}
  const [status, setStatus] = useState<Status>(WA_APP_ID && WA_CONFIG_ID ? 'loading-sdk' : 'not-configured')
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [reconnectResult, setReconnectResult] = useState<ReconnectResult | null>(null)
  const logPopupFailure = (result: string, detail?: string) => {
    if (requireConfirm) void logSignupEvent({ event: `${eventPrefix}_popup_result`, result, detail, ...targetBody })
  }
  const signupDataRef = useRef<EmbeddedSignupData>({})
  const statusRef = useRef<Status>(status)
  const loginTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const clearLoginTimeout = () => {
    if (loginTimeoutRef.current !== null) {
      window.clearTimeout(loginTimeoutRef.current)
      loginTimeoutRef.current = null
    }
  }

  // ── Carrega o SDK do Facebook sob demanda (só quando este botão é montado,
  // ou seja, só quando a escola ainda não está conectada) ──
  useEffect(() => {
    if (status === 'not-configured') {
      console.log(LOG_PREFIX, 'VITE_WA_APP_ID/VITE_WA_CONFIG_ID ausentes — botão não habilitado')
      return
    }

    if (window.FB) {
      console.log(LOG_PREFIX, 'window.FB já existia ao montar — pulando carregamento do script')
      setStatus('idle')
      return
    }
    if (document.getElementById(SDK_SCRIPT_ID)) {
      console.log(LOG_PREFIX, 'script do SDK já está sendo carregado por outra instância')
      return
    }

    console.log(LOG_PREFIX, 'injetando script do SDK da Meta…')
    const script = document.createElement('script')
    script.id = SDK_SCRIPT_ID
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    script.async = true
    script.onload = () => {
      console.log(LOG_PREFIX, 'SDK carregado (script onload)')
      try {
        window.FB?.init({ appId: WA_APP_ID!, version: 'v25.0' })
        console.log(LOG_PREFIX, 'FB.init() concluído com sucesso')
        setStatus('idle')
      } catch (e) {
        console.error(LOG_PREFIX, 'erro em FB.init():', e)
        setStatus('sdk-error')
        setErrorMessage('Não foi possível inicializar o SDK da Meta. Recarregue a página e tente novamente.')
      }
    }
    script.onerror = (e) => {
      console.error(LOG_PREFIX, 'falha ao carregar o script do SDK:', e)
      setStatus('sdk-error')
      setErrorMessage('Não foi possível carregar o SDK da Meta. Verifique sua conexão e tente novamente.')
    }
    document.body.appendChild(script)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Captura phone_number_id/waba_id do evento WA_EMBEDDED_SIGNUP que a
  // Meta manda via postMessage durante o fluxo do popup ──
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
      let data: any
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return
      console.log(LOG_PREFIX, 'mensagem WA_EMBEDDED_SIGNUP recebida:', data.event, data.data)

      if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        signupDataRef.current = {
          phoneNumberId: data.data?.phone_number_id,
          wabaId: data.data?.waba_id,
        }
      } else if (data.event === 'CANCEL') {
        clearLoginTimeout()
        setStatus('error')
        setErrorMessage('Conexão cancelada antes de terminar. Tente novamente quando quiser.')
        logPopupFailure('cancelado', data.data?.current_step)
      } else if (data.event === 'ERROR') {
        clearLoginTimeout()
        setStatus('error')
        setErrorMessage(data.data?.error_message || 'A Meta retornou um erro durante a conexão.')
        logPopupFailure('erro_meta', data.data?.error_message)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Limpa o timeout pendente se o componente desmontar no meio da espera.
  useEffect(() => {
    return () => clearLoginTimeout()
  }, [])

  // Lógica assíncrona de pós-login, isolada do callback passado ao
  // FB.login(). O SDK do Facebook valida o tipo do callback em runtime
  // (Closure Compiler) e rejeita uma função async diretamente — o
  // constructor dela é AsyncFunction, não Function — com o erro síncrono
  // "Expression is of type asyncfunction, not function", travando antes
  // de abrir o popup. Por isso o callback em si precisa ser uma função
  // comum, que só dispara esta função async sem esperar por ela (fire
  // and forget) — ver handleConnectClick abaixo.
  const handleFbLoginResponse = async (response: { authResponse?: { code?: string } }) => {
    console.log(LOG_PREFIX, 'callback do FB.login() recebido:', response)
    clearLoginTimeout()

    const code = response.authResponse?.code
    if (!code) {
      // CANCEL/ERROR já registraram e mostraram a mensagem — não sobrescreve
      if (statusRef.current === 'error') return
      setStatus('error')
      setErrorMessage('Não foi concedida autorização. Tente novamente.')
      logPopupFailure('sem_codigo')
      return
    }

    const { phoneNumberId, wabaId } = signupDataRef.current
    if (!phoneNumberId || !wabaId) {
      setStatus('error')
      setErrorMessage('Não foi possível identificar o número conectado. Tente novamente.')
      logPopupFailure('sem_numero')
      return
    }

    setStatus('submitting')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Sessão expirada — faça login novamente e tente reconectar.')
      }

      const res = await fetch('/api/whatsapp/embedded-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code, phone_number_id: phoneNumberId, waba_id: wabaId,
          ...(isReconnect ? { mode: 'reconnect' } : {}),
          ...targetBody,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Falha ao concluir a conexão com o WhatsApp')

      setStatus('success')
      // Na reconexão não recarrega a aba: o loadConfig mostra o spinner e
      // desmonta este botão, sumindo com o resultado que a pessoa precisa ler.
      if (isReconnect) setReconnectResult(result)
      else onConnected()
    } catch (e) {
      console.error(LOG_PREFIX, 'erro ao chamar /api/whatsapp/embedded-signup:', e)
      setStatus('error')
      setErrorMessage(e instanceof Error ? e.message : 'Erro inesperado ao conectar o WhatsApp')
    }
  }

  // Reconexão: primeiro o aviso; o popup só abre no clique de "Continuar"
  const handleReconnectClick = () => {
    setConfirmChecked(false)
    setConfirmOpen(true)
  }

  const handleConfirmReconnect = () => {
    if (!confirmChecked) return
    setConfirmOpen(false)
    void logSignupEvent({ event: `${eventPrefix}_click`, ...targetBody })
    handleConnectClick()
  }

  const handleConnectClick = () => {
    if (!window.FB) return
    setStatus('connecting')
    setErrorMessage('')
    signupDataRef.current = {}

    clearLoginTimeout()
    loginTimeoutRef.current = window.setTimeout(() => {
      if (statusRef.current === 'connecting') {
        console.error(LOG_PREFIX, `nenhuma resposta do FB.login() em ${LOGIN_TIMEOUT_MS / 1000}s — provável popup bloqueado ou handshake do SDK travado`)
        setStatus('error')
        setErrorMessage('Não foi possível abrir a conexão com a Meta. Verifique se o navegador não está bloqueando pop-ups e tente novamente.')
        logPopupFailure('sem_resposta')
      }
    }, requireConfirm ? RECONNECT_LOGIN_TIMEOUT_MS : LOGIN_TIMEOUT_MS)

    try {
      console.log(LOG_PREFIX, 'chamando FB.login() com config_id:', WA_CONFIG_ID)
      window.FB.login(
        // Função síncrona comum — nunca passar `async (response) => {...}`
        // diretamente aqui (ver comentário em handleFbLoginResponse acima).
        (response) => {
          void handleFbLoginResponse(response)
        },
        {
          config_id: WA_CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
        }
      )
    } catch (e) {
      clearLoginTimeout()
      console.error(LOG_PREFIX, 'erro ao chamar FB.login():', e)
      setStatus('error')
      setErrorMessage('Não foi possível abrir a janela de conexão com a Meta. Tente novamente.')
    }
  }

  if (status === 'not-configured') {
    return (
      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
        Conexão automática via Meta ainda não está disponível nesta plataforma.
      </p>
    )
  }

  if (status === 'success' && isReconnect) {
    const meta = reconnectResult?.meta
    return (
      <div style={{ padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>
          <CheckCircle size={15} />Reconexão concluída na Meta
        </div>
        {meta?.erro
          ? <div>Não foi possível ler o estado do número agora ({meta.erro}).</div>
          : <div>Estado na Meta: <strong>{meta?.status ?? '—'}</strong> · plataforma <strong>{meta?.platform_type ?? '—'}</strong> · app do celular <strong>{meta?.is_on_biz_app ? 'ligado' : 'não informado'}</strong></div>}
        <div>App Áion inscrito na conta: <strong>{reconnectResult?.app_subscribed ? 'sim' : 'não confirmado'}</strong>{reconnectResult?.phone_id_changed ? ' · ID do número atualizado' : ''}</div>
        <div style={{ marginTop: 6 }}>Agora faça o teste: mande uma mensagem de outro celular para a escola e veja se ela aparece no Hub.</div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
        <CheckCircle size={15} />WhatsApp conectado com sucesso!
      </div>
    )
  }

  const busy = status === 'loading-sdk' || status === 'connecting' || status === 'submitting'
  const label =
    status === 'loading-sdk' ? 'Carregando…' :
    status === 'connecting'  ? 'Aguardando confirmação…' :
    status === 'submitting'  ? 'Conectando…' :
    isReconnect ? 'Reconectar (coexistência)' :
    isSuperAdmin ? 'Conectar WhatsApp (coexistência)' : 'Conectar via Meta'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {confirmOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setConfirmOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%', padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', fontSize: 13, color: '#334155', lineHeight: 1.6, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#B45309', marginBottom: 10 }}>
              <AlertCircle size={18} />{isReconnect ? 'Antes de reconectar, leia com atenção' : 'Antes de conectar, leia com atenção'}
            </div>
            <p style={{ margin: '0 0 10px' }}>
              Vai abrir a janela da Meta para {isReconnect ? 'religar' : 'ligar'} o WhatsApp da escola à Áion, <strong>mantendo o app WhatsApp Business no celular</strong>. {isSuperAdmin ? 'A escola precisa estar na chamada com o celular em mãos' : 'Deixe o celular da escola por perto'}: ele vai pedir para ler um QR code ou confirmar.
            </p>
            <div style={{ padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, margin: '0 0 10px' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Na janela da Meta:</div>
              <div>1. Escolha <strong>conectar um app WhatsApp Business existente</strong>.</div>
              {isReconnect ? (
                <>
                  <div>2. Escolha a conta que já existe: <strong>{reconnectTarget?.displayName || 'a conta atual da escola'}</strong>{reconnectTarget?.wabaId ? <> (ID {reconnectTarget.wabaId})</> : null}.</div>
                  <div>3. Número: <strong>{reconnectTarget?.phoneNumber || '—'}</strong>.</div>
                </>
              ) : (
                <div>2. Escolha ou crie a conta da <strong>própria escola</strong> — nunca a conta de teste da Áion.</div>
              )}
              <div style={{ marginTop: 6, color: '#B91C1C', fontWeight: 600 }}>Nunca escolha "número novo", "criar nova conta"{isReconnect ? '' : ' para um número que já está no app'} nem "migrar o número" — isso pode tirar o número do app do celular.</div>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748B' }}>
              {isReconnect
                ? 'Se a conta escolhida não for a desta escola, a Áion recusa e não altera nada. As mensagens trocadas pelo celular enquanto a ligação estava caída não entram na Áion.'
                : 'Se a conta escolhida for a de teste da Áion, a Áion recusa e não altera nada. Depois de conectar, a Áion pede à Meta os contatos e o histórico do app.'}
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', margin: '0 0 14px' }}>
              <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Li o aviso e estou com o celular da escola em mãos.</span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmOpen(false)}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleConfirmReconnect} disabled={!confirmChecked}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: confirmChecked ? '#00A896' : '#94A3B8', fontSize: 13, fontWeight: 700, color: '#fff', cursor: confirmChecked ? 'pointer' : 'default' }}>
                Continuar para a Meta
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={requireConfirm ? handleReconnectClick : handleConnectClick}
        disabled={busy || status === 'sdk-error'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 20px', borderRadius: 10, border: 'none',
          background: busy || status === 'sdk-error' ? '#94A3B8' : isReconnect ? '#B45309' : '#00A896',
          color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: busy || status === 'sdk-error' ? 'default' : 'pointer',
        }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
        {label}
      </button>
      {(status === 'error' || status === 'sdk-error') && errorMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#DC2626' }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />{errorMessage}
        </div>
      )}
    </div>
  )
}
