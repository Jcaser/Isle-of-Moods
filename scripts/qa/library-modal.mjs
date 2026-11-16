import { chromium } from 'playwright'

const B = 'http://127.0.0.1:4180'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(B + '/library', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  const now = Date.now()
  localStorage.setItem(
    'sereneisle.auth.users',
    JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now, lastSeen: now }] }),
  )
  localStorage.setItem('sereneisle.auth.session', 'u1')
  localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1100)
await p.getByRole('tab', { name: '藏书阁' }).click()
await p.waitForTimeout(700)

const probe = () =>
  p.evaluate(() => {
    const panel = document.querySelector('[role="dialog"] .glass-strong')
    if (!panel) return null
    const r = panel.getBoundingClientRect()
    const h = panel.querySelector('h2')
    const hr = h?.getBoundingClientRect()
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      inView: r.top >= -1 && r.bottom <= window.innerHeight + 1,
      titleInView: hr ? hr.top >= 0 && hr.bottom <= window.innerHeight : false,
      title: h?.textContent?.slice(0, 20) ?? null,
    }
  })

const open = async (i) => {
  await p.evaluate((idx) => document.querySelectorAll('button.group.flex.h-full')[idx].click(), i)
  await p.waitForTimeout(600)
}
const close = async () => {
  await p.keyboard.press('Escape')
  await p.waitForTimeout(550)
}

const startScroll = await p.evaluate(() => Math.round(window.scrollY))
const total = await p.locator('button.group.flex.h-full').count()
const fails = []
for (let i = 0; i < total; i++) {
  await open(i)
  const s = await probe()
  await p.setViewportSize({ width: 1920, height: 1080 })
  await p.waitForTimeout(500)
  const f = await probe()
  await p.setViewportSize({ width: 1100, height: 700 })
  await p.waitForTimeout(450)
  await close()
  if (!s?.inView || !s?.titleInView || !f?.inView || !f?.titleInView) fails.push({ i, title: s?.title, s, f })
}
const endScroll = await p.evaluate(() => Math.round(window.scrollY))

// 书墙三本
await p.getByRole('tab', { name: '书墙' }).click()
await p.waitForTimeout(600)
const wallFails = []
for (let i = 0; i < 3; i++) {
  await p.evaluate((idx) => document.querySelectorAll('button[aria-label^="翻开"]')[idx].click(), i)
  await p.waitForTimeout(650)
  const small = await p.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .max-w-4xl')
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= window.innerHeight + 1 }
  })
  await p.setViewportSize({ width: 1920, height: 1080 })
  await p.waitForTimeout(600)
  const full = await p.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .max-w-4xl')
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= window.innerHeight + 1 }
  })
  await p.setViewportSize({ width: 1100, height: 700 })
  await p.waitForTimeout(450)
  await close()
  if (!small.inView || !full.inView) wallFails.push({ i, small, full })
}

// 写一本书（BookStudio 也用 Modal）
await p.getByRole('button', { name: '写一本书' }).click()
await p.waitForTimeout(800)
const studioState = await p.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]')
  const r = dlg?.querySelector('.glass-strong')?.getBoundingClientRect()
  return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= window.innerHeight + 1 } : null
})
await p.screenshot({ path: '.shots/lib/H-studio.png' })
await close()

// 岛屿设置（同一个 Modal）
await p.evaluate(() => document.querySelector('button[aria-label="岛主菜单"]')?.click())
await p.waitForTimeout(400)
await p.getByRole('menuitem', { name: '岛屿设置' }).click()
await p.waitForTimeout(700)
const settingsState = await p.evaluate(() => {
  const r = document.querySelector('[role="dialog"] .glass-strong')?.getBoundingClientRect()
  return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= window.innerHeight + 1 } : null
})

console.log(JSON.stringify({ total, fails, startScroll, endScroll, wallFails, studioState, settingsState }, null, 1))
console.log('errors:', errs)
await b.close()
