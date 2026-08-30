// Native Web Audio API level meter — no ML library needed. Taps into a
// MediaStream the caller already owns (from AIVisionPanel's combined
// getUserMedia({video, audio}) call) rather than requesting its own,
// so there's only ever one audio capture session.

export interface MicLevelMeter {
  /** Current RMS loudness, 0-100. */
  getLevel: () => number
  stop: () => void
}

export function createMicLevelMeter(stream: MediaStream): MicLevelMeter | null {
  if (stream.getAudioTracks().length === 0) return null

  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)

  const data = new Uint8Array(analyser.frequencyBinCount)

  function getLevel(): number {
    analyser.getByteTimeDomainData(data)
    let sumSquares = 0
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128
      sumSquares += normalized * normalized
    }
    const rms = Math.sqrt(sumSquares / data.length)
    // RMS for typical speech rarely exceeds ~0.3; scale so normal talking
    // reads in a useful mid-range rather than pinning near zero.
    return Math.min(100, Math.round(rms * 300))
  }

  function stop(): void {
    source.disconnect()
    analyser.disconnect()
    void audioCtx.close()
  }

  return { getLevel, stop }
}
