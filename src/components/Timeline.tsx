import { Pause, Play, SkipBack } from 'lucide-react'
import { useEffect } from 'react'
import { useAppStore } from '../state/useAppStore'
import type { Toolpath } from '../types/domain'

export function Timeline({ toolpath }: { toolpath: Toolpath }) {
  const timeline = useAppStore((state) => state.timeline)
  const isPlaying = useAppStore((state) => state.isPlaying)
  const playbackSpeed = useAppStore((state) => state.playbackSpeed)
  const setTimeline = useAppStore((state) => state.setTimeline)
  const setIsPlaying = useAppStore((state) => state.setIsPlaying)
  const setPlaybackSpeed = useAppStore((state) => state.setPlaybackSpeed)

  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const delta = now - previous
      previous = now
      setTimeline(Math.min(1, useAppStore.getState().timeline + delta * 0.000012 * playbackSpeed))
      if (useAppStore.getState().timeline >= 1) setIsPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, playbackSpeed, setIsPlaying, setTimeline])

  const activeIndex = Math.min(
    toolpath.orderedPoints.length - 1,
    Math.max(0, Math.floor(toolpath.orderedPoints.length * timeline)),
  )
  const point = toolpath.orderedPoints[activeIndex]
  const estimatedSeconds = toolpath.totalLength / 35 + toolpath.travelLength / 140
  const currentSeconds = estimatedSeconds * timeline
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

  return (
    <footer className="timeline-bar">
      <div className="timeline-controls">
        <button
          className="play-button"
          onClick={() => {
            if (timeline >= 1) setTimeline(0)
            setIsPlaying(!isPlaying)
          }}
          aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
        </button>
        <button className="skip-button" onClick={() => { setTimeline(0); setIsPlaying(false) }} aria-label="Restart simulation">
          <SkipBack size={14} />
        </button>
        <select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} aria-label="Playback speed">
          {[1, 5, 20, 100].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
        </select>
      </div>

      <div className="timeline-track-wrap">
        <div className="timeline-labels">
          <span>Toolpath progression</span>
          <span>{formatTime(currentSeconds)} / {formatTime(estimatedSeconds)}</span>
        </div>
        <div className="timeline-track">
          <div className="timeline-progress" style={{ width: `${timeline * 100}%` }} />
          <div className="timeline-ticks" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.0005}
            value={timeline}
            onChange={(event) => { setTimeline(Number(event.target.value)); setIsPlaying(false) }}
            aria-label="Toolpath timeline"
          />
        </div>
      </div>

      <div className="cursor-readout">
        <span>PATH <strong>{point?.pathID ?? '—'}</strong></span>
        <span>LAYER <strong>{point?.constructionLayer ?? '—'}</strong></span>
        <span>X <strong>{point?.x.toFixed(2) ?? '—'}</strong></span>
        <span>Y <strong>{point?.y.toFixed(2) ?? '—'}</strong></span>
        <span>Z <strong>{point?.z.toFixed(2) ?? '—'}</strong></span>
        <span>E <strong>{point?.e.toFixed(2) ?? '—'}</strong></span>
      </div>
    </footer>
  )
}
