import { RefreshCw, AlertCircle } from 'lucide-react'
import { BrandLoader } from './BrandLoader'

interface LoadingStateProps {
  loading?: boolean
  error?: string | null
  empty?: boolean
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  onRetry?: () => void
  children: React.ReactNode
  minHeight?: number
}

export function LoadingState({
  loading,
  error,
  empty,
  emptyMessage = 'Nenhum dado encontrado',
  emptyIcon,
  onRetry,
  children,
  minHeight = 200,
}: LoadingStateProps) {
  if (loading) {
    return <div style={{ minHeight }}><BrandLoader /></div>
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight, flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertCircle size={22} color="#DC2626" />
        </div>
        <p style={{ color: '#DC2626', fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 300 }}>{error}</p>
        {onRetry && (
          <button onClick={onRetry} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Tentar novamente
          </button>
        )}
      </div>
    )
  }

  if (empty) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight, flexDirection: 'column', gap: 10 }}>
        {emptyIcon && <div style={{ opacity: 0.3 }}>{emptyIcon}</div>}
        <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>{emptyMessage}</p>
      </div>
    )
  }

  return <>{children}</>
}
