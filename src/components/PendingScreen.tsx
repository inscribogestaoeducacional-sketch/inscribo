import { FileText, CreditCard, Clock } from 'lucide-react'

export default function PendingScreen({ type }: { type: 'contract' | 'payment' }) {
  const isContract = type === 'contract'
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${isContract ? 'bg-indigo-100' : 'bg-amber-100'}`}>
          {isContract
            ? <FileText className="w-8 h-8 text-indigo-600" />
            : <CreditCard className="w-8 h-8 text-amber-600" />
          }
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {isContract ? 'Aguardando assinatura do contrato' : 'Aguardando confirmação do pagamento'}
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          {isContract
            ? 'Seu contrato foi enviado para assinatura. Assim que assinar, seu acesso será liberado automaticamente.'
            : 'Realize o pagamento da taxa de implantação para liberar o acesso completo ao sistema.'
          }
        </p>
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 text-sm text-gray-500">
          <Clock className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <span>Em caso de dúvidas, entre em contato com seu consultor.</span>
        </div>
        <a href="https://wa.me/5583985556393" target="_blank" rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:from-green-600 hover:to-emerald-700">
          💬 Falar com suporte via WhatsApp
        </a>
      </div>
    </div>
  )
}
