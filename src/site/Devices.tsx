import { shotUrl } from './lib'

export function DeskFrame({ shot, alt, url = 'app.aionedu.com.br', className = '', eager = false }: { shot: string; alt: string; url?: string; className?: string; eager?: boolean }) {
  return (
    <div className={`st-desk ${className}`}>
      <div className="st-desk-bar"><i /><i /><i /><b>{url}</b></div>
      <img src={shotUrl(shot, 'd')} alt={alt} width="1360" height="820" loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </div>
  )
}

export function PhoneFrame({ shot, alt, className = '', eager = false }: { shot: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={`st-phone ${className}`}>
      <div><img src={shotUrl(shot, 'm')} alt={alt} width="780" height="1688" loading={eager ? 'eager' : 'lazy'} decoding="async" /></div>
    </div>
  )
}
