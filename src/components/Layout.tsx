import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { applyMoment, loadMoment } from '../lib/moment'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { Icon, type IconName } from './Icons'
import { WaveBackground } from './WaveBackground'
import { ParticleField } from './ParticleField'
import { CursorGlow } from './CursorGlow'
import { ScrollProgress } from './ScrollProgress'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '岛屿', icon: 'home' },
  { to: '/chat', label: '岛主', icon: 'chat' },
  { to: '/library', label: '藏书阁', icon: 'book' },
  { to: '/calm', label: '潮汐', icon: 'wave' },
  { to: '/play', label: '乐园', icon: 'sparkles' },
  { to: '/mood', label: '潮向', icon: 'chart' },
  { to: '/harbor', label: '避风港', icon: 'lifebuoy' },
]

function Brand({ compact }: { compact?: boolean }) {
  return (
    <NavLink to="/" className="group flex items-center gap-2.5 rounded-2xl focus-ring" aria-label="清绪之屿首页">
      <span className="relative block h-10 w-10 shrink-0">
        <span className="absolute inset-0 rounded-full bg-sea-200/40 blur-md transition group-hover:bg-sea-200/70" />
        <img
          src="/brand/icon-256.png"
          alt=""
          className="relative h-10 w-10 object-contain drop-shadow-[0_6px_10px_rgba(58,123,141,0.18)] transition-transform duration-500 group-hover:-translate-y-0.5"
        />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[17px] font-semibold tracking-[0.06em] text-ink-900">清绪之屿</span>
          <span className="mt-1 block text-[10px] font-medium tracking-[0.22em] text-ink-300">SERENE ISLE</span>
        </span>
      )}
    </NavLink>
  )
}


/** 岛主头像与菜单 */
function UserMenu() {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const joined = new Date(user.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/60 py-1 pl-1 pr-2 transition hover:bg-white/90"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="岛主菜单"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-[0_4px_10px_-6px_rgba(46,96,112,0.8)]"
          style={{ background: `linear-gradient(135deg, hsl(${user.hue} 62% 72%), hsl(${(user.hue + 40) % 360} 58% 66%))` }}
        >
          {user.name.slice(0, 1)}
        </span>
        <span className="hidden max-w-[64px] truncate text-[11.5px] font-medium text-ink-700 sm:block">{user.name}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="menu"
            className="absolute right-0 top-[calc(100%+8px)] w-52 overflow-hidden rounded-3xl border border-white/85 bg-white/92 p-1.5 shadow-[0_30px_60px_-36px_rgba(46,96,112,0.6)] backdrop-blur-xl"
          >
            <div className="px-3 py-2">
              <p className="truncate font-display text-[13px] font-semibold text-ink-900">{user.name}</p>
              <p className="mt-0.5 text-[10.5px] text-ink-300">
                {user.guest ? '过客身份 · 数据公用' : `${joined} 登岛`}
              </p>
            </div>
            <div className="my-1 h-px bg-ink-900/6" />
            <NavLink
              to="/mood"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-2xl px-3 py-2 text-[12.5px] text-ink-600 transition hover:bg-sea-50/80 hover:text-sea-700"
              role="menuitem"
            >
              <Icon name="chart" size={14} />
              我的潮向
            </NavLink>
            <button
              onClick={() => {
                setOpen(false)
                setSettingsOpen(true)
              }}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-[12.5px] text-ink-600 transition hover:bg-sea-50/80 hover:text-sea-700"
              role="menuitem"
            >
              <Icon name="settings" size={14} />
              岛屿设置
            </button>
            <div className="my-1 h-px bg-ink-900/6" />
            <button
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-[12.5px] text-ink-500 transition hover:bg-coral-300/15 hover:text-coral-600"
              role="menuitem"
            >
              <Icon name="logout" size={14} />
              切换岛主
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Nav() {
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const hasKey = useAppStore((s) => Boolean(s.settings.apiKey))
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (pathname.startsWith('/chat')) return null

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-5">
      {/* 滚动时顶部渐隐，内容从导航上方淡出，不会硬切 */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+6px)] transition-opacity duration-500 ${
          scrolled ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.6) 58%, rgba(255,255,255,0) 100%)' }}
      />
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full px-3 transition-all duration-500 sm:px-4 ${
          scrolled
            ? 'h-14 border border-white/90 bg-white shadow-[0_20px_44px_-34px_rgba(46,96,112,0.95)] backdrop-blur-2xl sm:h-[58px]'
            : 'glass h-14 sm:h-16'
        }`}
      >
        <Brand />
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="主导航">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative rounded-full px-2.5 py-2 text-[12.5px] font-medium transition-colors lg:px-3.5 lg:text-[13px] ${
                  isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-white/85 shadow-[0_6px_16px_-10px_rgba(46,96,112,0.6)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSettingsOpen(true)}
            className={`hidden items-center gap-1.5 rounded-full border border-white/80 px-3 py-1.5 text-[11px] font-medium transition lg:flex ${
              hasKey ? 'bg-sea-50/90 text-sea-600' : 'bg-white/70 text-ink-500 hover:bg-white'
            }`}
            aria-label="打开设置"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${hasKey ? 'bg-sea-400' : 'bg-coral-400'}`} />
            {hasKey ? 'AI 已连接' : '本地模式'}
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event('serene:palette'))}
            className="hidden items-center gap-1 rounded-full border border-white/80 bg-white/50 px-2 py-1 text-[10px] text-ink-400 transition hover:bg-white/90 hover:text-ink-700 sm:flex"
            aria-label="打开快捷命令"
            title="快捷命令（⌘K）"
          >
            <Icon name="compass" size={12} />
            <span className="tracking-wide">⌘K</span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-quiet h-9 w-9 rounded-full p-0"
            aria-label="设置"
          >
            <Icon name="settings" size={18} />
          </button>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

