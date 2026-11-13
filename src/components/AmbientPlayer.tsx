import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import { useAppStore } from '../store/useAppStore'

/**
 * 雾岸轻音：全站背景音乐
 * - 进站先试着自动播放；被浏览器拦下时先静音播着，等用户第一次点击/按键再淡入
 * - 右下角常驻开关，选择记在本地；按 M 也能切
 * - 呼吸引导打开时自动把音量压低，不抢呼吸的节奏
 */

const KEY = 'sereneisle.v1.audio'
const SRC = '/audio/mist-shore.mp3'
const BASE = 0.4 // 背景乐的音量：能听见，但不盖过思路
const DUCK = 0.12
/** 手机上没有键盘，就别提快捷键了 */
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function AmbientPlayer({ placement = 'dock' }: { placement?: 'dock' | 'top' }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeTimer = useRef<number | null>(null)
  const unlockRef = useRef<(() => void) | null>(null)
  const onRef = useRef(readPref())
  const toastTimer = useRef<number | null>(null)

  const [on, setOn] = useState(onRef.current)
  const [blocked, setBlocked] = useState(false)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const breathingOpen = useAppStore((s) => s.breathing.open)

  /* 音量渐变：不用突然变响，耳朵会舒服一点 */
  const fadeTo = useCallback((target: number, ms: number, done?: () => void) => {
    const a = audioRef.current
    if (!a) return
    if (fadeTimer.current) window.clearInterval(fadeTimer.current)
    const from = a.volume
    const t0 = performance.now()
    fadeTimer.current = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / Math.max(1, ms))
      a.volume = Math.max(0, Math.min(1, from + (target - from) * k))
      if (k >= 1) {
        if (fadeTimer.current) window.clearInterval(fadeTimer.current)
        fadeTimer.current = null
        done?.()
      }
    }, 40)
  }, [])

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), text })
    toastTimer.current = window.setTimeout(() => setToast(null), 4200)
  }, [])

  /* 等一次用户手势，用来解除浏览器的自动播放限制 */
  const armUnlock = useCallback(() => {
    if (unlockRef.current) return
    const fire = () => {
      unlockRef.current = null
      document.removeEventListener('pointerdown', fire)
      document.removeEventListener('keydown', fire)
      document.removeEventListener('touchstart', fire)
      const a = audioRef.current
      if (!a || !onRef.current) return
      a.muted = false
      a.play()
        .then(() => {
          setBlocked(false)
          fadeTo(BASE, 1500)
          showToast(TOUCH ? '雾岸轻音 · 开始播放，点按钮可静音' : '雾岸轻音 · 开始播放，按 M 可静音')
        })
        .catch(() => {
          /* 还是不行就算了，按钮还在 */
        })
    }
    unlockRef.current = fire
    document.addEventListener('pointerdown', fire, { once: true })
    document.addEventListener('keydown', fire, { once: true })
    document.addEventListener('touchstart', fire, { once: true })
  }, [fadeTo, showToast])

  const start = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    a.muted = false
    a.play()
      .then(() => {
        setBlocked(false)
        fadeTo(BASE, 1600)
      })
      .catch(() => {
        // 被拦：先静音跑起来，等一次手势就能出声
        a.muted = true
        a.play()
          .then(() => setBlocked(true))
          .catch(() => setBlocked(true))
        armUnlock()
      })
  }, [armUnlock, fadeTo])

  const toggle = useCallback(() => {
    const next = !onRef.current
    onRef.current = next
    setOn(next)
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      /* 隐私模式下写不了，不碍事 */
    }
    const a = audioRef.current
    if (!a) return
    if (next) {
      a.muted = false
      a.play().catch(() => setBlocked(true))
      fadeTo(BASE, 900)
      setBlocked(false)
      showToast('雾岸轻音 · 正在播放')
    } else {
      fadeTo(0, 280, () => a.pause())
      showToast(TOUCH ? '已静音，点按钮可以再打开' : '已静音，按 M 可以再打开')
    }
  }, [fadeTo, showToast])

  /* 建一个 audio 元素，只建一次 */
  useEffect(() => {
    const a = new Audio(SRC)
    a.loop = true
    a.preload = 'auto'
    a.volume = 0
    audioRef.current = a
    return () => {
      a.pause()
      a.src = ''
      if (fadeTimer.current) window.clearInterval(fadeTimer.current)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  /* 开关 / 呼吸引导变化时，跟着调整 */
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (!on) {
      fadeTo(0, 300, () => a.pause())
      return
    }
    if (breathingOpen) {
      if (!a.paused) fadeTo(DUCK, 900)
      return
    }
    if (!a.paused) fadeTo(BASE, 900)
    else start()
  }, [on, breathingOpen, fadeTo, start])

  /* 切到别的标签页时先停下，回来再接着放 */
  useEffect(() => {
    const onVis = () => {
      const a = audioRef.current
      if (!a || !onRef.current) return
      if (document.hidden) a.pause()
      else
        a.play()
          .then(() => fadeTo(BASE, 900))
          .catch(() => setBlocked(true))
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [fadeTo])

  /* 快捷键 M */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  /* 被拦下时，提示过一次就不再打扰 */
  useEffect(() => {
    if (!blocked || !on) return
    showToast('点一下，让雾岸轻音陪你待一会儿')
  }, [blocked, on, showToast])

  return (
    <div
      className={
        placement === 'top'
          ? 'fixed right-4 top-4 z-40 flex flex-col-reverse items-end gap-2 sm:bottom-6 sm:right-6 sm:top-auto sm:flex-col'
          : 'fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6'
      }
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="ambient-tip"
            role="status"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggle}
        className="ambient-btn"
        data-on={on ? 'true' : 'false'}
        data-blocked={blocked ? 'true' : 'false'}
        aria-pressed={on}
        aria-label={on ? '暂停背景音乐（快捷键 M）' : '播放背景音乐（快捷键 M）'}
        title={on ? '雾岸轻音 · 按 M 暂停' : '雾岸轻音 · 按 M 播放'}
      >
        <span className="ambient-icon">
          <Icon name="volume" size={16} />
          <span className="ambient-slash" aria-hidden="true" />
        </span>

        <span className="ambient-eq" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>

        <span className="ambient-name">{on ? '雾岸轻音' : '打开音乐'}</span>
        <span className="ambient-kbd" aria-hidden="true">
          M
        </span>
      </button>
    </div>
  )
}
