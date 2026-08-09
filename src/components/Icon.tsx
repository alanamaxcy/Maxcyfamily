/** Line icons, 24×24, stroke-based so they inherit colour and weight. */

import type { CSSProperties } from 'react'

export type IconName =
  | 'today' | 'calendar' | 'meals' | 'recipes' | 'todos' | 'routines' | 'rewards' | 'profiles'
  | 'weather' | 'settings' | 'plus' | 'close' | 'chevronLeft' | 'chevronRight' | 'chevronDown'
  | 'search' | 'trash' | 'edit' | 'check' | 'refresh' | 'camera' | 'image' | 'undo' | 'more'
  | 'star' | 'flame' | 'cart' | 'clock' | 'sparkle' | 'lock' | 'download' | 'upload' | 'link'
  | 'minus' | 'drag' | 'bell' | 'moon'

const PATHS: Record<IconName, string> = {
  today: 'M4 12 12 4l8 8M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5',
  calendar: 'M4 8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5ZM4 11h16M8.5 4.5v4M15.5 4.5v4',
  meals: 'M6 3v8a2.5 2.5 0 0 0 5 0V3M8.5 11v10M17.5 3c-1.7 0-2.5 2.2-2.5 5s.8 4 2.5 4V3ZM17.5 12v9',
  recipes: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 0 5 20.5v-16ZM5 18.5A1.5 1.5 0 0 1 6.5 17H19M9 8h6M9 11.5h4',
  todos: 'M4.5 7.5 6 9l2.5-2.5M4.5 14.5 6 16l2.5-2.5M12 8h7.5M12 15h7.5',
  routines: 'M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z',
  rewards: 'M12 3.5 14.6 9l5.9.8-4.3 4.1 1.1 5.8-5.3-2.9-5.3 2.9 1.1-5.8L3.5 9.8 9.4 9 12 3.5Z',
  profiles: 'M4 19.5c0-3 2.7-4.8 5-4.8s5 1.8 5 4.8M9 5.5a3.2 3.2 0 1 1 0 6.5 3.2 3.2 0 0 1 0-6.5ZM16 19.5c0-2.3-1-3.7-2.2-4.6M15.4 6.1a3 3 0 0 1 .3 5.6',
  weather: 'M12 3.5v2M12 18.5v2M4.9 12h-2M21 12h-2M6.7 6.7 5.3 5.3M18.7 18.7l-1.4-1.4M17.3 6.7l1.4-1.4M5.3 18.7l1.4-1.4M12 7.6a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8Z',
  settings: 'M12 9.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6ZM19.3 14.3a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-2.7-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.1-2.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.6h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z',
  plus: 'M12 5.5v13M5.5 12h13',
  minus: 'M5.5 12h13',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  chevronLeft: 'M14.5 5.5 8 12l6.5 6.5',
  chevronRight: 'M9.5 5.5 16 12l-6.5 6.5',
  chevronDown: 'M5.5 9.5 12 16l6.5-6.5',
  search: 'M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM16 16l3.5 3.5',
  trash: 'M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5',
  edit: 'M4.5 19.5h3l10-10a2.1 2.1 0 0 0-3-3l-10 10v3ZM14.5 7.5l2 2',
  check: 'M5 12.5 9.5 17 19 7.5',
  refresh: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5',
  camera: 'M4 8.5a2 2 0 0 1 2-2h1.8l1.2-2h6l1.2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9ZM12 9.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z',
  image: 'M4 6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11ZM4 16l4.5-4.5 4 4 3-3L20 16M9 9.5a1 1 0 1 1 0-.1',
  undo: 'M4 9.5h9.5a5.5 5.5 0 1 1 0 11H8M4 9.5 8 5.5M4 9.5l4 4',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  star: 'M12 3.5 14.6 9l5.9.8-4.3 4.1 1.1 5.8-5.3-2.9-5.3 2.9 1.1-5.8L3.5 9.8 9.4 9 12 3.5Z',
  flame: 'M12 3s5.5 4.2 5.5 9.2A5.5 5.5 0 0 1 12 21a5.5 5.5 0 0 1-5.5-8.8C6.5 8 12 3 12 3ZM12 21a2.6 2.6 0 0 1-2.6-3.9c.4-1.2 2.6-3.1 2.6-3.1s2.2 1.9 2.6 3.1A2.6 2.6 0 0 1 12 21Z',
  cart: 'M3.5 4.5h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.3a1.5 1.5 0 0 0 1.5-1.2L19.5 8H6M9.5 20a1 1 0 1 1 0-.1M17 20a1 1 0 1 1 0-.1',
  clock: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM12 7.5V12l3 2',
  sparkle: 'M12 3.5l1.8 4.9 4.9 1.8-4.9 1.8L12 16.9l-1.8-4.9-4.9-1.8 4.9-1.8L12 3.5ZM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z',
  lock: 'M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15',
  upload: 'M12 20V9M7.5 13.5 12 9l4.5 4.5M4.5 4.5h15',
  link: 'M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5L12.5 17',
  drag: 'M9 7h.01M9 12h.01M9 17h.01M15 7h.01M15 12h.01M15 17h.01',
  bell: 'M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10ZM10 19a2 2 0 0 0 4 0',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
}

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 22, strokeWidth = 1.9, className, style }: IconProps) {
  const dotty = name === 'more' || name === 'drag'

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={dotty ? 2.6 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
