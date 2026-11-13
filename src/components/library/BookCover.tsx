import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import {
  COVER_BGS,
  COVER_FONTS,
  MOODS,
  type Book,
  type BookCoverCfg,
  type Sticker,
} from '../../lib/books'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<Size, { title: number; meta: number; pad: number; sticker: number; frame: number }> = {
  xs: { title: 12.5, meta: 7, pad: 11, sticker: 15, frame: 5 },
  sm: { title: 15, meta: 8, pad: 14, sticker: 20, frame: 6 },
  md: { title: 19, meta: 9, pad: 18, sticker: 26, frame: 8 },
  lg: { title: 26, meta: 10, pad: 24, sticker: 34, frame: 11 },
}

/** 纹理：用 CSS 渐变画，不引入图片，任何尺寸都清晰 */
function textureStyle(cfg: BookCoverCfg, ink: string): CSSProperties {
  switch (cfg.texture) {
    case 'paper':
      return {
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.55) 0.6px, transparent 0.7px), radial-gradient(rgba(0,0,0,0.05) 0.5px, transparent 0.6px)',
        backgroundSize: '4px 4px, 6px 6px',
        backgroundPosition: '0 0, 2px 3px',
        opacity: 0.6,
        mixBlendMode: 'soft-light',
      }
    case 'dots':
      return {
        backgroundImage: `radial-gradient(${ink}22 1.1px, transparent 1.2px)`,
        backgroundSize: '10px 10px',
        opacity: 0.9,
      }
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${ink}14 1px, transparent 1px), linear-gradient(90deg, ${ink}14 1px, transparent 1px)`,
        backgroundSize: '16px 16px',
        opacity: 0.8,
      }
    default:
      return {}
  }
}

interface Props {
  cover: BookCoverCfg
  title: string
  author: string
  mood: Book['mood']
  size?: Size
  className?: string
  /** 书本在架上时的一点手工倾斜 */
  tilt?: number
  interactive?: {
    onStickerDown?: (s: Sticker, e: ReactPointerEvent<HTMLElement>) => void
    onStickerDouble?: (s: Sticker) => void
    activeSticker?: string | null
  }
}

/** 一本书的封面：底色 + 纹理 + 题字 + 贴纸 + 手绘，全部由用户自己搭出来 */
export function BookCover({ cover, title, author, mood, size = 'sm', className = '', tilt = 0, interactive }: Props) {
  const bg = COVER_BGS[cover.bg] ?? COVER_BGS.sand
  const font = COVER_FONTS[cover.font] ?? COVER_FONTS.song
  const dim = SIZES[size]
  const moodMeta = MOODS[mood] ?? MOODS.anxious
  const ink = bg.ink
  const onDark = cover.bg === 'night'

  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      style={{
        aspectRatio: '3 / 4',
        background: `linear-gradient(158deg, ${bg.from} 0%, ${bg.to} 100%)`,
        color: ink,
        fontFamily: font.stack,
        borderRadius: size === 'lg' ? 14 : 6,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        boxShadow: '0 16px 30px -22px rgba(46, 96, 112, 0.55)',
      }}
    >
      {/* 纹理 */}
      <div className="pointer-events-none absolute inset-0" style={textureStyle(cover, ink)} />

      {/* 书脊阴影 + 右侧书口 */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[7%]"
        style={{ background: `linear-gradient(90deg, rgba(0,0,0,${onDark ? 0.26 : 0.13}), transparent)` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[1.5px]"
        style={{ background: 'rgba(255,255,255,0.5)' }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[3%]"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55))' }}
      />

      {/* 内框 */}
      <div
        className="pointer-events-none absolute rounded-[3px]"
        style={{
          inset: dim.frame,
          border: `1px solid ${onDark ? 'rgba(255,255,255,0.34)' : `${ink}2e`}`,
        }}
      />

      {/* 题字 */}
      <div
        className="relative flex h-full flex-col items-center justify-between text-center"
        style={{ padding: dim.pad, paddingLeft: dim.pad + dim.frame * 0.5 }}
      >
        <span
          className="uppercase"
          style={{
            fontSize: dim.meta,
            letterSpacing: '0.26em',
            opacity: 0.62,
            fontFamily: 'inherit',
          }}
        >
          {moodMeta.label} · 手记
        </span>

        <div className="flex w-full flex-col items-center gap-2">
          <span
            className="w-full font-semibold leading-[1.34]"
            style={{
              fontSize: dim.title,
              letterSpacing: size === 'lg' ? '0.04em' : '0.02em',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {title || '未命名的书'}
          </span>
          <span
            className="block h-[1px] w-6"
            style={{ background: onDark ? 'rgba(255,255,255,0.5)' : `${ink}55` }}
          />
        </div>

        <span style={{ fontSize: dim.meta + 0.5, letterSpacing: '0.16em', opacity: 0.72 }}>{author}</span>
      </div>

      {/* 手绘 */}
      {cover.strokes.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 300 400"
          preserveAspectRatio="none"
          aria-hidden
        >
          {cover.strokes.map((s, i) => (
            <polyline
              key={i}
              points={s.pts.map((p) => `${p.x * 300},${p.y * 400}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.92}
            />
          ))}
        </svg>
      )}

      {/* 贴纸 */}
      {cover.stickers.map((s) => (
        <span
          key={s.id}
          onPointerDown={interactive?.onStickerDown ? (e) => interactive.onStickerDown?.(s, e) : undefined}
          onDoubleClick={interactive?.onStickerDouble ? () => interactive.onStickerDouble?.(s) : undefined}
          className={interactive?.onStickerDown ? 'absolute cursor-grab touch-none select-none active:cursor-grabbing' : 'absolute select-none'}
          style={{
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            fontSize: dim.sticker * s.s,
            lineHeight: 1,
            transform: `translate(-50%, -50%) rotate(${s.r}deg)`,
            filter: 'drop-shadow(0 3px 5px rgba(60,50,40,0.18))',
            borderRadius: 8,
          }}
          aria-hidden
        >
          {s.glyph}
        </span>
      ))}

      {/* 一点光 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(122deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 42%)',
        }}
      />
    </div>
  )
}
