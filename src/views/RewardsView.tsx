/**
 * Points, the reward catalogue, and the undo log.
 *
 * Points land the moment a kid ticks something, so this screen is where a
 * grown-up puts things right: every entry can be undone, which reverses the
 * balance and un-ticks the chore it came from.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Reward } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { allRedemptions, recentLedger } from '@shared/schedule.ts'
import { formatDayLabel } from '@shared/date.ts'
import { useApp } from '../lib/store.tsx'
import { Avatar, CountUp, Empty, Field, Segmented, SPRING, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet, ConfirmDialog } from '../components/Sheet.tsx'
import { ColorPicker, DangerRow, EmojiPicker, Stepper } from './editors/parts.tsx'

type Tab = 'catalog' | 'pending' | 'log'

export function RewardsView() {
  const { state, today, dispatch, toast } = useApp()
  const [tab, setTab] = useState<Tab>('catalog')
  const [editing, setEditing] = useState<Reward | 'new' | null>(null)

  const people = state.core.people.filter((person) => !person.archived).sort((a, b) => a.sort - b.sort)
  const rewards = [...state.core.rewards].filter((reward) => !reward.archived).sort((a, b) => a.sort - b.sort)
  const redemptions = allRedemptions(state)
  const pending = redemptions.filter((entry) => entry.status === 'pending')
  const ledger = recentLedger(state, 60)

  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Rewards</span>
          <h1 className="h1">Points &amp; prizes</h1>
        </div>
        <button className="btn btn-accent btn-sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={17} /> Reward
        </button>
      </div>

      {people.length > 0 ? (
        <div className="balance-rail">
          {people.map((person, index) => (
            <motion.div
              key={person.id}
              className="balance-card"
              style={tint(person.color)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Avatar person={person} size={44} />
              <span className="balance-name truncate">{person.name}</span>
              <span className="balance-points numeral">
                <CountUp value={person.points} />
              </span>
            </motion.div>
          ))}
        </div>
      ) : null}

      <div style={{ margin: '20px 0 16px' }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'catalog', label: 'Catalogue' },
            { value: 'pending', label: pending.length ? `To give (${pending.length})` : 'To give' },
            { value: 'log', label: 'History' },
          ]}
        />
      </div>

      {tab === 'catalog' ? (
        rewards.length === 0 ? (
          <Empty
            emoji="🎁"
            title="No rewards yet"
            hint="Add the things your kids are actually working towards."
            action={
              <button className="btn btn-accent" onClick={() => setEditing('new')}>
                <Icon name="plus" size={18} /> Add a reward
              </button>
            }
          />
        ) : (
          <div className="reward-grid">
            {rewards.map((reward, index) => (
              <motion.button
                key={reward.id}
                className="reward-tile"
                onClick={() => setEditing(reward)}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                whileTap={{ scale: 0.96 }}
                layout
              >
                <span className="reward-tile-emoji">{reward.emoji}</span>
                <span className="reward-tile-title clamp-2">{reward.title}</span>
                <span className="reward-tile-cost numeral">
                  <Icon name="star" size={13} /> {reward.cost}
                </span>
                <span className="reward-tile-edit">
                  <Icon name="edit" size={15} />
                </span>
              </motion.button>
            ))}
          </div>
        )
      ) : null}

      {tab === 'pending' ? (
        pending.length === 0 ? (
          <Empty emoji="✅" title="Nothing waiting" hint="Redeemed rewards show up here until you mark them given." />
        ) : (
          <div className="stack">
            <AnimatePresence initial={false}>
              {pending.map((redemption) => {
                const person = state.core.people.find((entry) => entry.id === redemption.personId)
                return (
                  <motion.div
                    key={redemption.id}
                    className="card row"
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={SPRING}
                  >
                    <span style={{ fontSize: 34 }}>{redemption.rewardEmoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="h3 truncate">{redemption.rewardTitle}</div>
                      <div className="small">
                        {person?.name ?? 'Someone'} · {formatDayLabel(redemption.at.slice(0, 10), today)} ·{' '}
                        {redemption.cost} pts
                      </div>
                    </div>
                    <button
                      className="btn btn-soft btn-sm"
                      onClick={() => {
                        dispatch({ t: 'redemption.setStatus', id: redemption.id, status: 'cancelled', at: new Date().toISOString() })
                        toast(`Refunded ${redemption.cost} points`)
                      }}
                    >
                      Refund
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        dispatch({ t: 'redemption.setStatus', id: redemption.id, status: 'fulfilled', at: new Date().toISOString() })
                      }
                    >
                      Given
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )
      ) : null}

      {tab === 'log' ? (
        ledger.length === 0 ? (
          <Empty emoji="📜" title="No points yet" hint="Every point earned or spent shows up here." />
        ) : (
          <div className="card" style={{ padding: 6 }}>
            <AnimatePresence initial={false}>
              {ledger.map((entry) => {
                const person = state.core.people.find((candidate) => candidate.id === entry.personId)
                return (
                  <motion.div
                    key={entry.id}
                    className={`log-row${entry.voided ? ' voided' : ''}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {person ? <Avatar person={person} size={32} /> : <span style={{ width: 32 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 600 }}>{entry.reason}</div>
                      <div className="tiny">
                        {person?.name ?? 'Unknown'} · {formatDayLabel(entry.at.slice(0, 10), today)}
                      </div>
                    </div>
                    <span className={`log-delta numeral${entry.delta > 0 ? ' up' : ' down'}`}>
                      {entry.delta > 0 ? '+' : ''}
                      {entry.delta}
                    </span>
                    {entry.voided ? (
                      <span className="tiny" style={{ width: 56, textAlign: 'right' }}>undone</span>
                    ) : (
                      <button
                        className="icon-btn"
                        aria-label="Undo"
                        title="Undo"
                        onClick={() => {
                          dispatch({ t: 'ledger.void', id: entry.id })
                          toast(`Undid ${entry.reason}`)
                        }}
                      >
                        <Icon name="undo" size={17} />
                      </button>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )
      ) : null}

      <RewardEditor
        reward={editing}
        onClose={() => setEditing(null)}
        onSave={(reward) => dispatch({ t: 'reward.upsert', reward })}
        onDelete={(id) => dispatch({ t: 'reward.remove', id })}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function RewardEditor({
  reward,
  onClose,
  onSave,
  onDelete,
}: {
  reward: Reward | 'new' | null
  onClose: () => void
  onSave: (reward: Reward) => void
  onDelete: (id: string) => void
}) {
  const { state } = useApp()
  const [draft, setDraft] = useState<Reward>(() => blankReward(state.core.rewards.length))
  const [confirming, setConfirming] = useState(false)

  const key = reward === 'new' ? 'new' : (reward?.id ?? '')
  const [seededFor, setSeededFor] = useState<string | null>(null)
  if (reward && seededFor !== key) {
    setSeededFor(key)
    setDraft(reward === 'new' ? blankReward(state.core.rewards.length) : structuredClone(reward))
  }

  const patch = (changes: Partial<Reward>) => setDraft((current) => ({ ...current, ...changes }))
  const valid = draft.title.trim().length > 0

  return (
    <>
      <Sheet
        open={reward !== null}
        onClose={onClose}
        title={reward === 'new' ? 'New reward' : 'Edit reward'}
        footer={
          <>
            <button className="btn btn-soft btn-block" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-block"
              disabled={!valid}
              onClick={() => {
                if (!valid) return
                onSave({ ...draft, title: draft.title.trim() })
                onClose()
              }}
            >
              Save
            </button>
          </>
        }
      >
        <Field label="Reward">
          <input
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="Movie night, ice cream, stay up late…"
            autoFocus
          />
        </Field>

        <Field label="Cost in points">
          <Stepper value={draft.cost} onChange={(cost) => patch({ cost })} step={5} min={0} max={5000} />
        </Field>

        <Field label="Icon">
          <EmojiPicker value={draft.emoji} onChange={(emoji) => patch({ emoji })} />
        </Field>

        <Field label="Description" hint="Optional detail shown when they tap it.">
          <textarea
            value={draft.description ?? ''}
            onChange={(event) => patch({ description: event.target.value })}
            placeholder="Optional"
          />
        </Field>

        {reward !== 'new' && reward ? (
          <DangerRow label="Delete this reward" onClick={() => setConfirming(true)} />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title="Delete this reward?"
        message="Past redemptions stay in the history."
        onConfirm={() => {
          if (reward && reward !== 'new') onDelete(reward.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}

function blankReward(sort: number): Reward {
  return { id: newId('rw'), title: '', emoji: '🎁', cost: 50, sort }
}

export { ColorPicker }
