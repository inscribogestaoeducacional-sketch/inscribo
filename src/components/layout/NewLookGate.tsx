// Comunicado obrigatório "A Áion está de cara nova": aparece uma vez para cada usuário
// das escolas que já eram clientes antes do lançamento. Não tem botão de fechar:
// só libera o sistema depois de passar pelos passos e marcar "Estou ciente".
import { useEffect, useState } from 'react'
import {
  Sparkles, Smartphone, HelpCircle, ArrowRight, ArrowLeft, Check, Bell, Download,
  Home, Filter as Funnel, Users, CalendarCheck, MessageCircle, Target, Megaphone, GraduationCap, Repeat, ClipboardList, Settings, UserCog, Flag, Plug,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { BRAND } from '../../lib/brand'
import { canPromptInstall, enablePush, isIOS, isStandalone, promptInstall, pushState, pushSupported } from '../../lib/push'

export const NEW_LOOK_RELEASE = 'cara-nova-2026-10'
// Só passa a aparecer a partir de 26/10/2026 (00h, Fortaleza)
const START_AT = new Date('2026-10-26T00:00:00-03:00').getTime()
const CUTOFF = '2026-10-26' // só escolas criadas antes desta data (escolas novas não veem)

type Item = { Icon: React.ElementType; name: string; text: string; gestorOnly?: boolean }
const ITEMS: Item[] = [
  { Icon: Home, name: 'Início', text: 'Resumo do dia com números reais: leads, visitas e matrículas.' },
  { Icon: Funnel, name: 'Leads', text: 'Botão "Novo lead" no topo, filtros em cartão e destaque para as famílias que estão esperando resposta. Matriculados sem lead agora podem ser vinculados ou criados ali mesmo.' },
  { Icon: Users, name: 'Contatos', text: 'Ficha do contato em tela cheia, com abas. "Revisar duplicados" junta contatos repetidos com segurança.' },
  { Icon: CalendarCheck, name: 'Visitas', text: 'Agenda no padrão novo, com filtro em cartão.' },
  { Icon: MessageCircle, name: 'WhatsApp', text: 'Fotos, contatos compartilhados, localização, edições e mensagens apagadas agora aparecem corretamente.' },
  { Icon: Target, name: 'Captação', text: 'Mesma captação, agora também no celular.' },
  { Icon: Megaphone, name: 'Transmissões', text: 'Envios em massa organizados e prontos para o celular.' },
  { Icon: Flag, name: 'Campanha de matrículas', text: 'Números da campanha e alerta de matriculados sem lead no mesmo lugar.', gestorOnly: true },
  { Icon: GraduationCap, name: 'Base de alunos', text: 'Visão geral, alunos, por série e conferência — com ficha do aluno e destaque de quem falta rematricular.' },
  { Icon: Repeat, name: 'Transferências', text: 'Saídas, pesquisa de saída e relatório no padrão novo.' },
  { Icon: ClipboardList, name: 'Pesquisas', text: 'Criar, editar perguntas e ver respostas, tudo refeito. Inclui a pesquisa de satisfação dos colaboradores.', gestorOnly: true },
  { Icon: UserCog, name: 'Usuários', text: 'Cadastro de equipe e permissões em telas novas.', gestorOnly: true },
  { Icon: Plug, name: 'Integrações', text: 'Novidade: agora a Áion se integra com o Activesoft, e outras integrações virão depois. Também dá para enviar a planilha de alunos ou lançar a base por série. Informe abaixo qual sistema sua escola usa, ou fale com a nossa equipe.', gestorOnly: true },
  { Icon: Settings, name: 'Configurações', text: 'Todas as abas refeitas para o celular.', gestorOnly: true },
]

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 24, height: 24, borderRadius: 99, background: BRAND.soft, color: BRAND.primaryDark, fontWeight: 800, fontSize: 12.5, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.5, color: '#475569', paddingTop: 2 }}>{t}</span>
        </div>
      ))}
    </div>
  )
}

function Dot({ on }: { on: boolean }) {
  return <span style={{ width: on ? 22 : 8, height: 8, borderRadius: 99, background: on ? '#fff' : 'rgba(255,255,255,.4)', transition: 'width .2s' }} />
}

