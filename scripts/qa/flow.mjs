import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

// 注册一次
await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.fill('input[aria-label="你的名字"]', '林小屿')
await p.fill('input[aria-label="暗号"]', '1234')
await p.click('button[type="submit"]')
await p.waitForTimeout(600)
await p.click('button:has-text("开辟我的岛")')
await p.waitForTimeout(1600)
const intro = await p.$('button:has-text("进入岛屿")')
if (intro) await intro.click()
await p.waitForTimeout(600)

// 退出 → 登录页应显示已有岛主
await p.click('button[aria-label="岛主菜单"]')
await p.waitForTimeout(400)
await p.screenshot({ path: '.shots/v12-menu.png', clip: { x: 820, y: 0, width: 620, height: 300 } })
await p.click('button[role="menuitem"]:has-text("切换岛主")')
await p.waitForTimeout(800)
await p.screenshot({ path: '.shots/v12-gate-again.png' })
console.log('after signout, gate visible:', await p.isVisible('input[aria-label="你的名字"]'))

// 错误密码
await p.click('button:has-text("林小屿")')
await p.fill('input[aria-label="暗号"]', '0000')
await p.click('button[type="submit"]')
await p.waitForTimeout(700)
await p.screenshot({ path: '.shots/v12-wrong-pw.png' })
const alertText = await p.textContent('[role="alert"]').catch(() => null)
console.log('wrong pw alert:', alertText)

// 正确密码
await p.fill('input[aria-label="暗号"]', '1234')
await p.click('button[type="submit"]')
await p.waitForTimeout(1600)
const intro2 = await p.$('button:has-text("进入岛屿")')
if (intro2) await intro2.click()
await p.waitForTimeout(700)
console.log('signed in again:', await p.isVisible('img[alt=""]'))

// 设置弹窗位置
await p.click('button[aria-label="设置"]')
await p.waitForTimeout(700)
await p.screenshot({ path: '.shots/v12-settings.png' })
const dlg = await p.evaluate(() => {
  const d = document.querySelectorAll('[role="dialog"]')
  const l = d[d.length - 1]
  const r = l.getBoundingClientRect()
  return { top: Math.round(r.top), h: Math.round(r.height), pos: getComputedStyle(l).position }
})
console.log('settings dialog:', JSON.stringify(dlg))
await p.keyboard.press('Escape')
await p.waitForTimeout(400)

// 聊天页
await p.goto(B + '/chat', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await p.screenshot({ path: '.shots/v12-chat.png' })
console.log('errors:', errs)
await b.close()
