/** 静态氛围层：柔和光斑 + 三层缓慢漂移的海浪 */

function WaveLayer({ color, opacity, y }: { color: string; opacity: number; y: number }) {
  return (
    <svg
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <path
        fill={color}
        fillOpacity={opacity}
        d={`M0 ${120 + y} C 160 ${70 + y}, 300 ${170 + y}, 480 ${130 + y} C 660 ${90 + y}, 780 ${180 + y}, 960 ${140 + y} C 1140 ${100 + y}, 1280 ${160 + y}, 1440 ${110 + y} L1440 320 L0 320 Z`}
      />
    </svg>
  )
}

export function WaveBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-32 -top-24 h-[30rem] w-[30rem] rounded-full bg-sea-200/35 blur-3xl animate-pulse-soft" />
      <div className="absolute -right-24 top-10 h-[26rem] w-[26rem] rounded-full bg-lav-200/40 blur-3xl animate-pulse-soft [animation-delay:1.2s]" />
      <div className="absolute left-1/3 top-1/2 h-[22rem] w-[22rem] rounded-full bg-sand-100/60 blur-3xl" />

      <div className="absolute inset-x-0 bottom-0 h-[26vh] min-h-[180px] [mask-image:linear-gradient(to_bottom,transparent_0%,black_34%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_34%)]">
        <div className="wave-track h-full animate-drift-slow">
          <WaveLayer color="#bfe2ea" opacity={0.42} y={10} />
          <WaveLayer color="#bfe2ea" opacity={0.42} y={10} />
        </div>
        <div className="wave-track absolute inset-x-0 bottom-0 h-[78%] animate-drift-mid">
          <WaveLayer color="#94cdd9" opacity={0.28} y={50} />
          <WaveLayer color="#94cdd9" opacity={0.28} y={50} />
        </div>
        <div className="wave-track absolute inset-x-0 bottom-0 h-[52%] animate-drift-fast">
          <WaveLayer color="#c4b9ec" opacity={0.22} y={90} />
          <WaveLayer color="#c4b9ec" opacity={0.22} y={90} />
        </div>
      </div>
    </div>
  )
}
