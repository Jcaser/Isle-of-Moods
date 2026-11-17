import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icons'
import { findAccount, listAccounts, login, validateName, validatePassword, type IslandAccount } from '../lib/auth'
import { useAuthStore } from '../store/useAuthStore'
import { sfx } from '../lib/sfx'

const QUOTES = [
  '你不需要先变好，才配得上被安慰。',
  '焦虑不是敌人，它只是太想保护你。',
  '今天的进度条，走一格也算数。',
  '允许自己慢一点，潮水从不催岸。',
]

const HORIZON = 596

/** 一条可以无缝平移的波纹线：首尾同高同斜率，复制一份错开 1440 就能无限循环 */
function waveLine(y: number, amp: number, len = 180) {
  // 段数必须是偶数，末端的斜率才和起点一致，循环时才看不出接缝
  const raw = Math.max(2, Math.round(1440 / len))
  const steps = raw % 2 === 0 ? raw : raw + 1
  const w = 1440 / steps
  let d = `M0 ${y} q${w / 2} ${-amp} ${w} 0`
  for (let i = 1; i < steps; i++) d += ` t${w} 0`
  return d
}

/** 云：三层同心椭圆叠出柔边，不用滤镜，滚动时不掉帧 */
function Cloud({ x, y, rx, ry, o = 1 }: { x: number; y: number; rx: number; ry: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="#e3eff7" opacity={o}>
      <ellipse rx={rx * 1.18} ry={ry * 2.1} opacity="0.26" />
      <ellipse rx={rx} ry={ry * 1.5} opacity="0.42" />
      <ellipse rx={rx * 0.78} ry={ry} opacity="0.62" />
      <ellipse cx={0} cy={ry * 0.5} rx={rx * 0.68} ry={ry * 0.6} fill="#d3e6f1" opacity="0.4" />
    </g>
  )
}

/**
 * 一层水纹：外层慢慢上下起伏（像涌上来又退回去），
 * 内层横向流动，两层叠在一起才像真的水，而不是一条被推着走的白线。
 */
function WaveRow({
  y,
  amp,
  width,
  opacity,
  speed,
  len = 200,
  bob = 8,
  delay = 0,
}: {
  y: number
  amp: number
  width: number
  opacity: number
  speed: 'a' | 'b' | 'c'
  len?: number
  bob?: number
  delay?: number
}) {
  const d = waveLine(y, amp, len)
  return (
    <g className="gate-wave-bob" style={{ animationDelay: `${delay}s`, animationDuration: `${bob}s` }}>
      <g className={`gate-wave-${speed}`} stroke="#ffffff" fill="none" strokeLinecap="round">
        <path d={d} strokeWidth={width} opacity={opacity} />
        <path d={d} strokeWidth={width} opacity={opacity} transform="translate(1440 0)" />
      </g>
    </g>
  )
}

export type Ripple = { id: number; x: number; y: number }

