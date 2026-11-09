// Imagens das questões ficam num bucket privado; aqui: envio e exibição por link temporário.
import { useEffect, useState } from 'react'
import { db } from '../../lib/concurso'

export async function uploadContestImage(file: File, institutionId: string, contestId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png'
  if (file.size > 3 * 1024 * 1024) throw new Error('A imagem passa de 3 MB. Reduza e tente de novo.')
  const path = `${institutionId}/${contestId}/${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('contest-media').upload(path, file, { contentType: file.type || 'image/png' })
  if (error) throw error
  return path
}

export function ContestImg({ path, style }: { path: string; style?: React.CSSProperties }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    db.storage.from('contest-media').createSignedUrl(path, 3600).then(({ data }: any) => { if (alive) setUrl(data?.signedUrl ?? null) })
    return () => { alive = false }
  }, [path])
  if (!url) return <div style={{ height: 80, borderRadius: 10, background: '#F1F5F9', ...style }} />
  return <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 10, border: '1px solid #E3E8F0', ...style }} />
}
