/**
 * 潮汐页「明信片」素材。
 *
 * 八张手绘插画随包一起发布（public/postcards/），不请求任何外部图床：
 * 断网可用、加载稳定，也不会把访问行为透给第三方。
 * 每张配一个短标题和一句场景说明，翻到某张时告诉用户「这张在讲什么」。
 */
export interface Postcard {
  id: string
  /** public 下的绝对路径 */
  src: string
  /** 明信片标题 */
  name: string
  /** 一句话场景说明 */
  scene: string
}

export const POSTCARDS: Postcard[] = [
  {
    id: 'paper-planes',
    src: '/postcards/paper-planes.jpg',
    name: '纸飞机与小径',
    scene: '书包还敞着，纸飞机已经先飞出去了。出发前的那点紧张，也可以很轻。',
  },
  {
    id: 'bubbles',
    src: '/postcards/bubbles.jpg',
    name: '湖边的泡泡',
    scene: '晚霞落在水面上，泡泡里装着白天没来得及看的照片。',
  },
  {
    id: 'meadow-music',
    src: '/postcards/meadow-music.jpg',
    name: '草地的五线谱',
    scene: '风把草叶吹成一行行谱子，阳光是那颗一直亮着的音符。',
  },
  {
    id: 'starry-song',
    src: '/postcards/starry-song.jpg',
    name: '星空下的歌',
    scene: '躺下来之后，银河才开始出声。今晚不用赶路。',
  },
  {
    id: 'moon-tree',
    src: '/postcards/moon-tree.jpg',
    name: '月下的树',
    scene: '满月很大，树把光分成一小片一小片，落在草上。',
  },
  {
    id: 'sunflowers',
    src: '/postcards/sunflowers.jpg',
    name: '窗边的向日葵',
    scene: '雨还没停，玻璃上挂满水珠，花却一直朝着有光的那边。',
  },
  {
    id: 'jellyfish',
    src: '/postcards/jellyfish.jpg',
    name: '水母的海',
    scene: '海面之上很吵，海面之下只有很慢的呼吸。',
  },
  {
    id: 'kite',
    src: '/postcards/kite.jpg',
    name: '风的形状',
    scene: '风筝线绷直的那一刻，你能看见风长什么样。',
  },
]

/** 明信片上可以题的一句话 */
export const POSTCARD_QUOTES = [
  '停泊情绪风浪，从容奔赴考场',
  '你不需要一直坚强，只需要被好好接住',
  '慢一点也没关系，潮水从不催促礁石',
  '把今天过完，就已经很了不起',
]
