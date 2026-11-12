import { motion, useScroll, useSpring } from 'framer-motion'

/** 顶部阅读进度条，给长页面一个"地形感" */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 26, restDelta: 0.001 })

  return <motion.div aria-hidden="true" className="scroll-progress" style={{ scaleX }} />
}
