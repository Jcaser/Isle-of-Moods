/**
 * v10 回归：呼吸陪伴闭环 / 情绪画像 / 避风港向导
 *
 * 用法：先起服务（npm run demo 或 npm run dev），然后
 *   node scripts/qa/breath-companion.mjs                 # 默认 http://127.0.0.1:4173
 *   BASE=http://127.0.0.1:5173 node scripts/qa/breath-companion.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://127.0.0.1:4173'
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch({ channel: 'msedge', args: ['--mute-audio'] })
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// 断掉模型，验证「本地规则」这条路也能走完整流程
await page.route('**/api/v1/chat/completions', (r) => r.abort())

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.evaluate(() => {
  const now = Date.now()
  localStorage.clear()
  localStorage.setItem(
    'sereneisle.auth.users',
    JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now, lastSeen: now }] }),
  )
  localStorage.setItem('sereneisle.auth.session', 'u1')
  localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
  const DAY = 86400000
  const mood = [[26, 3], [24, 2], [22, 2], [20, 2], [18, 2], [16, 1], [15, 2], [13, 3], [11, 3], [9, 4], [8, 3], [6, 3], [5, 4], [3, 4], [2, 3], [1, 4], [0, 4]]
  localStorage.setItem(
    'sereneisle.v1.u_u1.mood',
    JSON.stringify(mood.map(([d, score], i) => ({ id: `m${i}`, ts: now - d * DAY + 3600000 * (9 + (i % 8)), score, tags: i % 3 === 0 ? ['学业压力'] : [], source: 'quick' }))),
  )
})

/* ── 潮汐：状态 → 方案 → 练习中改节奏 → 报告 ── */
await page.goto(`${BASE}/calm`, { waitUntil: 'networkidle' })
// 潮汐页默认是三种固定节奏；呼吸陪伴在「岛主陪伴」这一栏
check('潮汐页保留三种固定呼吸', (await page.getByRole('button', { name: '开始引导' }).count()) === 3)
await page.getByRole('button', { name: '岛主陪伴' }).click()
await page.waitForTimeout(400)
check('潮汐页出现呼吸陪伴入口', (await page.getByRole('button', { name: '我现在有点慌，心跳很快' }).count()) > 0)

await page.getByRole('button', { name: '我现在有点慌，心跳很快' }).click()
await page.waitForFunction(() => document.body.innerText.includes('开始练习'), { timeout: 15000 })
const planText = await page.evaluate(() => document.body.innerText)
check('断网时仍生成方案', planText.includes('4-4-8'), planText.includes('本地规则') ? '本地规则' : '模型')

await page.getByRole('button', { name: '开始练习' }).click()
await page.waitForTimeout(1500)
await page.getByRole('button', { name: '太急了' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: '太急了' }).click()
await page.waitForTimeout(800)
const overlayText = await page.evaluate(() => document.querySelector('[aria-label="潮汐呼吸引导"]')?.innerText ?? '')
check('连续两次「太急」切到 3-4-6', overlayText.includes('3-4-6'), overlayText.split('\n')[2])

await page.waitForTimeout(16000)
await page.getByRole('button', { name: '退出呼吸练习' }).click()
await page.waitForTimeout(2200)
const reportText = await page.evaluate(() => document.body.innerText)
check('提前退出也生成报告', reportText.includes('SESSION REPORT'), reportText.includes('提前结束') ? '标记提前' : '')
check('报告写入档案', reportText.includes('最近五次'))

/* ── 潮向：画像 ── */
await page.goto(`${BASE}/mood`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check('画像雷达图渲染', (await page.locator('svg[aria-label="情绪画像雷达图"]').count()) > 0)
const moodText = await page.evaluate(() => document.body.innerText)
check('画像类型名出现', /(稳定回涨型|平稳巡航型|压力聚集型|身体先知道型|慢回涨型|起伏明显型)/.test(moodText))
await page.getByRole('button', { name: /这张画像怎么来的/ }).click()
await page.waitForTimeout(300)
check('可展开画像依据', (await page.evaluate(() => document.body.innerText)).includes('恢复力'))

/* ── 避风港：向导 + 话术 ── */
await page.goto(`${BASE}/harbor`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /身体难受/ }).click()
await page.getByRole('button', { name: /身边有人/ }).click()
await page.waitForTimeout(500)
const harborText = await page.evaluate(() => document.body.innerText)
check('向导给出 10 分钟清单', harborText.includes('接下来 10 分钟'))
await page.getByRole('button', { name: /把双脚平放在地面/ }).click()
check('清单可勾选', (await page.evaluate(() => document.body.innerText)).includes('今天已经完成'))

await page.getByRole('button', { name: '医生 / 咨询师' }).click()
await page.getByRole('button', { name: '想找专业帮助' }).click()
await page.getByRole('button', { name: '复制这句话' }).last().click()
await page.waitForTimeout(400)
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))
check('话术可复制', clip.length > 10, clip.slice(0, 24))

check('无运行时报错', errors.length === 0, errors.slice(0, 2).join(' / '))
await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
process.exit(failed.length ? 1 : 0)
