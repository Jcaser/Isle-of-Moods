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
const log = (s) => console.log('· ' + s)

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

// 1. 在岛上点"藏书阁"
await p.getByRole('button', { name: '藏书阁', exact: true }).first().click()
await p.waitForTimeout(500)
const panel = await p.locator('text=THE ARCHIVE').count()
log('点选藏书阁后，面板出现 ARCHIVE 标题: ' + panel)

// 2. 进入副页面
await p.getByRole('button', { name: '进入藏书阁' }).click()
await p.waitForTimeout(900)
log('进入后 URL: ' + new URL(p.url()).pathname)

// 3. 副页面顶部点"回到岛屿地图"
await p.getByRole('button', { name: '返回岛屿全景地图' }).first().click()
await p.waitForTimeout(1000)
log('返回后 URL: ' + new URL(p.url()).pathname)
const restored = await p.locator('text=THE ARCHIVE').count()
log('返回后仍停在藏书阁面板: ' + restored)

// 4. 底部回岛卡片
await p.goto(B + '/calm', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.getByRole('button', { name: /回到岛屿地图/ }).last().click()
await p.waitForTimeout(900)
log('底部卡片返回后 URL: ' + new URL(p.url()).pathname)

// 5. 移动端
const m = await b.newContext({ viewport: { width: 390, height: 844 } })
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
await mp.waitForTimeout(800)
const btn = mp.getByRole('button', { name: '返回岛屿全景地图' }).first()
log('移动端返回按钮可见: ' + (await btn.isVisible()))
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
log('移动端横向溢出像素: ' + overflow)

await b.close()
