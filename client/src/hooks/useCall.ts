import { useCallback, useEffect, useRef, useState } from 'react'
import * as signaling from '../lib/signaling'
import type { ApiError } from '../lib/signaling'
import type { CallState, Quality, SignalMessage } from '../types'

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

const CAN_SHARE_SCREEN =
  typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const statusOf = (e: unknown) => (e as ApiError)?.status

export interface UseCall {
  state: CallState
  remoteName: string | null
  muted: boolean
  sharing: boolean
  canShareScreen: boolean
  quality: Quality
  connectedAt: number | null
  error: string | null
  notice: string | null
  mics: MediaDeviceInfo[]
  currentMicId: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  remoteScreenStream: MediaStream | null
  join: (name: string) => Promise<void>
  leave: () => void
  toggleMute: () => void
  selectMic: (deviceId: string) => Promise<void>
  shareScreen: () => Promise<void>
  stopScreen: () => void
}

export function useCall(): UseCall {
  const [state, setState] = useState<CallState>('idle')
  const [remoteName, setRemoteName] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [quality, setQuality] = useState<Quality>('unknown')
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [currentMicId, setCurrentMicId] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenSenderRef = useRef<RTCRtpSender | null>(null)
  const myIdRef = useRef<number | null>(null)
  const pollSessionRef = useRef(0)
  const nameRef = useRef('')
  const mutedRef = useRef(false)
  const statsTimerRef = useRef<number | null>(null)

  // Perfect negotiation
  const politeRef = useRef(true)
  const makingOfferRef = useRef(false)
  const ignoreOfferRef = useRef(false)

  const refreshMics = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(devices.filter((d) => d.kind === 'audioinput'))
    } catch {
      /* sem permissão ainda */
    }
  }, [])

  const sendSignal = useCallback((data: SignalMessage) => {
    const id = myIdRef.current
    if (id == null) return
    signaling.signal(id, data).catch((err) => console.warn('signal falhou:', err))
  }, [])

  const stopStats = useCallback(() => {
    if (statsTimerRef.current != null) {
      window.clearInterval(statsTimerRef.current)
      statsTimerRef.current = null
    }
  }, [])

  const startStats = useCallback(() => {
    stopStats()
    statsTimerRef.current = window.setInterval(async () => {
      const pc = pcRef.current
      if (!pc || pc.connectionState !== 'connected') return
      try {
        const stats = await pc.getStats()
        let rtt = -1
        let loss = -1
        stats.forEach((report) => {
          const r = report as unknown as {
            type: string
            state?: string
            currentRoundTripTime?: number
            kind?: string
            packetsLost?: number
            packetsReceived?: number
          }
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && typeof r.currentRoundTripTime === 'number') {
            rtt = r.currentRoundTripTime
          }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            const lost = r.packetsLost ?? 0
            const recv = r.packetsReceived ?? 0
            if (recv > 0) loss = lost / (lost + recv)
          }
        })
        if (rtt < 0 && loss < 0) return
        let q: Quality = 'good'
        if ((rtt >= 0 && rtt > 0.3) || (loss >= 0 && loss > 0.08)) q = 'poor'
        else if ((rtt >= 0 && rtt > 0.15) || (loss >= 0 && loss > 0.03)) q = 'ok'
        setQuality(q)
      } catch {
        /* ignora amostra */
      }
    }, 2000)
  }, [stopStats])

  const stopMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLocalStream(null)
  }, [])

  const stopScreen = useCallback(() => {
    const pc = pcRef.current
    const sender = screenSenderRef.current
    if (pc && sender) {
      try {
        pc.removeTrack(sender) // dispara renegociação
      } catch {
        /* já removido */
      }
    }
    screenSenderRef.current = null
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    setSharing(false)
  }, [])

  // setupPc/handleSignal/maybeRecover referenciam-se mutuamente; como todos são
  // estáveis (useCallback []), as referências resolvem em runtime sem problema.
  const setupPc = useCallback(() => {
    pcRef.current?.close()
    const pc = new RTCPeerConnection({ iceServers: [] }) // só rede local

    pc.onicecandidate = (ev) => {
      if (ev.candidate) sendSignal({ candidate: ev.candidate.toJSON() })
    }

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track])
      if (ev.track.kind === 'audio') {
        setRemoteStream(stream)
      } else {
        const show = () => setRemoteScreenStream(stream)
        const hide = () => setRemoteScreenStream(null)
        show()
        ev.track.onmute = hide
        ev.track.onunmute = show
        ev.track.onended = hide
      }
    }

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true
        await pc.setLocalDescription()
        if (pc.localDescription) sendSignal({ description: pc.localDescription })
      } catch (err) {
        console.error('negotiationneeded:', err)
      } finally {
        makingOfferRef.current = false
      }
    }

    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return
      const st = pc.connectionState
      if (st === 'connected') {
        setState('connected')
        setConnectedAt((prev) => prev ?? Date.now())
        sendSignal({ name: nameRef.current })
        startStats()
      } else if (st === 'failed') {
        setState('reconnecting')
        window.setTimeout(() => maybeRecover(), 800)
      } else if (st === 'disconnected') {
        setState('reconnecting')
      }
    }

    // (re)anexa as faixas locais já existentes (microfone + tela, se houver)
    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!))
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0]
    if (screenTrack && screenStreamRef.current) {
      screenSenderRef.current = pc.addTrack(screenTrack, screenStreamRef.current)
    }

    pcRef.current = pc
    return pc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendSignal, startStats])

  const handleBye = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    screenSenderRef.current = null
    stopStats()
    setRemoteStream(null)
    setRemoteScreenStream(null)
    setRemoteName(null)
    setConnectedAt(null)
    setQuality('unknown')
    setState('waiting')
  }, [stopStats])

  const handleSignal = useCallback(
    async (msg: SignalMessage) => {
      if (myIdRef.current == null) return
      if (msg.name) setRemoteName(msg.name)
      if (msg.bye) {
        handleBye()
        return
      }
      if (!msg.description && !msg.candidate) return

      const pc = pcRef.current ?? setupPc()
      try {
        if (msg.description) {
          const offerCollision =
            msg.description.type === 'offer' && (makingOfferRef.current || pc.signalingState !== 'stable')
          ignoreOfferRef.current = !politeRef.current && offerCollision
          if (ignoreOfferRef.current) return

          await pc.setRemoteDescription(msg.description)
          if (msg.description.type === 'offer') {
            await pc.setLocalDescription()
            if (pc.localDescription) sendSignal({ description: pc.localDescription })
          }
        } else if (msg.candidate) {
          try {
            await pc.addIceCandidate(msg.candidate)
          } catch (err) {
            if (!ignoreOfferRef.current) console.warn('addIceCandidate:', err)
          }
        }
      } catch (err) {
        console.error('negociação:', err)
      }
    },
    [handleBye, sendSignal, setupPc],
  )

  const maybeRecover = useCallback(() => {
    if (myIdRef.current == null) return
    const pc = pcRef.current
    if (!pc || pc.connectionState === 'connected') return
    try {
      pc.restartIce() // dispara onnegotiationneeded com ICE restart
    } catch {
      /* navegador antigo */
    }
  }, [])

  const teardown = useCallback(
    (endNotice: string | null) => {
      pollSessionRef.current++
      myIdRef.current = null
      politeRef.current = true
      makingOfferRef.current = false
      ignoreOfferRef.current = false
      pcRef.current?.close()
      pcRef.current = null
      screenSenderRef.current = null
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      stopStats()
      stopMic()
      setRemoteStream(null)
      setRemoteScreenStream(null)
      setRemoteName(null)
      setSharing(false)
      setMuted(false)
      mutedRef.current = false
      setQuality('unknown')
      setConnectedAt(null)
      setNotice(endNotice)
      setState('ended')
    },
    [stopMic, stopStats],
  )

  const pollLoop = useCallback(async () => {
    const session = ++pollSessionRef.current
    while (session === pollSessionRef.current && myIdRef.current != null) {
      try {
        const { messages } = await signaling.poll(myIdRef.current)
        if (session !== pollSessionRef.current) return
        for (const m of messages) await handleSignal(m)
      } catch (err) {
        if (statusOf(err) === 410) {
          if (session === pollSessionRef.current) teardown('A conexão com o servidor caiu.')
          return
        }
        await sleep(2000)
      }
    }
  }, [handleSignal, teardown])

  const join = useCallback(
    async (name: string) => {
      setError(null)
      setNotice(null)
      nameRef.current = name.trim() || 'Alguém'
      setState('requesting-mic')

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS })
      } catch {
        setError('Sem acesso ao microfone. Libere a permissão no navegador e tente de novo.')
        setState('idle')
        return
      }
      streamRef.current = stream
      setLocalStream(stream)
      setMuted(false)
      mutedRef.current = false
      void refreshMics()
      setCurrentMicId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? null)

      let joined: signaling.JoinResult
      const deadline = Date.now() + 30000
      for (;;) {
        try {
          joined = await signaling.join(nameRef.current)
          break
        } catch (err) {
          if (statusOf(err) === 409 && Date.now() < deadline) {
            setError('A sala parece cheia — tentando entrar...')
            await sleep(3000)
            continue
          }
          setError(
            statusOf(err) === 409
              ? 'A sala já está cheia (2 pessoas).'
              : 'Não consegui falar com o servidor. Ele está rodando?',
          )
          stopMic()
          setState('idle')
          return
        }
      }

      setError(null)
      myIdRef.current = joined.id
      setConnectedAt(null)
      void pollLoop()

      if (joined.otherPresent) {
        // Quem chega por último inicia: impolite + cria a oferta (via negotiationneeded)
        politeRef.current = false
        setState('connecting')
        setupPc()
      } else {
        // Quem chega primeiro espera a oferta do outro (polite, pc criado sob demanda)
        politeRef.current = true
        setState('waiting')
      }
    },
    [pollLoop, refreshMics, setupPc, stopMic],
  )

  const leave = useCallback(() => {
    const id = myIdRef.current
    if (id != null) {
      sendSignal({ bye: true })
      signaling.leave(id).catch(() => {})
    }
    teardown('Você desligou.')
  }, [sendSignal, teardown])

  const toggleMute = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    mutedRef.current = !track.enabled
    setMuted(!track.enabled)
  }, [])

  const selectMic = useCallback(async (deviceId: string) => {
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: { ...AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } },
      })
      const nextTrack = next.getAudioTracks()[0]
      nextTrack.enabled = !mutedRef.current

      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'audio')
      if (sender) await sender.replaceTrack(nextTrack)

      streamRef.current?.getAudioTracks().forEach((t) => t.stop())
      streamRef.current = next
      setLocalStream(next)
      setCurrentMicId(deviceId)
    } catch (err) {
      console.error('troca de microfone falhou:', err)
    }
  }, [])

  const shareScreen = useCallback(async () => {
    if (!CAN_SHARE_SCREEN) {
      setError('Seu navegador não permite compartilhar a tela.')
      return
    }
    const pc = pcRef.current
    if (!pc) return
    let display: MediaStream
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    } catch {
      return // usuário cancelou
    }
    const track = display.getVideoTracks()[0]
    if (!track) return
    screenStreamRef.current = display
    screenSenderRef.current = pc.addTrack(track, display) // dispara renegociação
    setSharing(true)
    track.onended = () => stopScreen() // usuário clicou em "parar" do navegador
  }, [stopScreen])

  // Lista de microfones + atualização quando dispositivos mudam
  useEffect(() => {
    void refreshMics()
    const md = navigator.mediaDevices
    md.addEventListener?.('devicechange', refreshMics)
    return () => md.removeEventListener?.('devicechange', refreshMics)
  }, [refreshMics])

  // Reconecta ao voltar do bloqueio de tela / quando a rede volta
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeRecover()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', maybeRecover)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', maybeRecover)
    }
  }, [maybeRecover])

  // Avisa o servidor ao fechar a aba
  useEffect(() => {
    const onHide = () => {
      const id = myIdRef.current
      if (id != null) navigator.sendBeacon('/api/leave', JSON.stringify({ id }))
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  return {
    state,
    remoteName,
    muted,
    sharing,
    canShareScreen: CAN_SHARE_SCREEN,
    quality,
    connectedAt,
    error,
    notice,
    mics,
    currentMicId,
    localStream,
    remoteStream,
    remoteScreenStream,
    join,
    leave,
    toggleMute,
    selectMic,
    shareScreen,
    stopScreen,
  }
}
