/**
 * Everything that isn't Home, Schedule, Menu or To-dos.
 *
 * Four tabs plus this keeps the bar readable on a phone; the rest are things
 * you set up occasionally rather than tap all day.
 */

import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { Sheet } from './Sheet.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { SPRING } from './ui.tsx'

export interface MoreItem {
  id: string
  label: string
  hint: string
  icon: IconName
  color: string
}

export const MORE_ITEMS: MoreItem[] = [
  { id: 'routines', label: 'Routines', hint: 'Checklists, chores and the day’s blocks', icon: 'routines', color: 'var(--violet)' },
  { id: 'rewards', label: 'Rewards', hint: 'Points, prizes and the undo log', icon: 'rewards', color: 'var(--amber)' },
  { id: 'recipes', label: 'Recipes', hint: 'The vault, scaling and imports', icon: 'recipes', color: 'var(--tangerine)' },
  { id: 'profiles', label: 'Family', hint: 'Add and edit everyone', icon: 'profiles', color: 'var(--rose)' },
  { id: 'weather', label: 'Weather', hint: 'Hourly and the week ahead', icon: 'weather', color: 'var(--cobalt)' },
]

export function MoreMenu({
  open,
  onClose,
  onNavigate,
  onOpenSettings,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (id: string) => void
  onOpenSettings: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="More" subtitle="Everything else">
      <div className="more-grid">
        {MORE_ITEMS.map((item, index) => (
          <motion.button
            key={item.id}
            className="more-tile"
            style={{ '--tint': item.color } as CSSProperties}
            onClick={() => {
              onNavigate(item.id)
              onClose()
            }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            whileTap={{ scale: 0.96 }}
          >
            <span className="more-icon">
              <Icon name={item.icon} size={24} />
            </span>
            <span className="more-label">{item.label}</span>
            <span className="more-hint">{item.hint}</span>
          </motion.button>
        ))}
      </div>

      <motion.button
        className="more-settings"
        onClick={() => {
          onClose()
          onOpenSettings()
        }}
        whileTap={{ scale: 0.98 }}
        transition={SPRING}
      >
        <Icon name="settings" size={20} />
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span className="more-label">Settings</span>
          <span className="more-hint">Calendars, weather, sleep screen, backup</span>
        </span>
        <Icon name="chevronRight" size={18} />
      </motion.button>
    </Sheet>
  )
}
