/** Bottom navigation with a pill that morphs between tabs. */

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
  { id: 'today', label: 'Today', icon: 'today', color: 'var(--coral)' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', color: 'var(--cobalt)' },
  { id: 'routines', label: 'Routines', icon: 'routines', color: 'var(--violet)' },
  { id: 'rewards', label: 'Rewards', icon: 'rewards', color: 'var(--amber)' },
  { id: 'meals', label: 'Meals', icon: 'meals', color: 'var(--forest)' },
  { id: 'recipes', label: 'Recipes', icon: 'recipes', color: 'var(--tangerine)' },
  { id: 'todos', label: 'To-dos', icon: 'todos', color: 'var(--teal)' },
  { id: 'profiles', label: 'Family', icon: 'profiles', color: 'var(--rose)' },
]

export function Nav({ active, onChange }: { active: string; onChange: (id: string) => void }) {
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
      </LayoutGroup>
    </nav>
  )
}
