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

type Status = 'loading-sdk' | 'sdk-error' | 'not-configured' | 'idle' | 'connecting' | 'submitting' | 'success' | 'error'

interface EmbeddedSignupData {
  phoneNumberId?: string
  wabaId?: string
}

interface EmbeddedSignupButtonProps {
  institutionId: string
  onConnected: () => void
}

export default function EmbeddedSignupButton({ institutionId, onConnected }: EmbeddedSignupButtonProps) {
  const [status, setStatus] = useState<Status>(WA_APP_ID && WA_CONFIG_ID ? 'loading-sdk' : 'not-configured')
  const [errorMessage, setErrorMessage] = useState('')
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
      } else if (data.event === 'ERROR') {
        clearLoginTimeout()
        setStatus('error')
        setErrorMessage(data.data?.error_message || 'A Meta retornou um erro durante a conexão.')
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
      setStatus('error')
      setErrorMessage('Não foi concedida autorização. Tente novamente.')
      return
    }

    const { phoneNumberId, wabaId } = signupDataRef.current
    if (!phoneNumberId || !wabaId) {
      setStatus('error')
      setErrorMessage('Não foi possível identificar o número conectado. Tente novamente.')
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
        body: JSON.stringify({ code, phone_number_id: phoneNumberId, waba_id: wabaId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Falha ao concluir a conexão com o WhatsApp')

      setStatus('success')
      onConnected()
    } catch (e) {
      console.error(LOG_PREFIX, 'erro ao chamar /api/whatsapp/embedded-signup:', e)
      setStatus('error')
      setErrorMessage(e instanceof Error ? e.message : 'Erro inesperado ao conectar o WhatsApp')
    }
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
      }
    }, LOGIN_TIMEOUT_MS)

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
    'Conectar via Meta'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={handleConnectClick}
        disabled={busy || status === 'sdk-error'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 20px', borderRadius: 10, border: 'none',
          background: busy || status === 'sdk-error' ? '#94A3B8' : '#00A896',
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
