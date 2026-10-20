import { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; version: string }) => void
      login: (
        callback: (response: { status?: string; authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>
      ) => void
    }
  }
}

const WA_APP_ID    = import.meta.env.VITE_WA_APP_ID as string | undefined
const WA_CONFIG_ID = import.meta.env.VITE_WA_CONFIG_ID as string | undefined
const SDK_SCRIPT_ID = 'meta-embedded-signup-sdk'
const LOG_PREFIX = '[EmbeddedSignup]'
// Tempo máximo esperando o callback do FB.login(), em todos os modos: a escola
// lê o QR code no celular dentro do popup e o callback só chega quando ele fecha.
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000
// Depois do FINISH da Meta, quanto esperar o callback do FB.login() antes de
// concluir só com os ids (caso "sem resposta": o popup some sem callback).
const FINISH_GRACE_MS = 20_000
// Callback sem code: quanto esperar o FINISH chegar (a ordem dos dois varia).
const CODELESS_WAIT_MS = 3_000

type Status = 'loading-sdk' | 'sdk-error' | 'not-configured' | 'idle' | 'connecting' | 'submitting' | 'success' | 'error'

interface EmbeddedSignupData {
  phoneNumberId?: string
  wabaId?: string
  businessId?: string
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

interface Precheck {
  state: 'checking' | 'connected' | 'not_connected' | 'unknown'
  meta?: ReconnectResult['meta']
  phone?: string | null
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
  // + checkbox antes do popup, inclusive na primeira conexão. Só aqui a
  // conexão conclui sem o code da Meta (com os ids do FINISH).
  superAdminInstitutionId?: string
}

// Registro no audit_logs (clique, verificação, FINISH, popup não concluído).
// Fire-and-forget: nunca pode atrasar a abertura do popup, senão o navegador
// o bloqueia.
type SignupEvent = { event: string; result?: string; detail?: string; meta?: Record<string, unknown>; institution_id?: string }
async function postSignup(payload: Record<string, unknown>): Promise<Response | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  return fetch('/api/whatsapp/embedded-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  })
}
async function logSignupEvent(payload: SignupEvent) {
  try { await postSignup(payload) } catch (e) { console.warn(LOG_PREFIX, 'falha ao registrar evento da conexão:', e) }
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
  const [precheck, setPrecheck] = useState<Precheck | null>(null)
  const [reconnectResult, setReconnectResult] = useState<ReconnectResult | null>(null)
  // Registro do resultado do popup, sempre (todos os modos), com os detalhes da Meta
  const logPopupFailure = (result: string, meta?: Record<string, unknown>, detail?: string) => {
    void logSignupEvent({ event: `${eventPrefix}_popup_result`, result, detail, meta, ...targetBody })
  }
  const signupDataRef = useRef<EmbeddedSignupData>({})
  const statusRef = useRef<Status>(status)
  const loginTimeoutRef = useRef<number | null>(null)
  const finishTimerRef = useRef<number | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const clearTimers = () => {
    for (const r of [loginTimeoutRef, finishTimerRef]) {
      if (r.current !== null) { window.clearTimeout(r.current); r.current = null }
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

  // ── Envia ao servidor. `code` pode faltar: só a equipe Áion (Super Admin)
  // conclui assim, com os ids do FINISH; o servidor confere a conta. ──
  const submit = async (code: string | undefined) => {
    if (submittedRef.current) return
    const { phoneNumberId, wabaId } = signupDataRef.current
    if (!phoneNumberId || !wabaId) return
    submittedRef.current = true
    clearTimers()
    setStatus('submitting')
    try {
      const res = await postSignup({
        ...(code ? { code } : {}), phone_number_id: phoneNumberId, waba_id: wabaId,
        ...(isReconnect ? { mode: 'reconnect' } : {}),
        ...targetBody,
      })
      if (!res) throw new Error('Sessão expirada — faça login novamente e tente reconectar.')
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

  // Popup fechou sem code: com os ids, a equipe Áion conclui; a escola não.
  const handleCodeless = (fbStatus: string | undefined) => {
    const ids = signupDataRef.current
    const meta = { fb_status: fbStatus, waba_id: ids.wabaId, phone_number_id: ids.phoneNumberId, business_id: ids.businessId }
    if (ids.phoneNumberId && ids.wabaId) {
      if (isSuperAdmin) {
        logPopupFailure('sem_codigo_com_ids', meta, 'concluindo só com os ids do FINISH')
        void submit(undefined)
        return
      }
      setStatus('error')
      setErrorMessage('A Meta terminou mas não devolveu a autorização. Peça à equipe Áion para concluir pela ficha da escola — o número não precisa ser refeito.')
      logPopupFailure('sem_codigo_com_ids', meta)
      return
    }
    setStatus('error')
    setErrorMessage('A janela da Meta fechou sem concluir. Tente novamente.')
    logPopupFailure('sem_codigo', meta)
  }

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
      const meta = { event: data.event, ...(data.data && typeof data.data === 'object' ? data.data : {}) }

      if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        signupDataRef.current = {
          phoneNumberId: data.data?.phone_number_id,
          wabaId: data.data?.waba_id,
          businessId: data.data?.business_id,
        }
        void logSignupEvent({ event: `${eventPrefix}_popup_finish`, meta, ...targetBody })
        // Se o callback do FB.login() não vier (popup some sem resposta), a
        // equipe Áion conclui só com os ids depois de um tempo.
        if (isSuperAdmin && finishTimerRef.current === null) {
          finishTimerRef.current = window.setTimeout(() => {
            finishTimerRef.current = null
            if (statusRef.current === 'connecting' && !submittedRef.current) {
              logPopupFailure('finish_sem_retorno', meta, `sem callback do FB.login() ${FINISH_GRACE_MS / 1000}s após o FINISH`)
              void submit(undefined)
            }
          }, FINISH_GRACE_MS)
        }
      } else if (data.event === 'CANCEL') {
        clearTimers()
        setStatus('error')
        setErrorMessage(data.data?.error_message
          ? `A Meta interrompeu: ${data.data.error_message}`
          : 'Conexão cancelada antes de terminar. Tente novamente quando quiser.')
        logPopupFailure('cancelado', meta, data.data?.current_step)
      } else if (data.event === 'ERROR') {
        clearTimers()
        setStatus('error')
        setErrorMessage(data.data?.error_message || 'A Meta retornou um erro durante a conexão.')
        logPopupFailure('erro_meta', meta, data.data?.error_message)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Limpa os timers pendentes se o componente desmontar no meio da espera.
  useEffect(() => {
    return () => clearTimers()
  }, [])

  // Lógica assíncrona de pós-login, isolada do callback passado ao
  // FB.login(). O SDK do Facebook valida o tipo do callback em runtime
  // (Closure Compiler) e rejeita uma função async diretamente — o
  // constructor dela é AsyncFunction, não Function — com o erro síncrono
  // "Expression is of type asyncfunction, not function", travando antes
  // de abrir o popup. Por isso o callback em si precisa ser uma função
  // comum, que só dispara esta função async sem esperar por ela (fire
  // and forget) — ver handleConnectClick abaixo.
  const handleFbLoginResponse = async (response: { status?: string; authResponse?: { code?: string } }) => {
    console.log(LOG_PREFIX, 'callback do FB.login() recebido:', response)
    if (loginTimeoutRef.current !== null) { window.clearTimeout(loginTimeoutRef.current); loginTimeoutRef.current = null }
    if (submittedRef.current) return

    const code = response.authResponse?.code
    if (!code) {
      // CANCEL/ERROR já registraram e mostraram a mensagem — não sobrescreve
      if (statusRef.current === 'error') return
      // o FINISH pode chegar logo depois do callback
      if (!signupDataRef.current.wabaId) await new Promise(r => setTimeout(r, CODELESS_WAIT_MS))
      // relê o ref: CANCEL/ERROR podem ter chegado durante a espera
      const current = (): Status => statusRef.current
      if (current() === 'error' || submittedRef.current) return
      handleCodeless(response.status)
      return
    }

    const { phoneNumberId, wabaId } = signupDataRef.current
    if (!phoneNumberId || !wabaId) {
      setStatus('error')
      setErrorMessage('Não foi possível identificar o número conectado. Tente novamente.')
      logPopupFailure('sem_numero', { fb_status: response.status })
      return
    }
    await submit(code)
  }

  // Aviso antes do popup; com número salvo, confere na Meta se já está
  // conectado (o popup só abre no clique de "Continuar", nunca depois de await).
  const handleReconnectClick = () => {
    setConfirmChecked(false)
    setConfirmOpen(true)
    setPrecheck({ state: 'checking' })
    void (async () => {
      try {
        const res = await postSignup({ event: `${eventPrefix}_precheck`, ...targetBody })
        const d = res ? await res.json() : null
        if (!res?.ok || !d) { setPrecheck({ state: 'unknown' }); return }
        if (d.sem_numero) { setPrecheck(null); return }
        setPrecheck({ state: d.connected ? 'connected' : d.meta?.erro ? 'unknown' : 'not_connected', meta: d.meta, phone: d.phone_number })
      } catch { setPrecheck({ state: 'unknown' }) }
    })()
  }

  const handleConfirmReconnect = () => {
    if (!confirmChecked || precheck?.state === 'connected' || precheck?.state === 'checking') return
    setConfirmOpen(false)
    handleConnectClick()
  }

  const handleConnectClick = () => {
    if (!window.FB) return
    void logSignupEvent({ event: `${eventPrefix}_click`, ...targetBody })
    setStatus('connecting')
    setErrorMessage('')
    signupDataRef.current = {}
    submittedRef.current = false

    clearTimers()
    loginTimeoutRef.current = window.setTimeout(() => {
      if (statusRef.current === 'connecting' && !submittedRef.current) {
        console.error(LOG_PREFIX, `nenhuma resposta do FB.login() em ${LOGIN_TIMEOUT_MS / 60000} min`)
        setStatus('error')
        setErrorMessage('A janela da Meta ficou aberta 10 minutos sem terminar. Se ela fechou ou travou, tente novamente.')
        logPopupFailure('sem_resposta')
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
      clearTimers()
      console.error(LOG_PREFIX, 'erro ao chamar FB.login():', e)
      setStatus('error')
      setErrorMessage('Não foi possível abrir a janela de conexão com a Meta. Tente novamente.')
      logPopupFailure('erro_meta', { error_message: e instanceof Error ? e.message : String(e) }, 'FB.login() lançou erro')
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
    status === 'connecting'  ? 'Aguardando a janela da Meta…' :
    status === 'submitting'  ? 'Conectando…' :
    isReconnect ? 'Reconectar (coexistência)' :
    isSuperAdmin ? 'Conectar WhatsApp (coexistência)' : 'Conectar via Meta'
  const blocked = precheck?.state === 'connected' || precheck?.state === 'checking'
  const canContinue = confirmChecked && !blocked

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {confirmOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setConfirmOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%', padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', fontSize: 13, color: '#334155', lineHeight: 1.6, maxHeight: '90vh', overflowY: 'auto' }}>
            {precheck?.state === 'connected' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#16a34a', marginBottom: 10 }}>
                  <CheckCircle size={18} />Este número já está conectado
                </div>
                <p style={{ margin: '0 0 10px' }}>
                  A Meta mostra o número <strong>{precheck.phone || reconnectTarget?.phoneNumber || '—'}</strong> conectado em coexistência
                  (estado <strong>{precheck.meta?.status ?? '—'}</strong> · app do celular <strong>ligado</strong>). Não é preciso abrir a janela da Meta.
                </p>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748B' }}>
                  Se as mensagens não estão chegando, o problema não é a conexão do número: fale com a equipe Áion.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setConfirmOpen(false)}
                    style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                    Fechar
                  </button>
                </div>
              </>
            ) : (
            <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#B45309', marginBottom: 10 }}>
              <AlertCircle size={18} />{isReconnect ? 'Antes de reconectar, leia com atenção' : 'Antes de conectar, leia com atenção'}
            </div>
            {precheck?.state === 'checking' && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={13} className="animate-spin" />Conferindo na Meta se o número já está conectado…
              </p>
            )}
            {precheck?.state === 'unknown' && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#B45309' }}>
                Não foi possível conferir agora se o número já está conectado. Pode continuar.
              </p>
            )}
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
              <button onClick={handleConfirmReconnect} disabled={!canContinue}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: canContinue ? '#00A896' : '#94A3B8', fontSize: 13, fontWeight: 700, color: '#fff', cursor: canContinue ? 'pointer' : 'default' }}>
                Continuar para a Meta
              </button>
            </div>
            </>
            )}
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
