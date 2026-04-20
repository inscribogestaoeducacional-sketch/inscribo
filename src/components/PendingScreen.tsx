import { FileText, CreditCard, Clock, MessageCircle } from 'lucide-react'

export default function PendingScreen({ type }: { type: 'contract' | 'payment' | 'suspended' }) {
  const config = {
    contract: {
      icon: FileText,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
      title: 'Aguardando assinatura do contrato',
      description: 'Seu contrato foi enviado para assinatura. Verifique seu e-mail e assine para liberar o acesso completo ao sistema.',
    },
    payment: {
      icon: CreditCard,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      title: 'Aguardando confirmação do pagamento',
      description: 'Realize o pagamento da taxa de implantação para liberar o acesso completo ao sistema. Verifique seu e-mail para o link de pagamento.',
    },
    suspended: {
      icon: Clock,
      color: 'text-red-600',
      bg: 'bg-red-100',
      title: 'Acesso suspenso',
      description: 'O acesso da sua escola foi suspenso. Entre em contato com seu consultor para regularizar a situação.',
    },
  }

  const { icon: Icon, color, bg, title, description } = config[type]

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <div className={`w-16 h-16 rounded-2xl ${bg} flex items-center justify-center mx-auto mb-6`}>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">{description}</p>
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 text-sm text-gray-500 mb-4">
          <Clock className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <span>Em caso de dúvidas, entre em contato com seu consultor.</span>
        </div>
        <a href="https://wa.me/5583985556393" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:from-green-600 hover:to-emerald-700">
          <MessageCircle className="w-4 h-4" /> Falar com suporte via WhatsApp
        </a>
      </div>
    </div>
  )
}
