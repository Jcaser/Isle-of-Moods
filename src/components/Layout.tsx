import { motion } from 'framer-motion'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { Icon, type IconName } from './Icons'
import { WaveBackground } from './WaveBackground'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '岛屿', icon: 'home' },
  { to: '/chat', label: '岛主', icon: 'chat' },
  { to: '/library', label: '藏书阁', icon: 'book' },
  { to: '/calm', label: '潮汐', icon: 'wave' },
  { to: '/mood', label: '潮向', icon: 'chart' },
  { to: '/harbor', label: '避风港', icon: 'lifebuoy' },
]

function Brand({ compact }: { compact?: boolean }) {
  return (
    <NavLink to="/" className="group flex items-center gap-2.5 focus-ring rounded-2xl" aria-label="清绪之屿首页">
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

function Nav() {
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const hasKey = useAppStore((s) => Boolean(s.settings.apiKey))
  const { pathname } = useLocation()
  if (pathname.startsWith('/chat')) return null

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-5">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full px-3 sm:h-16 sm:px-5">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
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
            className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition sm:flex ${
              hasKey ? 'bg-sea-50/80 text-sea-600' : 'bg-sand-100 text-ink-500 hover:bg-sand-200'
            }`}
            aria-label="打开设置"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${hasKey ? 'bg-sea-400' : 'bg-coral-400'}`} />
            {hasKey ? 'AI 已连接' : '本地模式'}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-quiet h-9 w-9 rounded-full p-0"
            aria-label="设置"
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}

function MobileTabs() {
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-40 md:hidden"
      aria-label="移动端导航"
    >
      <div className="glass-strong flex items-center justify-between rounded-full px-1.5 py-1.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition ${
                isActive ? 'bg-white/90 text-sea-600 shadow-[0_6px_16px_-12px_rgba(46,96,112,0.7)]' : 'text-ink-500'
              }`
            }
          >
            <Icon name={item.icon} size={17} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-white/60 bg-white/35 px-4 pb-28 pt-10 backdrop-blur-sm sm:px-8 md:pb-12">
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
              隐私优先 · 本地存储 · 无账号体系
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

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isChat = pathname.startsWith('/chat')

  return (
    <div className="flex min-h-screen flex-col">
      {!isChat && <WaveBackground />}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm"
      >
        跳到主内容
      </a>
      <Nav />
      <main id="main" className={isChat ? 'flex-1' : 'flex-1'}>
        {children}
      </main>
      {!isChat && <Footer />}
      {!isChat && <MobileTabs />}
    </div>
  )
}
