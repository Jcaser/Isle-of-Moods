import { useNavigate } from 'react-router-dom'
import { Icon } from './Icons'

/**
 * 回到岛屿全景的入口。
 * 每个副页面的顶部都留了一个，位置、尺寸、动效保持一致，
 * 让人随时能"退回到地图上"，而不是被困在某一个页面里。
 */
export function BackToAtlas({ label = '回到岛屿地图', className = '' }: { label?: string; className?: string }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/')}
      className={`group relative inline-flex items-center gap-2.5 rounded-full border border-white/75 bg-white/55 py-1.5 pl-1.5 pr-4 text-left backdrop-blur-md transition-all duration-300 hover:-translate-x-0.5 hover:border-sea-300/70 hover:bg-white/90 hover:shadow-[0_14px_30px_-22px_rgba(46,96,112,0.9)] focus-ring ${className}`}
      aria-label="返回岛屿全景地图"
    >
      <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sea-100 via-white to-lav-100 text-sea-600">
        <span className="absolute inset-0 rounded-full border border-sea-300/40 transition-transform duration-500 group-hover:scale-110" />
        <Icon name="arrowRight" size={12} className="rotate-180 transition-transform duration-300 group-hover:-translate-x-0.5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[11.5px] font-medium tracking-[0.02em] text-ink-700 transition group-hover:text-ink-900">{label}</span>
        <span className="mt-[3px] text-[8px] font-medium tracking-[0.24em] text-ink-300">BACK TO ATLAS</span>
      </span>
    </button>
  )
}
