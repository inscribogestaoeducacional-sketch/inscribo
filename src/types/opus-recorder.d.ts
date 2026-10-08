// Tipos mínimos do opus-recorder (o pacote não traz .d.ts) — só o que
// src/lib/voiceRecorder.ts usa.
declare module 'opus-recorder' {
  interface RecorderConfig {
    encoderPath?: string
    sourceNode?: MediaStreamAudioSourceNode
    numberOfChannels?: number
    encoderApplication?: number
    encoderSampleRate?: number
    streamPages?: boolean
  }
  export default class Recorder {
    constructor(config?: RecorderConfig)
    static isRecordingSupported(): boolean
    // Na prática entrega Uint8Array (conferido no Chrome/Edge).
    ondataavailable: (data: Uint8Array | ArrayBuffer) => void
    start(): Promise<void>
    stop(): Promise<void> | void
    close(): void
  }
}
