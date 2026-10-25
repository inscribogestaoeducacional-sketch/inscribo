import type { TourStep, TourTarget } from '../academy'

// Atalhos para escrever os passos do "Fazer comigo".
/** Abre a tela e explica (todo tour começa assim). */
export const go = (route: string, say: string, target?: TourTarget, ifMissing?: string): TourStep => ({ say, route, action: 'info', target, ifMissing })
/** Só mostra e explica. */
export const info = (say: string, target?: TourTarget, ifMissing?: string, endIfMissing?: boolean): TourStep => ({ say, action: 'info', target, ifMissing, endIfMissing })
/** A pessoa toca na opção de verdade. Nunca use em algo destrutivo. */
export const click = (say: string, target: TourTarget, ifMissing?: string, endIfMissing?: boolean): TourStep => ({ say, action: 'click', target, ifMissing, endIfMissing })
/** A pessoa preenche o campo e toca em "Próximo". */
export const fill = (say: string, target: TourTarget, ifMissing?: string): TourStep => ({ say, action: 'fill', target, ifMissing })
/** Último passo de toda aula. */
export const done = (say: string): TourStep => ({ say: `Pronto! ${say}`, action: 'info' })
