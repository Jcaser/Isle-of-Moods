import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icons'
import { findAccount, listAccounts, login, validateName, validatePassword, type IslandAccount } from '../lib/auth'
import { useAuthStore } from '../store/useAuthStore'

const QUOTES = [
  '你不需要先变好，才配得上被安慰。',
  '焦虑不是敌人，它只是太想保护你。',
  '今天的进度条，走一格也算数。',
  '允许自己慢一点，潮水从不催岸。',
]

/** 岛与灯塔：登录页的场景（纯 SVG + CSS 动画，无外部资源） */
function GateScene() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="presentation">
        <defs>
          <linearGradient id="gate-sky" x1="0.2" y1="0" x2="0.5" y2="1">
            <stop offset="0" stopColor="#f9fcfe" />
            <stop offset="0.38" stopColor="#eaf4fa" />
            <stop offset="0.66" stopColor="#f3edf1" />
            <stop offset="1" stopColor="#fbeedd" />
          </linearGradient>
          <radialGradient id="gate-sun" cx="0.5" cy="0.5">
            <stop offset="0" stopColor="#fffbe8" stopOpacity="0.95" />
            <stop offset="0.34" stopColor="#ffe9b4" stopOpacity="0.66" />
            <stop offset="1" stopColor="#ffd89a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gate-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bcdde8" />
            <stop offset="0.45" stopColor="#a8cfdd" />
            <stop offset="1" stopColor="#8fc2d4" />
          </linearGradient>
          <linearGradient id="gate-island" x1="0.1" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#cfe3d8" />
            <stop offset="0.55" stopColor="#aecdbd" />
            <stop offset="1" stopColor="#8fb5ab" />
          </linearGradient>
          <linearGradient id="gate-cliff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9dbcb0" />
            <stop offset="1" stopColor="#7ea197" />
          </linearGradient>
          <linearGradient id="gate-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff6d6" stopOpacity="0.62" />
            <stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="1440" height="900" fill="url(#gate-sky)" />

        {/* 低垂的太阳 */}
        <circle cx="1148" cy="596" r="230" fill="url(#gate-sun)" />
        <circle cx="1148" cy="596" r="40" fill="#fffaea" opacity="0.92" />

        {/* 云 */}
        <g fill="#ffffff" opacity="0.6">
          <ellipse cx="290" cy="150" rx="120" ry="20" />
          <ellipse cx="352" cy="138" rx="76" ry="16" />
          <ellipse cx="1210" cy="330" rx="104" ry="16" />
          <ellipse cx="1272" cy="318" rx="60" ry="12" />
        </g>

        {/* 远处的礁屿 */}
        <g opacity="0.55" fill="#a9c8cd">
          <path d="M760 596 C 782 566 818 556 842 570 C 864 582 874 590 886 596 Z" />
          <path d="M960 596 C 976 578 998 574 1012 584 C 1022 590 1028 594 1036 596 Z" />
        </g>

        {/* 海面 */}
        <rect x="0" y="596" width="1440" height="304" fill="url(#gate-sea)" />

        {/* 太阳的水面倒影 */}
        <g opacity="0.55">
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse
              key={i}
              cx={1148 + (i % 3 - 1) * 12}
              cy={616 + i * 22}
              rx={78 - i * 6}
              ry={2.4}
              fill="#fff6d8"
              opacity={0.7 - i * 0.06}
            />
          ))}
        </g>

        {/* 主岛：左下 */}
        <g transform="translate(300,668) scale(0.92)">
          {/* 岩体 */}
          <path
            d="M-268 92 C -236 52 -178 22 -104 12 C -34 2 40 14 96 44 C 140 68 170 84 196 92 Z"
            fill="url(#gate-cliff)"
          />
          {/* 草地 */}
          <path
            d="M-258 74 C -228 40 -172 14 -100 6 C -34 -2 36 10 90 38 C 126 56 150 68 170 74
               C 120 92 20 100 -80 96 C -160 92 -220 88 -258 74 Z"
            fill="url(#gate-island)"
          />
          {/* 沙滩边 */}
          <path d="M-246 78 C -180 100 -40 104 92 82 C 140 88 168 90 184 92 L -262 92 Z" fill="#f4e8d2" opacity="0.9" />

          {/* 树 */}
          <g>
            {[
              [-176, 38, 22],
              [-124, 20, 26],
              [-66, 12, 21],
              [26, 24, 20],
              [66, 40, 16],
            ].map(([x, y, r], i) => (
              <g key={i}>
                <rect x={x - 1.6} y={y} width="3.2" height={r * 0.9} rx="1.4" fill="#b79a72" opacity="0.55" />
                <circle cx={x} cy={y} r={r} fill={i % 2 ? '#83ad9c' : '#96bda9'} />
                <circle cx={x - r * 0.3} cy={y - r * 0.32} r={r * 0.52} fill="rgba(255,255,255,0.32)" />
              </g>
            ))}
          </g>

          {/* 小屋 */}
          <g transform="translate(-34,22)">
            <rect x="-16" y="-8" width="32" height="20" rx="2" fill="#fffdf6" stroke="#e0d2bb" strokeWidth="1.2" />
            <path d="M-21 -8 L0 -22 L21 -8 Z" fill="#e9b4a2" stroke="#dcae9c" strokeWidth="1" />
            <rect x="-4" y="0" width="8" height="12" rx="1" fill="#f6dcc0" />
            <rect x="8" y="-3" width="6" height="5" rx="1" fill="#ffe9a8" />
          </g>

          {/* 灯塔 */}
          <g transform="translate(-132,4)">
            <path d="M-14 58 L-9 -52 L9 -52 L14 58 Z" fill="#fffdf7" stroke="#ddd0bd" strokeWidth="1.6" />
            <path d="M-12.2 -22 L12.2 -22 L13 -6 L-13 -6 Z" fill="#efb4a2" opacity="0.9" />
            <path d="M-10.6 6 L10.6 6 L11.4 20 L-11.4 20 Z" fill="#efb4a2" opacity="0.9" />
            <rect x="-12" y="-66" width="24" height="14" rx="3" fill="#f9ebd0" stroke="#ddd0bd" strokeWidth="1.4" />
            <circle cx="0" cy="-59" r="4.8" fill="#ffd98a" />
            <circle cx="0" cy="-59" r="11" fill="#ffe6a8" opacity="0.35" />
            <g style={{ transformOrigin: '0px -59px' }} className="gate-beam">
              <path d="M0 -59 L300 -128 L300 12 Z" fill="url(#gate-beam)" />
            </g>
          </g>

          {/* 码头 */}
          <g transform="translate(120,48)" opacity="0.95">
            <rect x="0" y="0" width="64" height="4.6" rx="1.8" fill="#e6dac4" />
            <rect x="6" y="4.6" width="3" height="12" fill="#d6c6ab" />
            <rect x="24" y="4.6" width="3" height="12" fill="#d6c6ab" />
            <rect x="42" y="4.6" width="3" height="12" fill="#d6c6ab" />
            <rect x="58" y="4.6" width="3" height="12" fill="#d6c6ab" />
          </g>
        </g>

        {/* 小舟 */}
        <g transform="translate(690,700) scale(1.15)" opacity="0.9">
          <g className="gate-boat">
            <path d="M-18 0 q 18 9 36 0 Z" fill="#fffdf8" stroke="#d9cfc0" strokeWidth="1" />
            <path d="M0 -1 L0 -20 L12 -4 Z" fill="#faf3e4" stroke="#d9cfc0" strokeWidth="0.8" />
            <path d="M0 -1 L0 -17 L-9 -4 Z" fill="#ffffff" stroke="#d9cfc0" strokeWidth="0.8" />
            <path d="M-20 5 q 20 7 40 0" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" fill="none" />
          </g>
        </g>

        {/* 波纹 */}
        <g stroke="#ffffff" fill="none" strokeLinecap="round">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M${-80 + i * 70} ${646 + i * 42} q 64 -11 128 0 t 128 0 t 128 0 t 128 0 t 128 0 t 128 0 t 128 0 t 128 0`}
              strokeWidth={1.7 - i * 0.16}
              opacity={0.4 - i * 0.045}
            />
          ))}
        </g>

        {/* 飞鸟 */}
        <g stroke="#9fb8c2" strokeWidth="1.4" fill="none" opacity="0.6" strokeLinecap="round">
          <path d="M980 470 q 5 -6 10 0 q 5 -6 10 0" />
          <path d="M1010 452 q 4 -5 8 0 q 4 -5 8 0" />
          <path d="M1052 486 q 3 -4 7 0 q 3 -4 7 0" />
        </g>

        {/* 浮尘 */}
        <g fill="#ffffff">
          {Array.from({ length: 28 }, (_, i) => {
            const x = ((i * 173) % 1400) + 20
            const y = 90 + ((i * 97) % 460)
            const r = 1 + ((i * 7) % 3) * 0.45
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                opacity={0.55}
                className="gate-star"
                style={{ animationDelay: `${(i % 7) * 0.6}s` }}
              />
            )
          })}
        </g>
      </svg>

      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_16%_8%,rgba(255,255,255,0.62),transparent_58%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/45 to-transparent" />
    </div>
  )
}

type Step = 'form' | 'confirm'

export function Gate() {
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const enter = useAuthStore((s) => s.enter)
  const enterAsGuest = useAuthStore((s) => s.enterAsGuest)

  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [entering, setEntering] = useState(false)
  const [quote, setQuote] = useState(0)
  const [pending, setPending] = useState<IslandAccount | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)
  const pwRef = useRef<HTMLInputElement>(null)

  const accounts = useMemo(() => listAccounts(), [])
  const existing = useMemo(() => (name.trim() ? findAccount(name) : null), [name])

  useEffect(() => {
    const id = window.setTimeout(() => setQuote((q) => (q + 1) % QUOTES.length), 7200)
    return () => window.clearTimeout(id)
  }, [quote])

  useEffect(() => {
    const t = window.setTimeout(() => nameRef.current?.focus(), 420)
    return () => window.clearTimeout(t)
  }, [])

  const reset = () => {
    setStep('form')
    setPending(null)
    setError('')
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy || entering) return
    setError('')

    if (step === 'confirm') {
      const errName = validateName(name)
      if (errName) return setError(errName)
      const errPw = validatePassword(pw)
      if (errPw) return setError(errPw)
      setBusy(true)
      try {
        await signUp(name, pw)
        setEntering(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : '开辟失败，稍后再试')
        setBusy(false)
      }
      return
    }

    const errName = validateName(name)
    if (errName) return setError(errName)

    setBusy(true)
    try {
      const result = await login(name, pw)
      if (!result.ok && result.reason === 'missing') {
        const errPw = validatePassword(pw)
        if (errPw) {
          setError('先设一个密码，至少 4 位')
          setBusy(false)
          pwRef.current?.focus()
          return
        }
        setPending(null)
        setStep('confirm')
        setBusy(false)
        return
      }
      if (!result.ok) {
        setError(result.message)
        setBusy(false)
        pwRef.current?.focus()
        return
      }
      // 先播一段“靠岸”动效，再把界面交给岛屿
      setPending(result.account)
      setEntering(true)
      window.setTimeout(() => enter(result.account), 520)
    } catch {
      setError('登录失败，请重试')
      setBusy(false)
    }
  }

  const pick = (acc: IslandAccount) => {
    setName(acc.name)
    setStep('form')
    setError('')
    window.setTimeout(() => pwRef.current?.focus(), 60)
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <GateScene />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-7 sm:px-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        {/* ── 左：叙事 ── */}
        <div className="hidden lg:block">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="flex items-center gap-3">
              <span className="relative block h-12 w-12">
                <span className="absolute inset-0 rounded-full bg-white/70 blur-md" />
                <img src="/brand/icon-256.png" alt="" className="relative h-12 w-12 object-contain" />
              </span>
              <div>
                <p className="font-display text-[19px] font-semibold tracking-[0.06em] text-ink-900">清绪之屿</p>
                <p className="mt-0.5 text-[10px] font-medium tracking-[0.3em] text-ink-400">SERENE ISLE</p>
              </div>
            </div>

            <h1 className="mt-12 font-display text-[46px] font-semibold leading-[1.18] tracking-tight text-ink-900">
              停泊情绪风浪，
              <br />
              从容奔赴考场。
            </h1>
            <p className="mt-6 max-w-md text-[14px] leading-[1.95] text-ink-500">
              一座给备考学生的数字小岛。灯塔会听你说，藏书阁给得出依据，
              潮汐湾负责让你慢下来，乐园沙滩留给学不进去的那半小时。
            </p>

            <div className="mt-9 space-y-2.5">
              {[
                { icon: 'shield' as const, title: '数据只留在这台设备', desc: '密码摘要与情绪记录都存本地，不上传服务器' },
                { icon: 'compass' as const, title: '每个名字一间小屋', desc: '同一台电脑上，不同的人各有一份独立记录' },
                { icon: 'lifebuoy' as const, title: '需要时有人接住你', desc: '识别到高危信号会推送 12356 与线下求助路径' },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.1, duration: 0.6 }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/60 text-sea-600">
                    <Icon name={f.icon} size={15} />
                  </span>
                  <p className="text-[12.5px] leading-relaxed text-ink-600">
                    <span className="font-medium text-ink-900">{f.title}</span>
                    <span className="mx-1.5 text-ink-300">·</span>
                    {f.desc}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 h-8 max-w-md overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={quote}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="font-display text-[13.5px] tracking-wide text-ink-400"
                >
                  「{QUOTES[quote]}」
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* 移动端品牌行 */}
        <div className="mb-5 flex items-center gap-2.5 lg:hidden">
          <img src="/brand/icon-256.png" alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="font-display text-[16px] font-semibold tracking-[0.06em] text-ink-900">清绪之屿</p>
            <p className="mt-0.5 text-[9px] font-medium tracking-[0.28em] text-ink-400">SERENE ISLE</p>
          </div>
        </div>

        {/* ── 右：卡片 ── */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="relative my-auto w-full"
        >
          <div className="relative flex min-h-[27rem] flex-col overflow-hidden rounded-[2rem] border border-white/85 bg-white/72 p-6 shadow-[0_40px_100px_-50px_rgba(46,96,112,0.55)] backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-lav-200/45 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-sea-200/40 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.3em] text-sea-500">Island Pass</p>
                <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10px] text-ink-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-sea-400" />
                  本地账号
                </span>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {step === 'form' ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                  >
                    <h2 className="mt-4 font-display text-[26px] font-semibold tracking-tight text-ink-900">
                      先给自己起个名字
                    </h2>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
                      这座岛会记住你。名字还没出现过，就当场为你开辟一座新的。
                    </p>

                    <form onSubmit={submit} className="mt-6 space-y-3">
                      <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
                          <Icon name="user" size={12} /> 你的名字
                        </span>
                        <div className="relative">
                          <input
                            ref={nameRef}
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value)
                              setError('')
                            }}
                            placeholder="比如：林小屿"
                            maxLength={12}
                            autoComplete="username"
                            aria-label="你的名字"
                            className="w-full rounded-2xl border border-white/90 bg-white/85 px-4 py-3 text-[14px] text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-sea-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(148,205,217,0.22)]"
                          />
                          {existing && (
                            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-sea-50 px-2 py-1 text-[10px] font-medium text-sea-600">
                              <Icon name="check" size={11} />
                              已存在
                            </span>
                          )}
                        </div>
                      </label>

                      <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
                          <Icon name="lock" size={12} /> 暗号
                          <span className="text-ink-300">（至少 4 位）</span>
                        </span>
                        <div className="relative">
                          <input
                            ref={pwRef}
                            type={showPw ? 'text' : 'password'}
                            value={pw}
                            onChange={(e) => {
                              setPw(e.target.value)
                              setError('')
                            }}
                            placeholder="只有你自己知道"
                            maxLength={32}
                            autoComplete="current-password"
                            aria-label="暗号"
                            className="w-full rounded-2xl border border-white/90 bg-white/85 px-4 py-3 pr-11 text-[14px] text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-sea-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(148,205,217,0.22)]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-400 transition hover:bg-white hover:text-ink-700"
                            aria-label={showPw ? '隐藏暗号' : '显示暗号'}
                          >
                            <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} />
                          </button>
                        </div>
                      </label>

                      <AnimatePresence>
                        {error && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-start gap-1.5 rounded-xl bg-coral-300/15 px-3 py-2 text-[11.5px] leading-relaxed text-coral-600"
                            role="alert"
                          >
                            <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <button type="submit" disabled={busy} className="btn-primary mt-1 w-full py-3 text-[13.5px]">
                        {busy ? (
                          <>
                            <span className="gate-dots" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                            </span>
                            正在认路…
                          </>
                        ) : (
                          <>
                            {existing ? '登上我的岛' : '登岛 / 开辟一座新岛'}
                            <Icon name="arrowRight" size={15} />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-3 flex items-center gap-3">
                      <span className="h-px flex-1 bg-ink-900/8" />
                      <span className="text-[10px] tracking-[0.2em] text-ink-300">OR</span>
                      <span className="h-px flex-1 bg-ink-900/8" />
                    </div>

                    <button
                      onClick={() => {
                        setEntering(true)
                        window.setTimeout(enterAsGuest, 480)
                      }}
                      className="mt-3 w-full rounded-2xl border border-white/90 bg-white/55 py-2.5 text-[12.5px] text-ink-600 transition hover:bg-white/85 hover:text-ink-900"
                    >
                      先随便看看 · 以过客身份进入
                    </button>

                    {accounts.length > 0 && (
                      <div className="mt-5">
                        <p className="text-[10px] tracking-[0.18em] text-ink-300">这台设备上的岛主</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {accounts.slice(0, 5).map((a) => (
                            <button
                              key={a.id}
                              onClick={() => pick(a)}
                              className="group flex items-center gap-1.5 rounded-full border border-white/90 bg-white/60 py-1 pl-1 pr-2.5 text-[11.5px] text-ink-600 transition hover:border-sea-200 hover:bg-white"
                            >
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[9.5px] font-semibold text-white"
                                style={{ background: `linear-gradient(135deg, hsl(${a.hue} 62% 72%), hsl(${(a.hue + 40) % 360} 58% 66%))` }}
                              >
                                {a.name.slice(0, 1)}
                              </span>
                              {a.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.26 }}
                  >
                    <div className="mt-5 flex items-center gap-3">
                      <span className="relative flex h-12 w-12 items-center justify-center">
                        <span className="absolute inset-0 rounded-full bg-sea-200/45 slow-breath" />
                        <span className="relative font-display text-[18px] font-semibold text-sea-700">
                          {name.trim().slice(0, 1)}
                        </span>
                      </span>
                      <div>
                        <p className="text-[11px] tracking-[0.18em] text-ink-300">NEW ISLANDER</p>
                        <p className="font-display text-[17px] font-semibold tracking-tight text-ink-900">{name.trim()}</p>
                      </div>
                    </div>

                    <h2 className="mt-5 font-display text-[24px] font-semibold leading-snug tracking-tight text-ink-900">
                      这座岛还没有主人，
                      <br />
                      要为你开辟一座吗？
                    </h2>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
                      会用刚才填的暗号作为凭证。之后在这台设备上，只要输入这个名字就能回到你自己的记录。
                    </p>

                    {error && (
                      <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-coral-300/15 px-3 py-2 text-[11.5px] text-coral-600" role="alert">
                        <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                        {error}
                      </p>
                    )}

                    <div className="mt-5 flex gap-2">
                      <button onClick={reset} className="btn-ghost flex-1 py-2.5 text-[12.5px]">
                        换个名字
                      </button>
                      <button onClick={() => submit()} disabled={busy} className="btn-primary flex-[1.4] py-2.5 text-[12.5px]">
                        {busy ? '正在开辟…' : '开辟我的岛'}
                        <Icon name="sparkles" size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-5 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-300">
                <Icon name="shield" size={12} className="mt-0.5 shrink-0" />
                没有服务器、没有找回密码。换设备或清除浏览器数据，这座岛就只留在记忆里。
              </p>
            </div>
          </div>

          <p className="mt-4 text-center text-[10.5px] text-ink-300 lg:text-left">
            仅作情绪自助辅助，不能替代专业心理咨询 · 紧急情况请拨 12356
          </p>
        </motion.div>
      </div>

      {/* 靠岸过渡 */}
      <AnimatePresence>
        {entering && (
          <motion.div
            key="curtain"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-gradient-to-b from-[#eaf6f9] via-[#f3f7fb] to-[#fbf3e7]"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <img src="/brand/icon-256.png" alt="" className="h-20 w-20 animate-float object-contain" />
              <p className="mt-4 font-display text-[15px] tracking-[0.16em] text-ink-700">正在靠岸…</p>
              <p className="mt-1.5 text-[11px] text-ink-400">
                {pending ? `欢迎回来，${pending.name}` : '风浪先放一放'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