export default function NewLookGate() {
  const { user } = useAuth()
  // Prévia para teste: abra qualquer tela com ?prev=caranova — mostra o comunicado sem gravar nada
  const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('prev') === 'caranova'
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [ok, setOk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [pushOn, setPushOn] = useState(false)
  const [canInstall, setCanInstall] = useState(canPromptInstall())
  const [erp, setErp] = useState('')
  const [erpSaved, setErpSaved] = useState(false)
  const [erpBusy, setErpBusy] = useState(false)

  const isGestor = preview || user?.role === 'admin' || user?.role === 'manager'

  useEffect(() => {
    if (!user?.id || user.user_type !== 'school_user' || !user.institution_id) return
    if (preview) { setShow(true); return }
    if (Date.now() < START_AT) return
    let alive = true
    supabase.rpc('release_gate', { p_release: NEW_LOOK_RELEASE, p_cutoff: CUTOFF }).then(({ data, error }) => {
      if (alive && !error && data === true) setShow(true)
    })
    supabase.rpc('school_erp_get').then(({ data }) => { if (alive && typeof data === 'string' && data) { setErp(data); setErpSaved(true) } })
    pushState().then(s => { if (alive) setPushOn(s === 'ativo') }).catch(() => {})
    return () => { alive = false }
  }, [user?.id, user?.user_type, user?.institution_id, preview])

  useEffect(() => {
    if (!show) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [show])

  if (!show) return null

  const items = ITEMS.filter(i => isGestor || !i.gestorOnly)
  const STEPS = 4
  const last = step === STEPS - 1

  const finish = async () => {
    if (preview) { setShow(false); const u = new URL(window.location.href); u.searchParams.delete('prev'); window.history.replaceState({}, '', u.toString()); return }
    setSaving(true)
    const { error } = await supabase.rpc('release_ack', { p_release: NEW_LOOK_RELEASE })
    setSaving(false)
    if (error) { setPushMsg('Não consegui registrar agora. Confira a internet e tente de novo.'); return }
    setShow(false)
  }

  const saveErp = async () => {
    setErpBusy(true)
    const { error } = await supabase.rpc('school_erp_declare', { p_name: erp })
    setErpBusy(false)
    if (!error) setErpSaved(true)
  }

  const activate = async () => {
    setPushMsg('')
    const r = await enablePush()
    if (r.ok) { setPushOn(true); setPushMsg('Pronto! Este aparelho vai receber os avisos.') } else setPushMsg(r.error || 'Não foi possível ativar agora.')
  }

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14 }
  const ios = isIOS()

  return (
    <div role="dialog" aria-modal="true" aria-label="A Áion está de cara nova"
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'var(--bg-page, #F5FAF9)', display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: 'var(--aion-grad)', color: '#fff', padding: 'calc(18px + env(safe-area-inset-top)) 20px 18px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <span aria-hidden style={{ position: 'absolute', width: 300, height: 300, right: -110, top: -130, borderRadius: 999, background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,.26), rgba(255,255,255,.04) 62%, transparent 70%)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 720, margin: '0 auto' }}>
          <img src="/aion-logo-icon.png" alt="Áion" style={{ width: 44, height: 44, borderRadius: 13 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .85 }}>Novidade · passo {step + 1} de {STEPS}</div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>A Áion está de cara nova</div>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 6, marginTop: 14, maxWidth: 720, margin: '14px auto 0' }}>
          {Array.from({ length: STEPS }).map((_, i) => <Dot key={i} on={i === step} />)}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 12px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {step === 0 && (
            <>
              <div style={{ ...card, padding: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: BRAND.soft, display: 'grid', placeItems: 'center', marginBottom: 12 }}><Sparkles size={26} color={BRAND.primaryDark} /></div>
                <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: BRAND.ink, margin: '0 0 8px', lineHeight: 1.15 }}>Mudamos o visual e trouxemos várias funcionalidades novas</h2>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: '#475569', margin: 0 }}>Escutamos vocês. A Áion ficou mais bonita, mais simples de usar e agora funciona de verdade no celular. Nos próximos passos você vê tudo que mudou, menu por menu.</p>
              </div>
              <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', background: BRAND.soft, borderColor: '#BFE9E1' }}>
                <Smartphone size={26} color={BRAND.primaryDark} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 13.5, lineHeight: 1.45, color: BRAND.ink }}><b>Grande novidade: a Áion no celular.</b> Instale na tela inicial e receba avisos de lead novo, mensagem e visita.</div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div style={{ fontSize: 13, color: BRAND.muted, padding: '0 2px' }}>O que mudou em cada parte do menu:</div>
              {items.map(({ Icon, name, text }) => (
                <div key={name} style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, background: BRAND.soft, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={19} color={BRAND.primaryDark} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{name}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.45, color: '#475569', marginTop: 2 }}>{text}</div>
                  </div>
                </div>
              ))}
              {isGestor && (
                <div style={{ ...card, borderColor: '#BFE9E1', background: BRAND.soft }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>Qual sistema de gestão (ERP) a sua escola usa?</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#475569', margin: '4px 0 10px' }}>Assim sabemos com qual sistema integrar. Se preferir, é só falar com a nossa equipe.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={erp} onChange={e => { setErp(e.target.value); setErpSaved(false) }} placeholder="Ex.: Activesoft, Scitus, Sponte…"
                      style={{ flex: 1, minWidth: 0, height: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${BRAND.line}`, fontSize: 16, color: BRAND.ink, background: '#fff', fontFamily: 'inherit' }} />
                    <button type="button" onClick={saveErp} disabled={erpBusy || !erp.trim() || erpSaved}
                      style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: erpSaved ? '#059669' : 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: !erp.trim() ? .5 : 1 }}>{erpSaved ? 'Salvo' : erpBusy ? '…' : 'Salvar'}</button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ ...card, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Smartphone size={22} color={BRAND.primaryDark} />
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: BRAND.ink, margin: 0 }}>Use a Áion no celular</h2>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: '#475569', margin: 0 }}>É o mesmo sistema, otimizado para o celular, com um ícone na tela inicial. Sem baixar nada na loja.</p>
              </div>

              {isStandalone() ? (
                <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', background: '#ECFDF5', borderColor: '#A7F3D0' }}>
                  <Check size={20} color="#059669" /><span style={{ fontSize: 13.5, color: BRAND.ink, fontWeight: 700 }}>Você já está usando o app instalado.</span>
                </div>
              ) : ios ? (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>No iPhone (Safari)</div>
                  <Steps items={[<>Abra a Áion no <b>Safari</b>.</>, <>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</>, <>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</>, <>Abra a Áion pelo ícone novo. Aí você consegue ativar os avisos.</>]} />
                </div>
              ) : (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>No Android (Chrome)</div>
                  <Steps items={[<>Abra a Áion no <b>Chrome</b>.</>, <>Toque nos três pontinhos no canto de cima (<b>⋮</b>).</>, <>Escolha <b>Instalar aplicativo</b> (ou <b>Adicionar à tela inicial</b>).</>]} />
                  {canInstall && (
                    <button type="button" onClick={async () => { await promptInstall(); setCanInstall(canPromptInstall()) }}
                      style={{ marginTop: 12, width: '100%', height: 46, borderRadius: 12, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Download size={17} /> Instalar agora
                    </button>
                  )}
                </div>
              )}

              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Bell size={18} color={BRAND.primaryDark} /><span style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>Receba avisos no celular</span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.45, color: '#475569', margin: '0 0 10px' }}>Lead novo, mensagem de cliente, conversa transferida e visita do dia. Você escolhe depois quais quer receber.</p>
                {pushOn ? (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={16} /> Avisos ativos neste aparelho</div>
                ) : pushSupported() && !(ios && !isStandalone()) ? (
                  <button type="button" onClick={activate}
                    style={{ width: '100%', height: 44, borderRadius: 12, border: `1px solid ${BRAND.primary}`, background: '#fff', color: BRAND.primaryDark, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Ativar avisos neste aparelho</button>
                ) : (
                  <div style={{ fontSize: 12.5, color: BRAND.muted }}>{ios && !isStandalone() ? 'No iPhone, primeiro adicione a Áion à Tela de Início e abra por lá para ativar os avisos.' : 'Este navegador não recebe avisos. Use o Chrome ou o Safari atualizado.'}</div>
                )}
                {pushMsg && <div style={{ fontSize: 12.5, marginTop: 8, fontWeight: 700, color: pushMsg.startsWith('Pronto') ? '#059669' : '#B91C1C' }}>{pushMsg}</div>}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ ...card, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 999, background: BRAND.soft, display: 'grid', placeItems: 'center' }}><HelpCircle size={24} color={BRAND.primaryDark} /></span>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: BRAND.ink, margin: 0 }}>Ficou com dúvida? Toque no ?</h2>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#475569', margin: 0 }}>No topo de toda tela, ao lado do sino, existe o botão <b>?</b>. Ao tocar, você vê o passo a passo daquela tela.</p>
              </div>
              {[
                ['Passo a passo escrito', 'Aulas curtas, com o nome exato de cada botão.'],
                ['"Fazer comigo"', 'A aula acontece na tela de verdade: o botão da vez acende e uma voz em português lê cada passo. Você toca e a aula avança.'],
                ['"Tire suas dúvidas"', 'Uma assistente responde na hora. Se ela não resolver, a nossa equipe continua a conversa com você.'],
              ].map(([t, d]) => (
                <div key={t} style={{ ...card, display: 'flex', gap: 10 }}>
                  <Check size={18} color={BRAND.primaryDark} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{t}</div><div style={{ fontSize: 13, lineHeight: 1.45, color: '#475569', marginTop: 2 }}>{d}</div></div>
                </div>
              ))}
              <label style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', borderColor: ok ? BRAND.primary : BRAND.line, background: ok ? BRAND.soft : '#fff' }}>
                <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} style={{ width: 22, height: 22, accentColor: BRAND.primary, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>Estou ciente das novidades e sei onde tirar dúvidas</span>
              </label>
              {pushMsg && !pushMsg.startsWith('Pronto') && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#B91C1C' }}>{pushMsg}</div>}
            </>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, borderTop: `1px solid ${BRAND.line}`, background: '#fff', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              style={{ height: 48, padding: '0 18px', borderRadius: 14, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}><ArrowLeft size={16} /> Voltar</button>
          )}
          {!last ? (
            <button type="button" onClick={() => setStep(s => s + 1)}
              style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Próximo <ArrowRight size={17} /></button>
          ) : (
            <button type="button" onClick={finish} disabled={!ok || saving}
              style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: ok ? 'var(--aion-grad)' : '#CBD5E1', color: '#fff', fontWeight: 800, fontSize: 15, cursor: ok ? 'pointer' : 'default', fontFamily: 'inherit', opacity: saving ? .7 : 1 }}>{saving ? 'Salvando…' : 'Começar a usar a Áion'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
