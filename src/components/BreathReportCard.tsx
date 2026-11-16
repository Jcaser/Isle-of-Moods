import { motion } from 'framer-motion'
import { useState } from 'react'
import { STATE_META, RHYTHM_LABEL, type BreathReport } from '../lib/breath'
import { Icon } from './Icons'

interface Props {
  report: BreathReport
  /** 这是第几次练习，用于明信片署名 */
  nth: number
  reflect?: string | null
  onAgain: () => void
  onChange: () => void
}

const POST_W = 1080
const POST_H = 1320

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)
  return lines
}

/** 导出一张竖版情绪明信片：1080×1320，适合存手机相册 */
function exportPostcard(report: BreathReport, nth: number) {
  const canvas = document.createElement('canvas')
  canvas.width = POST_W
  canvas.height = POST_H
  const g = canvas.getContext('2d')
  if (!g) return
  const meta = STATE_META[report.state]

  const bg = g.createLinearGradient(0, 0, POST_W * 0.4, POST_H)
  bg.addColorStop(0, '#f7fcfd')
  bg.addColorStop(0.42, '#eff7fa')
  bg.addColorStop(1, '#fbf4ea')
  g.fillStyle = bg
  g.fillRect(0, 0, POST_W, POST_H)

  // 顶部与底部的光斑，模拟海面反光
  const bloom = g.createRadialGradient(POST_W * 0.76, 180, 20, POST_W * 0.76, 180, 460)
  bloom.addColorStop(0, `${meta.bloom}bb`)
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = bloom
  g.fillRect(0, 0, POST_W, POST_H * 0.6)

  // 手绘感的三道潮线
  const waves = [
    { y: POST_H * 0.7, amp: 16, alpha: 0.3, color: '#84c6d6' },
    { y: POST_H * 0.76, amp: 22, alpha: 0.24, color: '#94cdd9' },
    { y: POST_H * 0.83, amp: 14, alpha: 0.18, color: '#c4b9ec' },
  ]
  waves.forEach((w, i) => {
    g.beginPath()
    g.moveTo(0, w.y)
    for (let x = 0; x <= POST_W; x += 12) {
      g.lineTo(x, w.y + Math.sin(x * 0.004 + i * 2) * w.amp + Math.sin(x * 0.011 + i) * w.amp * 0.4)
    }
    g.lineTo(POST_W, POST_H)
    g.lineTo(0, POST_H)
    g.closePath()
    g.globalAlpha = w.alpha
    g.fillStyle = w.color
    g.fill()
    g.globalAlpha = 1
  })

  g.textAlign = 'left'
  g.fillStyle = 'rgba(58,123,141,0.75)'
  g.font = '500 26px "Helvetica Neue", Arial, sans-serif'
  g.fillText('S E R E N E   I S L E   ·   呼 吸 记 录', 96, 128)

  // 状态大字
  g.fillStyle = '#123640'
  g.font = '600 118px "Songti SC", "Noto Serif SC", serif'
  g.fillText(meta.label, 92, 292)

  g.fillStyle = 'rgba(30,42,51,0.5)'
  g.font = '400 34px "PingFang SC", "Microsoft YaHei", sans-serif'
  g.fillText(`${report.planName} · ${report.minutes} 分钟`, 96, 352)

  // 分隔线
  g.strokeStyle = 'rgba(74,151,170,0.28)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(96, 406)
  g.lineTo(POST_W - 96, 406)
  g.stroke()

  // 题字
  g.fillStyle = '#1e2a33'
  g.font = '500 52px "Songti SC", "Noto Serif SC", serif'
  const quoteLines = wrap(g, report.postcard.quote, POST_W - 200)
  quoteLines.forEach((l, i) => g.fillText(l, 96, 510 + i * 74))

  // 建议
  g.fillStyle = 'rgba(30,42,51,0.62)'
  g.font = '400 32px "PingFang SC", "Microsoft YaHei", sans-serif'
  let y = 700
  report.advice.slice(0, 2).forEach((a) => {
    wrap(g, `· ${a}`, POST_W - 210).forEach((l) => {
      g.fillText(l, 96, y)
      y += 52
    })
    y += 14
  })

  // 底部信息
  g.fillStyle = 'rgba(30,42,51,0.42)'
  g.font = '400 26px "PingFang SC", "Microsoft YaHei", sans-serif'
  g.fillText(`${RHYTHM_LABEL[report.rhythm]} · 第 ${nth} 次练习`, 96, POST_H - 178)
  g.fillText(new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }), 96, POST_H - 132)

  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/jpeg', 0.94)
  a.download = `sereneisle-breath-${Date.now()}.jpg`
  a.click()
}