/** 岛与灯塔：登录页的场景（纯 SVG + CSS 动画，无外部资源） */
function GateScene({ svgRef, ripples }: { svgRef: React.RefObject<SVGSVGElement>; ripples: Ripple[] }) {
  // 鼠标位置 → CSS 变量，做一点视差；不触发 React 重渲染
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let mx = 0
    let my = 0
    let sx = -400
    let sy = -400
    const apply = () => {
      raf = 0
      svg.style.setProperty('--px', mx.toFixed(3))
      svg.style.setProperty('--py', my.toFixed(3))
      svg.style.setProperty('--sea-x', `${sx.toFixed(1)}px`)
      svg.style.setProperty('--sea-y', `${sy.toFixed(1)}px`)
    }
    const onMove = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2
      my = (e.clientY / window.innerHeight - 0.5) * 2
      const ctm = svg.getScreenCTM()
      if (ctm) {
        const pt = svg.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const p = pt.matrixTransform(ctm.inverse())
        // 只在水面上亮，离开海面就收起来
        if (p.y > HORIZON + 4 && p.y < 910 && p.x > -80 && p.x < 1520) {
          sx = p.x
          sy = p.y
        } else {
          sx = -400
          sy = -400
        }
      }
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [svgRef])

  const flocks = [
    { cls: 'gate-flock-a', x: 980, y: 392, scale: 1 },
    { cls: 'gate-flock-b', x: 640, y: 300, scale: 0.8 },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg
        ref={svgRef}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="presentation"
      >
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
          <linearGradient id="gate-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdfefe" stopOpacity="0" />
            <stop offset="0.3" stopColor="#fdfefe" stopOpacity="0.34" />
            <stop offset="0.46" stopColor="#fdfefe" stopOpacity="0.54" />
            <stop offset="0.72" stopColor="#f7fbfd" stopOpacity="0.22" />
            <stop offset="1" stopColor="#f7fbfd" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="gate-isle-shadow" cx="0.5" cy="0.5">
            <stop offset="0" stopColor="#4f8ba0" stopOpacity="0.4" />
            <stop offset="0.6" stopColor="#4f8ba0" stopOpacity="0.16" />
            <stop offset="1" stopColor="#4f8ba0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gate-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff6d6" stopOpacity="0.62" />
            <stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
          </linearGradient>
          {/* 跟着鼠标走的一团海面暖光 */}
          <radialGradient id="gate-sea-glow" cx="0.5" cy="0.5">
            <stop offset="0" stopColor="#fffdf2" stopOpacity="0.5" />
            <stop offset="0.42" stopColor="#fff8e6" stopOpacity="0.2" />
            <stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
          </radialGradient>
          <clipPath id="gate-sea-clip">
            <rect x="0" y={HORIZON} width="1440" height={900 - HORIZON} />
          </clipPath>
        </defs>

        <rect width="1440" height="900" fill="url(#gate-sky)" />

        {/* 低垂的太阳 */}
        <g className="gate-drift-far">
          <circle cx="1148" cy="596" r="230" fill="url(#gate-sun)" className="gate-sun-glow" />
        </g>
        <circle cx="1148" cy="596" r="40" fill="#fffaea" opacity="0.92" className="gate-sun-core" />

        {/* 云：整层缓慢向西漂，复制一份接在后面，无限循环 */}
        <g className="gate-drift-mid">
          <g className="gate-clouds">
            {[0, 1440].map((off) => (
              <g key={off} transform={`translate(${off} 0)`}>
                <Cloud x={290} y={150} rx={120} ry={16} />
                <Cloud x={352} y={138} rx={76} ry={13} o={0.8} />
                <Cloud x={700} y={222} rx={96} ry={13} o={0.85} />
                <Cloud x={1210} y={330} rx={104} ry={14} />
                <Cloud x={1272} y={318} rx={60} ry={10} o={0.8} />
              </g>
            ))}
          </g>
        </g>

        {/* 远处的礁屿 */}
        <g opacity="0.55" fill="#a9c8cd">
          <path d="M760 596 C 782 566 818 556 842 570 C 864 582 874 590 886 596 Z" />
          <path d="M960 596 C 976 578 998 574 1012 584 C 1022 590 1028 594 1036 596 Z" />
        </g>

        {/* 海面 */}
        <rect x="0" y={HORIZON} width="1440" height={900 - HORIZON} fill="url(#gate-sea)" />

        {/* 地平线的薄雾，让天与海接得软一点 */}
        <rect x="0" y={HORIZON - 26} width="1440" height="58" fill="url(#gate-haze)" />

        {/* 鼠标划过海面时，脚下浮起一小片暖光 */}
        <g clipPath="url(#gate-sea-clip)" aria-hidden="true">
          <g className="gate-sea-light">
            <ellipse rx="132" ry="30" fill="url(#gate-sea-glow)" />
            <ellipse cy="-1" rx="74" ry="7" fill="rgba(255, 253, 240, 0.22)" />
          </g>
        </g>

        {/* 太阳的水面倒影 */}
        <g opacity="0.55" className="gate-shimmer">
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

        {/* 远处的水纹（在岛后面）：越远越平、走得越慢 */}
        <WaveRow y={640} amp={6} len={260} width={1.7} opacity={0.4} speed="c" bob={9.5} delay={-1.2} />
        <WaveRow y={672} amp={9} len={230} width={1.6} opacity={0.34} speed="c" bob={8.4} delay={-3.6} />
        <WaveRow y={706} amp={12} len={210} width={1.5} opacity={0.3} speed="b" bob={7.6} delay={-0.8} />

        {/* 岛的落影 */}
        <ellipse cx="286" cy="800" rx="238" ry="18" fill="url(#gate-isle-shadow)" />

        {/* 主岛：左下 */}
        <g transform="translate(276,714) scale(0.86)">
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

          {/* 小屋：窗里有一点暖光在呼吸 */}
          <g transform="translate(-34,22)">
            <rect x="-16" y="-8" width="32" height="20" rx="2" fill="#fffdf6" stroke="#e0d2bb" strokeWidth="1.2" />
            <path d="M-21 -8 L0 -22 L21 -8 Z" fill="#e9b4a2" stroke="#dcae9c" strokeWidth="1" />
            <rect x="-4" y="0" width="8" height="12" rx="1" fill="#f6dcc0" />
            <rect x="8" y="-3" width="6" height="5" rx="1" fill="#ffe9a8" className="gate-window" />
          </g>

          {/* 灯塔 */}
          <g transform="translate(-132,4)">
            <path d="M-14 58 L-9 -52 L9 -52 L14 58 Z" fill="#fffdf7" stroke="#ddd0bd" strokeWidth="1.6" />
            <path d="M-12.2 -22 L12.2 -22 L13 -6 L-13 -6 Z" fill="#efb4a2" opacity="0.9" />
            <path d="M-10.6 6 L10.6 6 L11.4 20 L-11.4 20 Z" fill="#efb4a2" opacity="0.9" />
            <rect x="-12" y="-66" width="24" height="14" rx="3" fill="#f9ebd0" stroke="#ddd0bd" strokeWidth="1.4" />
            <circle cx="0" cy="-59" r="4.8" fill="#ffd98a" className="gate-window" />
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

        {/* 小舟：从左慢慢摇到右，船身自己会起伏，身后拖着一点水痕 */}
        <g transform="translate(690,716) scale(1.15)" opacity="0.92">
          <g className="gate-sail">
            <g className="gate-boat">
              <path d="M-18 0 q 18 9 36 0 Z" fill="#fffdf8" stroke="#d9cfc0" strokeWidth="1" />
              <path d="M0 -1 L0 -20 L12 -4 Z" fill="#faf3e4" stroke="#d9cfc0" strokeWidth="0.8" />
              <path d="M0 -1 L0 -17 L-9 -4 Z" fill="#ffffff" stroke="#d9cfc0" strokeWidth="0.8" />
              <path d="M-20 5 q 20 7 40 0" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" fill="none" />
              <g className="gate-wake" stroke="rgba(255,255,255,0.75)" strokeWidth="1" fill="none" strokeLinecap="round">
                <path d="M-22 4 q -14 1 -26 -2" />
                <path d="M-20 7 q -16 3 -30 1" opacity="0.7" />
              </g>
            </g>
          </g>
        </g>

        {/* 近处的水纹（盖在岛脚与船前面）：起伏更大、走得更快 */}
        <WaveRow y={800} amp={13} len={210} width={1.4} opacity={0.28} speed="a" bob={6.6} delay={-2.1} />
        <WaveRow y={838} amp={15} len={190} width={1.3} opacity={0.23} speed="a" bob={5.8} delay={-4.4} />
        <WaveRow y={872} amp={12} len={230} width={1.2} opacity={0.18} speed="b" bob={7.2} delay={-0.4} />

        {/* 点击海面荡开的涟漪 */}
        <g fill="none" stroke="#ffffff" strokeLinecap="round">
          {ripples.map((r) => (
            <g key={r.id} transform={`translate(${r.x} ${r.y})`}>
              <ellipse className="gate-ripple" rx="46" ry="8" strokeWidth="1.5" />
              <ellipse className="gate-ripple" rx="46" ry="8" strokeWidth="1" style={{ animationDelay: '0.3s' }} />
              <ellipse className="gate-ripple" rx="46" ry="8" strokeWidth="0" fill="rgba(255,255,255,0.34)" />
            </g>
          ))}
        </g>

        {/* 飞鸟：两群，慢慢横越天空，翅膀轻轻扇 */}
        <g stroke="#8aacba" strokeWidth="1.5" fill="none" opacity="0.7" strokeLinecap="round" className="gate-drift-near">
          {flocks.map((f) => (
            <g key={f.cls} transform={`translate(${f.x} ${f.y}) scale(${f.scale})`}>
              <g className={f.cls}>
              {[0, 1440].map((off) => (
                <g key={off} transform={`translate(${off} 0)`}>
                  <g className="gate-gull">
                    <path d="M0 0 q 5 -6 10 0 q 5 -6 10 0" />
                  </g>
                  <g transform="translate(38 -16) scale(0.86)">
                    <g className="gate-gull" style={{ animationDelay: '0.28s' }}>
                      <path d="M0 0 q 5 -6 10 0 q 5 -6 10 0" />
                    </g>
                  </g>
                  <g transform="translate(74 10) scale(0.74)">
                    <g className="gate-gull" style={{ animationDelay: '0.55s' }}>
                      <path d="M0 0 q 5 -6 10 0 q 5 -6 10 0" />
                    </g>
                  </g>
                </g>
              ))}
              </g>
            </g>
          ))}
        </g>

        {/* 浮尘：慢慢往上飘，再淡掉 */}
        <g fill="#ffffff">
          {Array.from({ length: 30 }, (_, i) => {
            const x = ((i * 173) % 1400) + 20
            const y = 120 + ((i * 97) % 420)
            const r = 1 + ((i * 7) % 3) * 0.45
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                opacity={0.45}
                className="gate-mote"
                style={{ animationDelay: `${(i % 9) * 0.9}s`, animationDuration: `${9 + (i % 5) * 1.6}s` }}
              />
            )
          })}
        </g>
      </svg>

      <div className="absolute inset-0 bg-[linear-gradient(102deg,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0.26)_30%,transparent_56%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/45 to-transparent" />
    </div>
  )
}

