import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 } })
await ctx.addInitScript(() => {
  try {
    const now = Date.now()
    localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now, lastSeen: now }] }))
    localStorage.setItem('sereneisle.auth.session', 'u1')
    localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
  } catch {}
})
const p = await ctx.newPage()

// 1. 本地模式：三种完全不同的输入，回复不应是同一句
await p.goto(B + '/chat', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)

const inputs = ['今天和室友吵了一架，回宿舍都不想说话', '一想到下周的模考就心慌手抖', '我每天学十个小时还是觉得不够，是不是我太笨了']
const replies = []

for (const q of inputs) {
  const box = p.locator('textarea').last()
  await box.fill(q)
  await box.press('Enter')
  await p.waitForTimeout(3000)
  const last = p.locator('.md-body').last()
  replies.push((await last.innerText()).replace(/\s+/g, ' ').slice(0, 90))
}

replies.forEach((r, i) => console.log(`[${i + 1}] ${r}`))
console.log('互不相同:', new Set(replies).size === replies.length)

// 2. 从潮向页回地图，应滚到地图位置
await p.goto(B + '/mood', { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
await p.evaluate(() => window.scrollTo(0, 400))
await p.waitForTimeout(300)
await p.getByRole('button', { name: '返回岛屿全景地图' }).first().click()
await p.waitForTimeout(1400)
const info = await p.evaluate(() => {
  const el = document.getElementById('atlas')
  return {
    path: location.pathname,
    scrollY: Math.round(window.scrollY),
    atlasTop: el ? Math.round(el.getBoundingClientRect().top) : null,
  }
})
console.log('回岛滚动:', JSON.stringify(info))

await b.close()
