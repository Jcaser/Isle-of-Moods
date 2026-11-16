/**
 * 图片预处理：在本地把用户选的照片压到适合多模态输入的尺寸。
 *
 * 为什么要压：视觉 token 按像素面积计费，一张 4000×3000 的原图会带来上万 token。
 * 这里统一缩到长边 768（送模型）与 320（存本地做缩略图），既不丢关键信息，也不烧额度。
 * 全部在浏览器本地完成，图片不上传到任何第三方存储。
 */

export interface PreparedImage {
  /** 送给模型的 data URL（长边 768，jpeg） */
  payload: string
  /** 存在消息里的缩略图（长边 320，jpeg），只用于显示 */
  thumb: string
  /** 原始宽高，用于提示 */
  size: [number, number]
}

const MAX_INPUT_MB = 8

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('这张图片读不出来，换一张试试'))
    }
    img.src = url
  })
}

function draw(img: HTMLImageElement, maxEdge: number, quality: number): string {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持图片处理')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('只能发送图片文件')
  if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new Error(`图片太大了（上限 ${MAX_INPUT_MB}MB）`)

  const img = await loadImage(file)
  // 送模型的图不小于 14px 长边（服务端最小尺寸限制）
  const payload = draw(img, 768, 0.82)
  const thumb = draw(img, 320, 0.7)
  return { payload, thumb, size: [img.naturalWidth, img.naturalHeight] }
}