type Step = 'form' | 'confirm'

export function Gate() {
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
  const sceneRef = useRef<SVGSVGElement>(null)
  const rippleSeq = useRef(0)
  const [ripples, setRipples] = useState<Ripple[]>([])

  // 点一下海面，荡开一圈涟漪（点按钮 / 输入框时不触发）
  const spawnRipple = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, textarea, select, label')) return
    const svg = sceneRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(ctm.inverse())
    if (p.y < HORIZON - 6 || p.x < 14 || p.x > 1426) return
    const id = ++rippleSeq.current
    setRipples((list) => [...list.slice(-6), { id, x: p.x, y: p.y }])
    sfx.plink()
    window.setTimeout(() => setRipples((list) => list.filter((r) => r.id !== id)), 2600)
  }

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
    <div className="relative min-h-screen w-full overflow-hidden" onPointerDown={spawnRipple}>
      <GateScene svgRef={sceneRef} ripples={ripples} />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-7 sm:px-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        {/* ── 左：叙事 ── */}
        <div className="hidden lg:block lg:pb-52">
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
              一座给备考学生的数字小岛。灯塔会听你说，分享小屋里有人写下心事，
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
          <div className="relative flex min-h-[27rem] flex-col overflow-hidden rounded-[2rem] border border-white/85 bg-white/[0.72] p-6 shadow-[0_40px_100px_-50px_rgba(46,96,112,0.55)] backdrop-blur-xl sm:p-8">
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
                      <span className="h-px flex-1 bg-ink-900/[0.08]" />
                      <span className="text-[10px] tracking-[0.2em] text-ink-300">OR</span>
                      <span className="h-px flex-1 bg-ink-900/[0.08]" />
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
