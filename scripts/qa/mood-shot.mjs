import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const S = 'docs/screenshots/'

const seed = () => {
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
}

const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
await ctx.addInitScript(seed)
const p = await ctx.newPage()

await p.goto(B + '/mood', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)

const hasEntry = await p.locator('#journal button:has-text("今天")').count()
if (!hasEntry) {
  await p.locator('#journal textarea').fill('今天在图书馆坐了四个小时，但真正看进去的可能只有一小时。看到旁边的人一直在翻页，就开始想是不是自己方法不对。晚上回宿舍又刷了很久手机，现在有点后悔，又觉得今天已经过完了。')
  await p.waitForTimeout(300)
  await p.getByRole('button', { name: '记下这一页' }).click()
  await p.waitForTimeout(4500)
}

await p.evaluate(() => {
  const el = document.getElementById('journal')
  el?.scrollIntoView({ block: 'start' })
  window.scrollBy(0, -215)
})
await p.waitForTimeout(700)
await p.screenshot({ path: S + 'mood.png' })

const box = await p.locator('#journal').boundingBox()
await p.screenshot({ path: S + 'journal.png', clip: { x: box.x - 14, y: box.y - 14, width: box.width + 28, height: box.height + 28 } })

await b.close()
console.log('ok')
