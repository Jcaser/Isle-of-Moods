import type { SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'chat'
  | 'book'
  | 'wave'
  | 'chart'
  | 'lifebuoy'
  | 'settings'
  | 'send'
  | 'mic'
  | 'close'
  | 'arrowRight'
  | 'download'
  | 'refresh'
  | 'play'
  | 'pause'
  | 'stop'
  | 'check'
  | 'sparkles'
  | 'shield'
  | 'heart'
  | 'clock'
  | 'menu'
  | 'leaf'
  | 'trash'
  | 'volume'
  | 'alert'
  | 'compass'
  | 'feather'
  | 'eye'
  | 'eyeOff'
  | 'lock'
  | 'user'
  | 'logout'
  | 'mail'

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

const PATHS: Record<IconName, JSX.Element> = {
  home: <path d="M3 10.4 12 3.2l9 7.2V20a1 1 0 0 1-1 1h-5.2v-6.4H9.2V21H4a1 1 0 0 1-1-1z" />,
  chat: (
    <>
      <path d="M20.5 11.6c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4.5 20l1.1-3.5A6.9 6.9 0 0 1 3.5 11.6c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z" />
      <path d="M8.6 11.6h.01M12 11.6h.01M15.4 11.6h.01" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H11v18H6.2A2.2 2.2 0 0 1 4 18.8z" />
      <path d="M20 5.2A2.2 2.2 0 0 0 17.8 3H13v18h4.8A2.2 2.2 0 0 0 20 18.8z" />
      <path d="M13 8.4h4M13 12h4M7 8.4h1.5M7 12h1.5" strokeWidth="1.3" />
    </>
  ),
  wave: (
    <>
      <path d="M2 9.5c1.9-3.2 3.6-3.2 5.5 0s3.6 3.2 5.5 0 3.6-3.2 5.5 0 3.6 3.2 3.5 0" />
      <path d="M2 15.5c1.9-3.2 3.6-3.2 5.5 0s3.6 3.2 5.5 0 3.6-3.2 5.5 0 3.6 3.2 3.5 0" opacity=".55" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V11M10 20V4M16 20v-6M21 20H3" strokeLinecap="round" />
    </>
  ),
  lifebuoy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="m5.6 5.6 3.8 3.8M18.4 5.6l-3.8 3.8M18.4 18.4l-3.8-3.8M5.6 18.4l3.8-3.8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h9M17 17h3" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  send: <path d="M21.5 2.5 10.8 13.2M21.5 2.5l-6.8 19-3.9-8.3-8.3-3.9z" strokeLinejoin="round" />,
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5v.6a6.5 6.5 0 0 0 13 0v-.6M12 18.6V21" strokeLinecap="round" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />,
  arrowRight: <path d="M4 12h15m-5.5-5.5L19 12l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />,
  download: (
    <>
      <path d="M12 3.5v11.5m-4.5-4.5L12 15l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 20h15" strokeLinecap="round" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" strokeLinecap="round" />
      <path d="M20.5 3.5v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  play: <path d="M7.5 4.8 19 12 7.5 19.2z" strokeLinejoin="round" />,
  pause: (
    <>
      <path d="M9 4.5v15M15 4.5v15" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" strokeLinecap="round" strokeLinejoin="round" />,
  sparkles: (
    <>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z" strokeLinejoin="round" />
      <path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" strokeLinejoin="round" opacity=".6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 4.7-3.6 7.8-8 9-4.4-1.2-8-4.3-8-9V6z" strokeLinejoin="round" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  heart: <path d="M12 20.2S4.5 15.6 4.5 10.2a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8c0 5.4-7.5 10-7.5 10Z" strokeLinejoin="round" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.4V12l3.2 2" strokeLinecap="round" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />,
  leaf: (
    <>
      <path d="M20 4c-8 0-14 3.6-14 10a5.5 5.5 0 0 0 5.5 5.5C18 19.5 20 12 20 4Z" strokeLinejoin="round" />
      <path d="M4 21c2-6 6-9.5 11-12" strokeLinecap="round" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L18 7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" strokeLinejoin="round" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a7.8 7.8 0 0 1 0 11" strokeLinecap="round" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.8 21 19.5H3z" strokeLinejoin="round" />
      <path d="M12 9.5v4.2M12 16.6h.01" strokeLinecap="round" strokeWidth="2.2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z" strokeLinejoin="round" />
    </>
  ),
  eye: (
    <>
      <path d="M2.2 12S5.6 5.6 12 5.6 21.8 12 21.8 12 18.4 18.4 12 18.4 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 5.9A8.7 8.7 0 0 1 12 5.6c6.4 0 9.8 6.4 9.8 6.4a17 17 0 0 1-2.9 3.8" />
      <path d="M6.4 6.9A17 17 0 0 0 2.2 12S5.6 18.4 12 18.4c1.6 0 3-.4 4.2-1" />
      <path d="M10 10a2.9 2.9 0 0 0 4 4" />
      <path d="M3.4 3.4l17.2 17.2" strokeLinecap="round" />
    </>
  ),
  lock: (
    <>
      <rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.6" />
      <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" />
      <path d="M12 14.6v2.2" strokeLinecap="round" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.8" />
      <path d="M4.6 20.2c.8-3.6 3.8-5.6 7.4-5.6s6.6 2 7.4 5.6" strokeLinecap="round" />
    </>
  ),
  logout: (
    <>
      <path d="M14.4 4.6H6.2a2 2 0 0 0-2 2v10.8a2 2 0 0 0 2 2h8.2" />
      <path d="M16.4 8.4 20 12l-3.6 3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 12h10" strokeLinecap="round" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.4" width="18" height="13.2" rx="2.4" />
      <path d="M3.8 6.6 12 12.6l8.2-6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  feather: (
    <>
      <path d="M19.5 4.5c-1.5-1.5-4-1.2-6 .8L5 13.8V19h5.2l8.5-8.5c2-2 2.3-4.5.8-6Z" strokeLinejoin="round" />
      <path d="M5 19 13 11M11 8.5l3.5 3.5" strokeLinecap="round" />
    </>
  ),
}

export function Icon({ name, size = 20, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
