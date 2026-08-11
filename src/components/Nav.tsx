/**
 * Bottom navigation: four everyday destinations plus a menu for the rest.
 *
 * Eight tabs never fitted a phone. These four are the ones tapped daily; the
 * setup-ish screens live behind the hamburger.
 */

import { motion, LayoutGroup } from 'framer-motion'
import type { CSSProperties } from 'react'
import { Icon, type IconName } from './Icon.tsx'

export interface NavTab {
  id: string
  label: string
  icon: IconName
  color: string
}

export const TABS: NavTab[] = [
  { id: 'today', label: 'Home', icon: 'today', color: 'var(--coral)' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar', color: 'var(--cobalt)' },
  { id: 'meals', label: 'Menu', icon: 'meals', color: 'var(--forest)' },
  { id: 'todos', label: 'To-dos', icon: 'todos', color: 'var(--teal)' },
]

export function Nav({
  active,
  onChange,
  onOpenMore,
  moreActive,
}: {
  active: string
  onChange: (id: string) => void
  onOpenMore: () => void
  moreActive: boolean
}) {
  return (
    <nav className="nav" aria-label="Main">
      <LayoutGroup id="nav">
        {TABS.map((tab) => {
          const on = tab.id === active
          return (
            <motion.button
              key={tab.id}
              className={`nav-item${on ? ' on' : ''}`}
              style={{ '--tint': tab.color, '--tint-soft': `color-mix(in srgb, ${tab.color} 15%, transparent)` } as CSSProperties}
              onClick={() => onChange(tab.id)}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 460, damping: 32 }}
              aria-current={on ? 'page' : undefined}
            >
              {on ? (
                <motion.span
                  className="nav-pill"
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                />
              ) : null}
              <Icon name={tab.icon} size={25} className="nav-icon" strokeWidth={on ? 2.2 : 1.85} />
              <span className="nav-label">{tab.label}</span>
            </motion.button>
          )
        })}

        {/* Anything the hamburger owns keeps the button lit, so you can still
            see where you are while on, say, Rewards. */}
        <motion.button
          className={`nav-item${moreActive ? ' on' : ''}`}
          style={{ '--tint': 'var(--ink-2)', '--tint-soft': 'var(--surface-2)' } as CSSProperties}
          onClick={onOpenMore}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 460, damping: 32 }}
          aria-haspopup="dialog"
        >
          {moreActive ? (
            <motion.span
              className="nav-pill"
              layoutId="nav-pill"
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            />
          ) : null}
          <Icon name="menu" size={25} className="nav-icon" strokeWidth={moreActive ? 2.2 : 1.85} />
          <span className="nav-label">More</span>
        </motion.button>
      </LayoutGroup>
    </nav>
  )
}
