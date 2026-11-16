import { motion } from 'framer-motion'
import { STATE_META, type BreathState } from '../lib/breath'
import { archiveLine, memoryLine, type BreathProfile } from '../lib/breathProfile'
import { Icon } from './Icons'

interface Props {
  profile: BreathProfile
  onClear?: () => void
}

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })

/** 呼吸档案：系统「记得你」的那一小块 */
export function BreathDossier({ profile, onClear }: Props) {
  const memory = memoryLine(profile)
  const has = profile.total > 0

  return (
    <section className="rounded-5xl border border-white/75 bg-white/58 p-5 shadow-soft backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-lav-500">Breath Profile</p>
          <h3 className="mt-1 font-display text-[16px] font-semibold tracking-tight text-ink-900">你的呼吸档案</h3>
        </div>
        <span className="shrink-0 rounded-full bg-white/75 px-2.5 py-1 text-[10px] tabular-nums text-ink-400">
          {profile.total} 次
        </span>
      </div>

      {!has ? (
        <div className="mt-4">
          <p className="text-[12px] leading-[1.85] text-ink-500">
            还空着。第一次练完，这里会记下你的常用节奏、平均时长，还有——你是不是怕屏息。
          </p>
          <div className="mt-3 space-y-2">
            {['常用节奏', '平均时长', '屏息耐受'].map((k) => (
              <div key={k} className="flex items-center justify-between rounded-2xl bg-white/50 px-3.5 py-2">
                <span className="text-[11px] text-ink-400">{k}</span>
                <span className="text-[11px] text-ink-300">还没有记录</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {memory && (
            <div className="mt-3.5 flex gap-2.5 rounded-2xl border border-sea-200/60 bg-sea-50/70 px-3.5 py-2.5">
              <img src="/brand/icon-64.png" alt="" className="mt-0.5 h-5 w-5 shrink-0 object-contain" />
              <p className="text-[11.5px] leading-[1.7] text-ink-600">{memory}</p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[
              { k: '累计', v: profile.minutes < 1 ? '＜1' : `${profile.minutes}`, u: '分钟' },
              { k: '平均', v: profile.avgSeconds < 45 ? '＜1' : `${Math.round(profile.avgSeconds / 60)}`, u: '分钟/次' },
              { k: '连续', v: `${profile.streakDays}`, u: '天' },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-white/60 px-2 py-2 text-center">
                <p className="font-display text-[17px] font-semibold leading-none text-ink-900">{s.v}</p>
                <p className="mt-1 text-[9px] text-ink-300">{s.u}</p>
              </div>
            ))}
          </div>

          <dl className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between rounded-xl px-1 py-0.5">
              <dt className="text-[11px] text-ink-400">常用节奏</dt>
              <dd className="text-[11.5px] font-medium text-ink-800">{profile.topPlan ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl px-1 py-0.5">
              <dt className="text-[11px] text-ink-400">偏好节奏</dt>
              <dd className="text-[11.5px] font-medium text-ink-800">{profile.pace}</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl px-1 py-0.5">
              <dt className="text-[11px] text-ink-400">屏息耐受</dt>
              <dd className={`text-[11.5px] font-medium ${profile.holdAversion ? 'text-coral-500' : 'text-sea-700'}`}>
                {profile.holdAversion ? '建议跳过屏息' : '可以正常屏息'}
              </dd>
            </div>
          </dl>

          {profile.stateCounts.length > 0 && (
            <div className="mt-3 border-t border-white/70 pt-3">
              <p className="text-[10.5px] text-ink-400">来得最多的状态</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.stateCounts.map(({ state, n }) => {
                  const m = STATE_META[state as BreathState]
                  return (
                    <span
                      key={state}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                      style={{ background: m.soft, color: m.color }}
                    >
                      {m.label}
                      <span className="tabular-nums opacity-70">{n}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-3 border-t border-white/70 pt-3">
            <p className="text-[10.5px] text-ink-400">最近五次</p>
            <div className="mt-1.5 space-y-1">
              {profile.sessions.slice(0, 5).map((s) => {
                const m = STATE_META[s.state]
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-[10.5px]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color }} />
                    <span className="w-9 shrink-0 tabular-nums text-ink-300">{fmtDate(s.ts)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-600">{s.planName}</span>
                    <span className="shrink-0 tabular-nums text-ink-400">{Math.max(1, Math.round(s.seconds / 60))}′</span>
                    {s.endedEarly && <span className="shrink-0 text-[9px] text-ink-300">提前</span>}
                  </motion.div>
                )
              })}
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed text-ink-300">{archiveLine(profile)}</p>
          </div>

          {onClear && (
            <button
              onClick={onClear}
              className="mt-3 flex items-center gap-1 text-[10px] text-ink-300 transition hover:text-coral-500"
            >
              <Icon name="trash" size={11} />
              清空呼吸档案
            </button>
          )}
        </>
      )}
    </section>
  )
}
