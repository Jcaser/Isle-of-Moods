/**
 * 岛屿首页 · 明信片画廊
 * 图片是手绘质感的励志小画，图上已经写好了那句话，所以 caption 只用于 alt 与大图说明。
 */
export interface GalleryItem {
  src: string
  caption: string
}

export const GALLERY: GalleryItem[] = [
  { src: '/gallery/goodnight-tree.webp', caption: '晚安，也爱今天的自己' },
  { src: '/gallery/love-yourself.webp', caption: '不要忘记一直爱自己' },
  { src: '/gallery/lighthouse.webp', caption: '今天也值得被温柔对待' },
  { src: '/gallery/light-path.webp', caption: '别怕，你走在自己的光里' },
  { src: '/gallery/snow-warm.webp', caption: '再走几步，就会暖和起来' },
  { src: '/gallery/beach-slowly.webp', caption: '慢慢来，也会到达' },
  { src: '/gallery/green-hope.webp', caption: '不要忘记，满怀希望' },
]
