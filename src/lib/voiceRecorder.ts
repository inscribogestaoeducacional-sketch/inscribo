// Gravação de áudio do Hub em formato que a Meta aceita.
//
// A Cloud API do WhatsApp aceita áudio em ogg/opus (mono), mp4/aac, mp3, aac e
// amr — NÃO aceita webm (erro 131053). O MediaRecorder do Chrome/Edge só grava
// webm, por isso todo áudio gravado no Hub falhava. Estratégia:
//   1. Navegador que toca ogg/opus (Chrome, Edge, Firefox, Android):
//      opus-recorder — codifica ogg/opus mono no próprio navegador (WASM num
//      worker). Chega no WhatsApp como mensagem de voz.
//   2. Safari (não toca ogg/opus, então nem a prévia funcionaria): MediaRecorder
//      nativo em audio/mp4 (aac), aceito pela Meta como áudio.
//   3. Nenhum dos dois: UnsupportedAudioFormatError — nunca cai em webm.
//
// O codificador (~385 KB) só é baixado quando alguém grava (import dinâmico +
// worker); o bundle principal ganha só a URL do worker.
import encoderPath from 'opus-recorder/dist/encoderWorker.min.js?url'

export type VoiceMimeType = 'audio/ogg' | 'audio/mp4'

export interface VoiceRecording {
  blob: Blob
  mimeType: VoiceMimeType
  ext: 'ogg' | 'm4a'
}

export interface VoiceRecorderHandle {
  mimeType: VoiceMimeType
  stop(): Promise<VoiceRecording>
  cancel(): void
}

export class UnsupportedAudioFormatError extends Error {
  constructor() {
    super('Este navegador não consegue gravar áudio num formato aceito pelo WhatsApp. Use o Chrome, o Edge, o Firefox ou o Safari atualizados.')
    this.name = 'UnsupportedAudioFormatError'
  }
}

function canPlayOggOpus(): boolean {
  try {
    return document.createElement('audio').canPlayType('audio/ogg; codecs=opus') !== ''
  } catch {
    return false
  }
}

async function startOpusRecorder(stream: MediaStream, ctx: AudioContext): Promise<VoiceRecorderHandle> {
  const { default: Recorder } = await import('opus-recorder')
  if (!Recorder.isRecordingSupported()) throw new UnsupportedAudioFormatError()
  const sourceNode = ctx.createMediaStreamSource(stream)
  const rec = new Recorder({
    encoderPath,
    sourceNode,
    numberOfChannels: 1,        // a Meta só aceita ogg/opus mono
    encoderApplication: 2048,   // voz
    encoderSampleRate: 48000,
    streamPages: false,         // arquivo completo de uma vez, no stop
  })
  let resolveData: ((data: Uint8Array | ArrayBuffer) => void) | null = null
  const dataPromise = new Promise<Uint8Array | ArrayBuffer>(resolve => { resolveData = resolve })
  rec.ondataavailable = data => resolveData?.(data)
  await rec.start()
  return {
    mimeType: 'audio/ogg',
    async stop() {
      rec.stop()
      const data = await dataPromise
      sourceNode.disconnect()
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
      return { blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'audio/ogg' }), mimeType: 'audio/ogg', ext: 'ogg' }
    },
    cancel() {
      rec.ondataavailable = () => {}
      try { rec.stop() } catch { /* já parado */ }
      sourceNode.disconnect()
    },
  }
}

function startMp4Recorder(stream: MediaStream): VoiceRecorderHandle {
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/mp4' })
  const chunks: Blob[] = []
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
  const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve() })
  recorder.start(100)
  return {
    mimeType: 'audio/mp4',
    async stop() {
      if (recorder.state !== 'inactive') recorder.stop()
      await stopped
      return { blob: new Blob(chunks, { type: 'audio/mp4' }), mimeType: 'audio/mp4', ext: 'm4a' }
    },
    cancel() {
      recorder.ondataavailable = null
      if (recorder.state !== 'inactive') recorder.stop()
    },
  }
}

export async function startVoiceRecording(stream: MediaStream, ctx: AudioContext): Promise<VoiceRecorderHandle> {
  const mp4Supported = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')
  if (canPlayOggOpus()) {
    try {
      return await startOpusRecorder(stream, ctx)
    } catch (err) {
      console.error('[voiceRecorder] opus-recorder falhou', err)
      if (!mp4Supported) throw new UnsupportedAudioFormatError()
    }
  }
  if (mp4Supported) return startMp4Recorder(stream)
  throw new UnsupportedAudioFormatError()
}

// Rede de segurança no envio: só formatos aceitos pela Meta saem do Hub.
export function isMetaAcceptedAudio(mimeType: string): boolean {
  return /^audio\/(ogg|mp4|mpeg|aac|amr)\b/.test(mimeType) && !/webm/.test(mimeType)
}
