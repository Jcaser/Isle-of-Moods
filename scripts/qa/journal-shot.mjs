import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => {
  try {
    const now = Date.now()
    const day = 86400000
    localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now - day * 12, lastSeen: now }] }))
    localStorage.setItem('sereneisle.auth.session', 'u1')
    localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
    if (!localStorage.getItem('sereneisle.v1.u_u1.mood')) {
      const recs = [2, 3, 3, 2, 4, 3, 4].map((s, i) => ({ id: 'r' + i, ts: now - (6 - i) * day, score: s, tags: ['学业压力'], note: '', source: 'quick' }))
      localStorage.setItem('sereneisle.v1.u_u1.mood', JSON.stringify(recs))
    }
  } catch {}
})
const p = await ctx.newPage()
const S = 'docs/screenshots/'

await p.goto(B + '/mood', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
const box = await p.locator('#journal').boundingBox()
await p.screenshot({ path: S + 'tmp-journal.png', clip: { x: box.x - 16, y: box.y - 16, width: box.width + 32, height: box.height + 32 } })

// 写一页
await p.locator('#journal textarea').fill('今天在图书馆坐了四个小时，但是真正看进去的可能只有一小时。看到旁边的人一直在翻页，我就开始想自己是不是方法不对。晚上回宿舍又刷了很久手机，现在有点后悔，但又觉得今天已经结束了。')
await p.waitForTimeout(300)
await p.getByRole('button', { name: '记下这一页' }).click()
await p.waitForTimeout(4200)
const box2 = await p.locator('#journal').boundingBox()
await p.screenshot({ path: S + 'tmp-journal-2.png', clip: { x: box2.x - 16, y: box2.y - 16, width: box2.width + 32, height: box2.height + 32 } })

// 卡片
await p.getByRole('button', { name: '做成卡片' }).click()
await p.waitForTimeout(1500)
const dlg = await p.locator('[role="dialog"]').boundingBox()
await p.screenshot({ path: S + 'tmp-card.png', clip: { x: dlg.x, y: dlg.y, width: dlg.width, height: Math.min(dlg.height, 980) } })

// 移动端
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await m.addInitScript(() => {
  try {
    const now = Date.now()
    localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now, lastSeen: now }] }))
    localStorage.setItem('sereneisle.auth.session', 'u1')
    localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
  } catch {}
})
const mp = await m.newPage()
await mp.goto(B + '/mood', { waitUntil: 'networkidle' })
await mp.waitForTimeout(1000)
const jb = await mp.locator('#journal').boundingBox()
await mp.screenshot({ path: S + 'tmp-journal-m.png', clip: { x: 0, y: Math.max(jb.y - 10, 0), width: 390, height: 820 } })
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
console.log('mobile overflow:', overflow)

await b.close()
console.log('ok')
