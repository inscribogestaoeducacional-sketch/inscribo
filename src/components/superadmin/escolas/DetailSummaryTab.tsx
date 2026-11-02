// Resumo da escola: um cartão por assunto, cada um com atalho para a aba onde o assunto é resolvido.
import { Users, DollarSign, MessageCircle, Megaphone, Rocket, Wifi, WifiOff, AlertTriangle, ArrowRight, Building2, CheckCircle2 } from 'lucide-react'
import { fmtBRL, fmtDate } from './format'
import { CYCLE_STATUS, PAYMENT_STATUS, TIMELINE_PHASES } from './detailConsts'

type Props = {
  institution: any
  users: any[]
  payments: any[]
  cycles: any[]
  changeRequests: any[]
  contract: any
  contractSt: { l: string; c: string; bg: string } | null
  onboardingProcess: any
  onboardingTasks: any[]
  currentPhaseIdx: number
  waConnected: boolean
  waSaved: any
  waUsage: { count: number; limit: number }
  consultantName: string
  goTab: (tab: string) => void
}

function Card({ icon: Icon, color, title, tab, goTab, children, action = 'Abrir' }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '18' }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <p className="text-sm font-bold text-gray-900">{title}</p>
        </div>
        {tab && (
          <button onClick={() => goTab(tab)} className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color }}>
            {action} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-1.5 text-sm text-gray-600">{children}</div>
    </div>
  )
}

const Row = ({ l, v }: { l: string; v: any }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-gray-400">{l}</span>
    <span className="font-semibold text-gray-800 text-right">{v}</span>
  </div>
)

