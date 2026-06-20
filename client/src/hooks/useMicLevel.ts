import { useEffect, useRef, useState } from 'react'

/**
 * Nível do microfone (0..1) lido em tempo real via Web Audio.
 * Pausa quando `active` é false (ex.: mudo) ou não há stream.
 */
export function useMicLevel(stream: MediaStream | null, active: boolean): number {
  const [level, setLevel] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!stream || !active) {
      setLevel(0)
      return
    }

    type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctx = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext
    if (!Ctx) return

    const ctx = new Ctx()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    let smooth = 0
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      smooth = smooth * 0.7 + Math.min(1, rms * 3.2) * 0.3
      setLevel(smooth)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      source.disconnect()
      void ctx.close()
    }
  }, [stream, active])

  return level
}
