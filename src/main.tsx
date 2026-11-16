import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import { BreathingOverlay } from './components/BreathingOverlay'
import { AssessmentModal } from './components/AssessmentModal'
import { SettingsModal } from './components/SettingsModal'
import { IntroModal } from './components/IntroModal'
import { Gate } from './components/Gate'
import { AmbientPlayer } from './components/AmbientPlayer'
import { CommandPalette } from './components/CommandPalette'
import { useAuthStore } from './store/useAuthStore'

const Home = lazy(() => import('./pages/Home'))
const Chat = lazy(() => import('./pages/Chat'))
const Library = lazy(() => import('./pages/Library'))
const Calm = lazy(() => import('./pages/Calm'))
const Mood = lazy(() => import('./pages/Mood'))
const Harbor = lazy(() => import('./pages/Harbor'))
const Play = lazy(() => import('./pages/Play'))

function IslandLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <img src="/brand/icon-256.png" alt="" className="h-16 w-16 animate-float object-contain opacity-80" />
      <p className="text-[12px] tracking-[0.2em] text-ink-300">正在靠岸…</p>
    </div>
  )
}

function App() {
  return (
    <>
      <Layout>
        <Suspense fallback={<IslandLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/library" element={<Library />} />
            <Route path="/calm" element={<Calm />} />
            <Route path="/play" element={<Play />} />
            <Route path="/mood" element={<Mood />} />
            <Route path="/harbor" element={<Harbor />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </Layout>
      {/* 全屏弹层挂在 Layout 之外：PageShell 的入场动画带 filter，
          会让 position: fixed 相对它定位，弹层就会跟着页面滚动跑偏 */}
      <BreathingOverlay />
      <CommandPalette />
      <AssessmentModal />
      <SettingsModal />
      <IntroModal />
    </>
  )
}

function Root() {
  const user = useAuthStore((s) => s.user)
  // 没有岛主就先停在登录页；登岛后才挂载整个界面与本地数据
  return (
    <>
      {!user ? <Gate /> : <App />}
      {/* 背景乐挂在登录页之外，所以每个页面都听得到 */}
      <AmbientPlayer placement={user ? 'dock' : 'top'} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
)