export default function DetailSummaryTab(p: Props) {
  const { institution: i, users, payments, cycles, changeRequests, contract, contractSt, onboardingProcess, onboardingTasks, currentPhaseIdx, waConnected, waSaved, waUsage, consultantName, goTab } = p
  const free = i.plan === 'gratuito'
  const monthly = payments.filter(x => x.payment_type === 'monthly')
  const overdue = payments.filter(x => x.status === 'overdue')
  const open = payments.filter(x => x.status === 'pending' || x.status === 'overdue')
  const openTotal = open.reduce((s, x) => s + Number(x.amount || 0), 0)
  const nextDue = open.map(x => x.due_date).filter(Boolean).sort()[0]
  const lastPaid = payments.filter(x => x.status === 'paid').sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)))[0]
  const cycle = cycles[0]
  const cst = cycle ? (CYCLE_STATUS[cycle.status] || { l: cycle.status, c: '#6b7280', bg: '#f3f4f6' }) : null
  const phase = TIMELINE_PHASES[currentPhaseIdx]
  const phaseTasks = onboardingTasks.filter(t => t.phase === phase?.id)
  const phaseDone = phaseTasks.filter(t => t.done).length
  const manage = i.plan_status === 'active' || i.plan_status === 'pending_payment'

  // Alertas: só o que precisa de uma ação de quem administra
  const alerts: { text: string; tab: string; tone: 'red' | 'amber' }[] = []
  if (overdue.length > 0) alerts.push({ text: `${overdue.length} cobrança${overdue.length > 1 ? 's' : ''} em atraso`, tab: 'financeiro', tone: 'red' })
  if (manage && !waConnected) alerts.push({ text: 'WhatsApp não está conectado', tab: 'whatsapp', tone: 'amber' })
  if (changeRequests.length > 0) alerts.push({ text: `${changeRequests.length} ajuste${changeRequests.length > 1 ? 's' : ''} de campanha esperando sua resposta`, tab: 'campanhas', tone: 'amber' })
  if (!free && i.plan_status === 'pending_contract') alerts.push({ text: 'Contrato aguardando assinatura', tab: 'impl', tone: 'amber' })

  return (
    <div className="space-y-4">
      {alerts.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-bold text-amber-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Precisa da sua atenção</p>
          {alerts.map(a => (
            <button key={a.text} onClick={() => goTab(a.tab)} className="w-full flex items-center justify-between gap-3 text-left bg-white rounded-xl border border-amber-200 px-3.5 py-2.5 hover:bg-amber-50 transition-colors">
              <span className={`text-sm font-semibold ${a.tone === 'red' ? 'text-red-600' : 'text-amber-800'}`}>{a.text}</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Nada pendente nesta escola.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card icon={Building2} color="#0f766e" title="Dados da escola">
          <Row l="Plano" v={free ? 'Gratuito / Parceria' : i.plan === 'rede' ? 'Rede de Escolas' : 'Escola Padrão'} />
          <Row l="Consultor" v={consultantName || '—'} />
          <Row l="CNPJ" v={i.cnpj || '—'} />
          <Row l="Cliente desde" v={fmtDate(i.created_at)} />
          {contract && <Row l="Contrato" v={contractSt?.l || contract.status} />}
        </Card>

        <Card icon={Rocket} color={phase?.color || '#2563EB'} title="Implantação" tab="impl" goTab={goTab} action="Ver">
          {onboardingProcess ? (
            <>
              <Row l="Fase" v={`${currentPhaseIdx + 1} de ${TIMELINE_PHASES.length} · ${phase?.label}`} />
              <Row l="Checklist da fase" v={`${phaseDone} de ${phaseTasks.length}`} />
            </>
          ) : free ? (
            <p className="font-semibold text-gray-500">Sem implantação. Esta escola é gratuita.</p>
          ) : (
            <p className="text-gray-500">Processo de implantação ainda não iniciado.</p>
          )}
        </Card>

        <Card icon={Users} color="#7c3aed" title="Equipe" tab={manage ? 'equipe' : undefined} goTab={goTab} action="Ver">
          <Row l="Usuários" v={users.length} />
          <Row l="Ativos" v={users.filter(u => u.active).length} />
          <Row l="Administradores" v={users.filter(u => u.role === 'admin').length} />
        </Card>

        <Card icon={DollarSign} color="#16a34a" title="Financeiro" tab={manage ? 'financeiro' : undefined} goTab={goTab} action="Ver">
          {free ? (
            <p className="font-semibold text-gray-500">Escola gratuita, sem cobranças.</p>
          ) : (
            <>
              <Row l="Mensalidade" v={fmtBRL(i.monthly_value || 0)} />
              <Row l="Em aberto" v={open.length ? `${fmtBRL(openTotal)} (${open.length})` : 'Nada em aberto'} />
              {nextDue && <Row l="Próximo vencimento" v={fmtDate(nextDue)} />}
              {lastPaid && <Row l="Último pagamento" v={fmtDate(lastPaid.paid_at)} />}
              {monthly.length === 0 && <p className="text-gray-400 italic">Nenhuma mensalidade registrada.</p>}
            </>
          )}
        </Card>

        <Card icon={MessageCircle} color="#0891b2" title="WhatsApp" tab={manage ? 'whatsapp' : undefined} goTab={goTab} action="Ver">
          <div className="flex items-center gap-2 font-semibold">
            {waConnected ? <><Wifi className="w-4 h-4 text-green-600" /><span className="text-green-700">Conectado</span></> : <><WifiOff className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Não conectado</span></>}
          </div>
          {waSaved?.phone_number && <Row l="Número" v={waSaved.phone_number} />}
          <Row l="Conversas no mês" v={`${waUsage.count} de ${waUsage.limit}`} />
        </Card>

        <Card icon={Megaphone} color="#ea580c" title="Campanha" tab={manage ? 'campanhas' : undefined} goTab={goTab} action="Ver">
          {cycle ? (
            <>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{cycle.label || `Campanha ${cycle.target_school_year ?? cycle.year}`}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: cst!.c, background: cst!.bg }}>{cst!.l}</span>
              </div>
              {(cycle.start_date || cycle.end_date) && <Row l="Período" v={`${fmtDate(cycle.start_date)} a ${fmtDate(cycle.end_date)}`} />}
              {changeRequests.length > 0 && <Row l="Ajustes pedidos" v={changeRequests.length} />}
            </>
          ) : (
            <p className="text-gray-500">Nenhuma campanha criada.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
