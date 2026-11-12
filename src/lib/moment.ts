/**
 * 岛屿时刻：只切换天空的色相与强调色，不压暗画面。
 * 这样在任何时刻下正文对比度都保持合格，同时整站氛围会随之变化。
 */

export type Moment = 'dawn' | 'noon' | 'dusk' | 'night'

export const MOMENT_KEY = 'sereneisle.v1.moment'

export const MOMENTS: {
  id: Moment
  label: string
  time: string
  hint: string
  from: string
  to: string
}[] = [
  {
    id: 'dawn',
    label: '清晨',
    time: '05:00',
    hint: '海面还带着雾，适合慢慢开始',
    from: '#fce0e6',
    to: '#dcd8f8',
  },
  {
    id: 'noon',
    label: '正午',
    time: '12:00',
    hint: '光线最亮，适合把计划摊开看',
    from: '#cfeaf1',
    to: '#c9c2f0',
  },
  {
    id: 'dusk',
    label: '黄昏',
    time: '18:00',
    hint: '潮水退下去，适合收一收今天',
    from: '#faded0',
    to: '#e6d0ec',
  },
  {
    id: 'night',
    label: '夜航',
    time: '22:00',
    hint: '灯塔亮着，适合睡前把心放下来',
    from: '#d3d9f7',
    to: '#ded1f2',
  },
]

/** 按真实时间猜一个默认时刻 */
export function guessMoment(d = new Date()): Moment {
  const h = d.getHours()
  if (h >= 5 && h < 9) return 'dawn'
  if (h >= 9 && h < 17) return 'noon'
  if (h >= 17 && h < 20) return 'dusk'
  return 'night'
}

export function applyMoment(m: Moment) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.moment = m
}

export function loadMoment(): Moment {
  try {
    const raw = localStorage.getItem(MOMENT_KEY)
    if (raw === 'dawn' || raw === 'noon' || raw === 'dusk' || raw === 'night') return raw
  } catch {
    /* 忽略隐私模式下的存储异常 */
  }
  return guessMoment()
}

export function saveMoment(m: Moment) {
  try {
    localStorage.setItem(MOMENT_KEY, m)
  } catch {
    /* 忽略 */
  }
  applyMoment(m)
}
