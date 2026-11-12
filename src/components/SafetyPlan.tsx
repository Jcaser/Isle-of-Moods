import { useEffect, useState } from 'react'
import { Icon } from './Icons'

const KEY = 'sereneisle.v1.safety-plan'

type Plan = { contact: string; place: string; steps: string }

const EMPTY: Plan = { contact: '', place: '', steps: '' }

/**
 * 安全计划：在状态还稳的时候写下来，等真的撑不住时不必临场想办法。
 * 纯本地存储，不上传；也可以截图或抄在纸上。
 */
export function SafetyPlan() {
  const [plan, setPlan] = useState<Plan>(EMPTY)
  const [editing, setEditing] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Plan
        setPlan({ ...EMPTY, ...parsed })
        if (parsed.contact || parsed.place || parsed.steps) setEditing(false)
      }
    } catch {
      /* 忽略 */
    }
  }, [])

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(plan))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
    } catch {
      /* 忽略 */
    }
    setEditing(false)
  }

  const filled = Boolean(plan.contact || plan.place || plan.steps)

  return (
    <section className="mt-4 overflow-hidden rounded-5xl border border-white/70 bg-gradient-to-br from-white/70 via-sea-50/40 to-lav-50/40 p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">Safety Plan</p>
          <h2 className="mt-1 font-display text-[17px] font-semibold tracking-tight text-ink-900">我的安全计划</h2>
          <p className="mt-1.5 max-w-lg text-[12px] leading-relaxed text-ink-500">
            在还不太难受的时候写下来。等真的撑不住时，照着做就行，不必再临场想办法。
            内容只保存在这台设备上，不会上传。
          </p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost px-3 py-1.5 text-[11.5px]">
            <Icon name="feather" size={13} />
            修改
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-ink-600">
              可以联系的人 <span className="font-normal text-ink-300">（名字 / 电话）</span>
            </span>
            <input
              value={plan.contact}
              onChange={(e) => setPlan((p) => ({ ...p, contact: e.target.value }))}
              placeholder="例：室友小林 138xxxx"
              className="input text-[13px]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-ink-600">
              可以去的地方 <span className="font-normal text-ink-300">（有人的、安全的）</span>
            </span>
            <input
              value={plan.place}
              onChange={(e) => setPlan((p) => ({ ...p, place: e.target.value }))}
              placeholder="例：图书馆三楼靠窗，或宿管阿姨的值班室"
              className="input text-[13px]"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[11.5px] font-medium text-ink-600">
              能让我稳下来的三件小事 <span className="font-normal text-ink-300">（每行一件）</span>
            </span>
            <textarea
              value={plan.steps}
              onChange={(e) => setPlan((p) => ({ ...p, steps: e.target.value }))}
              rows={3}
              placeholder={'洗把脸，用冷水冲手腕\n下楼买一杯热饮\n打开潮汐呼吸，做四轮 4-7-8'}
              className="input resize-none text-[13px] leading-relaxed"
            />
          </label>

          <div className="flex items-center gap-3 sm:col-span-2">
            <button onClick={save} className="btn-primary px-5 py-2 text-[12.5px]">
              <Icon name="check" size={14} />
              保存到本机
            </button>
            <p className="text-[11px] text-ink-300">{saved ? '已保存，可以随时回来修改' : '写不全也没关系，先写一个联系方式'}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { k: '联系', v: plan.contact, hint: '先让一个人知道' },
            { k: '去处', v: plan.place, hint: '不要一个人待着' },
            { k: '稳下来', v: plan.steps, hint: '照做，不用想' },
          ].map((item) => (
            <div key={item.k} className="rounded-3xl border border-white/80 bg-white/65 px-4 py-3.5">
              <p className="text-[10px] tracking-[0.2em] text-ink-300">{item.k}</p>
              <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-800">
                {item.v || <span className="text-ink-300">还没写</span>}
              </p>
              <p className="mt-2 text-[10px] text-ink-300">{item.hint}</p>
            </div>
          ))}
        </div>
      )}

      {filled && !editing && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-coral-500/90">
          <Icon name="alert" size={12} className="mt-0.5 shrink-0" />
          建议截图存到手机相册，或抄一份放在钱包里——浏览器数据被清空时，这份计划也会一起消失。
        </p>
      )}
    </section>
  )
}