export function BreathReportCard({ report, nth, reflect, onAgain, onChange }: Props) {
  const [copied, setCopied] = useState(false)
  const meta = STATE_META[report.state]

  const copy = async () => {
    const text = [
      `本次状态：${meta.label}`,
      `呼吸法：${report.planName}`,
      `时长：${report.minutes} 分钟 · ${RHYTHM_LABEL[report.rhythm]}`,
      `建议：${report.advice[0] ?? ''}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 剪贴板不可用时静默 */
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-5xl border border-white/75 bg-white/62 p-5 shadow-soft backdrop-blur sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-sea-500">Session Report</p>
          <h2 className="mt-1.5 font-display text-[20px] font-semibold tracking-tight text-ink-900">{report.title}</h2>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[11px] font-medium"
          style={{ background: meta.soft, color: meta.color }}
        >
          {meta.label} · {report.minutes} 分钟
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <dl className="grid grid-cols-2 gap-2">
            {report.lines.map((l, i) => (
              <div
                key={l.label}
                className={`rounded-2xl bg-white/65 px-3.5 py-2.5 ${
                  i === report.lines.length - 1 && report.lines.length % 2 === 1 ? 'col-span-2' : ''
                }`}
              >
                <dt className="text-[10px] tracking-wide text-ink-300">{l.label}</dt>
                <dd className="mt-0.5 text-[13px] font-medium text-ink-900">{l.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-sea-600">
              <Icon name="sparkles" size={12} />
              岛主的建议
            </p>
            <ul className="mt-2 space-y-1.5">
              {report.advice.map((a) => (
                <li key={a} className="flex gap-2 text-[12.5px] leading-[1.75] text-ink-600">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-sea-400" />
                  {a}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-2xl border border-lav-200/60 bg-lav-50/60 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-lav-500">
              <Icon name="feather" size={11} />
              岛主补了一句
            </p>
            <p className="mt-1 text-[12px] leading-[1.8] text-ink-600">
              {reflect ??
                `${STATE_META[report.state].note}这一次的节奏已经写进你的呼吸档案，下次进来我会先问你要不要接着用。`}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={onAgain} className="btn-primary text-[12.5px]">
              <Icon name="refresh" size={14} />
              再练一次
            </button>
            <button onClick={onChange} className="btn-ghost text-[12.5px]">
              <Icon name="chat" size={14} />
              重新描述状态
            </button>
            <button onClick={copy} className="btn-quiet px-3 text-[12px]">
              <Icon name={copied ? 'check' : 'feather'} size={13} />
              {copied ? '已复制' : '复制文字'}
            </button>
          </div>
        </div>

        {/* 明信片预览：与导出的画布同构，所见即所得 */}
        <div>
          <div
            className="relative aspect-[1080/1320] overflow-hidden rounded-3xl border border-white/80 shadow-soft"
            style={{ background: 'linear-gradient(160deg,#f7fcfd 0%,#eff7fa 44%,#fbf4ea 100%)' }}
          >
            <div
              className="absolute -right-10 top-6 h-40 w-40 rounded-full blur-2xl"
              style={{ background: meta.bloom, opacity: 0.7 }}
            />
            <div className="relative flex h-full flex-col p-5 pb-10">
              <p className="text-[7.5px] font-medium uppercase tracking-[0.3em] text-sea-600/70">Serene Isle · 呼吸记录</p>
              <p className="mt-3 font-display text-[30px] font-semibold leading-none tracking-tight text-ink-900">
                {meta.label}
              </p>
              <p className="mt-1.5 text-[10.5px] text-ink-500">
                {report.planName} · {report.minutes} 分钟
              </p>
              <div className="mt-3 h-px w-full bg-sea-400/25" />
              <p className="mt-4 font-display text-[15px] leading-[1.7] text-ink-800">{report.postcard.quote}</p>
              <p className="mt-2 text-[9.5px] leading-relaxed text-ink-400">{report.advice[0]}</p>
              <div className="mt-auto flex items-end justify-between">
                <p className="text-[8px] leading-relaxed text-ink-400">
                  {RHYTHM_LABEL[report.rhythm]} · 第 {nth} 次
                </p>
                <img src="/brand/icon-128.png" alt="" className="h-6 w-6 opacity-60" />
              </div>
            </div>
            {/* 潮线 */}
            <svg viewBox="0 0 300 60" className="absolute inset-x-0 bottom-0 h-16 w-full" aria-hidden="true">
              <path d="M0 34c40-14 70 8 108 4s56-16 92-6 62 2 100-8v36H0z" fill="#94cdd9" opacity="0.34" />
              <path d="M0 44c46-10 74 8 112 2s58-12 94-4 54 0 94-12v30H0z" fill="#c4b9ec" opacity="0.24" />
            </svg>
          </div>
          <button onClick={() => exportPostcard(report, nth)} className="btn-ghost mt-2.5 w-full text-[12px]">
            <Icon name="download" size={14} />
            保存这张情绪明信片
          </button>
        </div>
      </div>
    </motion.section>
  )
}
