import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import { BreathingOverlay } from './components/BreathingOverlay'
import { AssessmentModal } from './components/AssessmentModal'
import { SettingsModal } from './components/SettingsModal'
import { IntroModal } from './components/IntroModal'

const Home = lazy(() => import('./pages/Home'))
const Chat = lazy(() => import('./pages/Chat'))
const Library = lazy(() => import('./pages/Library'))
const Calm = lazy(() => import('./pages/Calm'))
const Mood = lazy(() => import('./pages/Mood'))
const Harbor = lazy(() => import('./pages/Harbor'))
const About = lazy(() => import('./pages/About'))

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
    <Layout>
      <Suspense fallback={<IslandLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/library" element={<Library />} />
          <Route path="/calm" element={<Calm />} />
          <Route path="/mood" element={<Mood />} />
          <Route path="/harbor" element={<Harbor />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      <BreathingOverlay />
      <AssessmentModal />
      <SettingsModal />
      <IntroModal />
    </Layout>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
