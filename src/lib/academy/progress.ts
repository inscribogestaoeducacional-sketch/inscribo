// Progresso da Academia por pessoa: banco (academy_progress) com cópia no aparelho.
// Se o banco falhar, a pessoa não perde nada: fica a cópia local e tentamos de novo na próxima abertura.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PROGRESS_EVENT, TOUR_END_EVENT } from './academy'

const lsKey = (uid: string) => `aion_academy_done_${uid}`
const readLocal = (uid: string): string[] => { try { return JSON.parse(localStorage.getItem(lsKey(uid)) || '[]') } catch { return [] } }
const writeLocal = (uid: string, keys: string[]) => { try { localStorage.setItem(lsKey(uid), JSON.stringify(keys)) } catch { /* sem armazenamento */ } }

let currentUid: string | null = null
let done: Set<string> = new Set()
let loaded = false
const subs = new Set<() => void>()
let snap = { done, loaded }
const emit = () => { snap = { done, loaded }; subs.forEach(f => f()) }

async function load(uid: string) {
  if (currentUid === uid && loaded) return
  currentUid = uid; loaded = false
  done = new Set(readLocal(uid)); emit()
  try {
    const { data, error } = await supabase.from('academy_progress').select('lesson_key').eq('user_id', uid).is('undone_at', null)
    if (!error && Array.isArray(data)) {
      const remote = new Set((data as { lesson_key: string }[]).map(r => r.lesson_key))
      // o que só existe no aparelho sobe para o banco (ex.: concluída sem internet)
      for (const k of done) if (!remote.has(k)) { supabase.rpc('academy_mark', { p_lesson_key: k }).then(() => {}, () => {}) }
      done = new Set([...done, ...remote])
      writeLocal(uid, [...done])
    }
  } catch { /* fica a cópia local */ }
  loaded = true; emit()
}

export async function markLessonDone(key: string) {
  if (!currentUid || done.has(key)) return
  done = new Set(done).add(key); writeLocal(currentUid, [...done]); emit()
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: { key } }))
  try { await supabase.rpc('academy_mark', { p_lesson_key: key }) } catch { /* já está salvo no aparelho */ }
}

export async function unmarkLessonDone(key: string) {
  if (!currentUid || !done.has(key)) return
  const next = new Set(done); next.delete(key); done = next; writeLocal(currentUid, [...done]); emit()
  try { await supabase.rpc('academy_unmark', { p_lesson_key: key }) } catch { /* idem */ }
}

let listening = false
function listen() {
  if (listening) return
  listening = true
  window.addEventListener(TOUR_END_EVENT, e => {
    const d = (e as CustomEvent<{ key: string; completed: boolean }>).detail
    if (d?.completed) markLessonDone(d.key)
  })
}

export function useAcademyProgress() {
  const { user } = useAuth()
  const s = useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => snap)
  useEffect(() => { listen(); if (user?.id) load(user.id) }, [user?.id])
  const mark = useCallback((k: string) => markLessonDone(k), [])
  const unmark = useCallback((k: string) => unmarkLessonDone(k), [])
  return { done: s.done, loaded: s.loaded, mark, unmark }
}