function MobileTabs() {
  return (
    <nav className="fixed inset-x-2.5 bottom-3 z-40 md:hidden" aria-label="移动端导航">
      <div className="glass-strong flex items-center justify-between rounded-full px-1 py-1.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[9.5px] font-medium transition ${
                isActive ? 'bg-white/90 text-sea-600 shadow-[0_6px_16px_-12px_rgba(46,96,112,0.7)]' : 'text-ink-500'
              }`
            }
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** 长页面滚到底时，再给一次"回地图"的出口 */
function BackHomeRail() {
  const navigate = useNavigate()
  return (
    <div className="relative z-10 mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <button
        onClick={() => navigate('/')}
        className="group flex w-full items-center justify-between gap-4 overflow-hidden rounded-4xl border border-white/75 bg-white/50 px-5 py-4 text-left backdrop-blur-md transition-all duration-400 hover:-translate-y-0.5 hover:border-sea-300/60 hover:bg-white/85 hover:shadow-[0_30px_60px_-40px_rgba(46,96,112,0.9)] sm:px-7 sm:py-5"
      >
        <span className="flex items-center gap-4">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sea-100 via-white to-lav-100 text-sea-600">
            <span className="absolute inset-0 rounded-2xl border border-sea-300/40 transition-transform duration-500 group-hover:scale-105" />
            <Icon name="compass" size={19} />
          </span>
          <span className="block">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.28em] text-sea-500">Back to Atlas</span>
            <span className="mt-1 block font-display text-[16px] font-semibold tracking-tight text-ink-900 sm:text-[18px]">
              回到岛屿地图，换一处上岸
            </span>
          </span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sea-300/50 text-sea-600 transition-transform duration-300 group-hover:translate-x-1">
          <Icon name="arrowRight" size={15} />
        </span>
      </button>
    </div>
  )
}

function Footer() {
  return (
    <footer className="relative z-10 mt-16 border-t border-white/60 bg-white/35 px-4 pb-28 pt-10 backdrop-blur-sm sm:px-8 md:pb-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <Brand />
            <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
              清绪之屿是一款 AI 驱动的考前情绪自助调节工具。你的对话与情绪记录默认只保存在本机浏览器，
              不会上传到服务器；清除浏览器数据即彻底删除。
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-300">
              <Icon name="shield" size={13} />
              隐私优先 · 本地账号 · 数据不出本机
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[13px] text-ink-500">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="transition hover:text-ink-900">
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/about" className="transition hover:text-ink-900">
              关于与免责声明
            </NavLink>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-coral-300/30 bg-coral-300/10 px-5 py-4">
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-700">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-coral-500" />
            <span>
              <strong className="font-semibold">免责声明：</strong>
              清绪之屿仅为考前情绪自助调节辅助工具，
              <strong className="font-semibold">不能替代专业心理咨询师与医疗机构诊断治疗</strong>
              ，如出现严重心理困扰，请及时联系线下心理卫生机构。紧急情况请拨打全国统一心理援助热线
              <a href="tel:12356" className="mx-1 font-semibold text-sea-600 underline underline-offset-2">
                12356
              </a>
              或 120 / 110。
            </span>
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 text-[11px] text-ink-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SereneIsle · 清绪之屿 · 全国高校 AI Web 开发挑战赛参赛作品</p>
          <p className="tracking-wide">停泊情绪风浪，从容奔赴考场</p>
        </div>
      </div>
    </footer>
  )
}

/** 路由切换时重放入场动画，但不重挂载页面（避免丢失对话与表单状态） */
function PageShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = 'pageIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both'
  }, [pathname])

  return (
    <div ref={ref} className="flex-1">
      {children}
    </div>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isChat = pathname.startsWith('/chat')
  const isHome = pathname === '/'

  // 启动时恢复上次选择的岛屿时刻（清晨 / 正午 / 黄昏 / 夜航）
  useEffect(() => {
    applyMoment(loadMoment())
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <ParticleField />
      <CursorGlow />
      <ScrollProgress />
      {!isChat && <WaveBackground />}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm"
      >
        跳到主内容
      </a>
      <Nav />
      <main id="main" className="relative z-10 flex-1">
        <PageShell>{children}</PageShell>
      </main>
      {!isChat && !isHome && <BackHomeRail />}
      {!isChat && <Footer />}
      {!isChat && <MobileTabs />}
    </div>
  )
}
