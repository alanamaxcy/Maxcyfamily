/**
 * A kid's own page: what they owe today, what they've earned, and what they can
 * spend it on. Designed to be usable by someone who can't read much yet —
 * emoji lead every row, targets are large, and finishing anything is loud.
 */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ID, Redemption, Reward } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { minutesOfDayInTimezone } from '@shared/date.ts'
import {
  blocksForDate,
  choresForPerson,
  familyChores,
  formatClockTime,
  isChoreDone,
  isStepDone,
  minutesOfDay,
  progressFor,
  routineProgress,
  routinesForPerson,
  streakFor,
} from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { useNow } from '../lib/hooks.ts'
import { Avatar, Check, CountUp, Empty, IconButton, ProgressRing, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Dialog } from '../components/Sheet.tsx'

export function PersonView({ personId, onBack }: { personId: ID; onBack: () => void }) {
  const { state, today, dispatch, celebrate, toast } = useApp()
  const now = useNow('minute')
  // Household timezone, not the device's — see the note in TodayView.
  const nowMinutes = minutesOfDayInTimezone(now.toISOString(), state.core.settings.timezone)

  const [redeeming, setRedeeming] = useState<Reward | null>(null)

  const person = state.core.people.find((entry) => entry.id === personId)

  const routines = useMemo(
    () => (person ? routinesForPerson(state.core, person.id, today) : []),
    [state.core, person, today],
  )
  const chores = useMemo(
    () => (person ? [...choresForPerson(state.core, person.id, today), ...familyChores(state.core, today)] : []),
    [state.core, person, today],
  )
  const blocks = useMemo(
    () => (person ? blocksForDate(state.core, today, person.id) : []),
    [state.core, person, today],
  )

  if (!person) {
    return <Empty emoji="🤷" title="That profile is gone" action={<button className="btn btn-soft" onClick={onBack}>Go back</button>} />
  }

  const progress = progressFor(state, person.id, today)
  const streak = streakFor(state, person.id, today)
  const allDone = progress.total > 0 && progress.done >= progress.total

  const rewards = state.core.rewards.filter((reward) => !reward.archived).sort((a, b) => a.cost - b.cost)

  const routineEmojiFor = (routineId: ID): string =>
    state.core.routines.find((entry) => entry.id === routineId)?.emoji ?? '🎉'

  const toggleChore = (
    choreId: ID,
    points: number,
    title: string,
    emoji: string,
    done: boolean,
    at: { x: number; y: number },
  ) => {
    dispatch({
      t: 'chore.setDone',
      choreId,
      personId: person.id,
      date: today,
      done,
      at: new Date().toISOString(),
      entryId: newId('led'),
    })
    if (done) celebrate({ points, x: at.x, y: at.y, color: person.color, big: false, emoji })
    else toast(`Unchecked ${title}`)
  }

  const toggleStep = (
    routineId: ID,
    stepId: ID,
    emoji: string,
    done: boolean,
    at: { x: number; y: number },
    willFinish: boolean,
    bonus: number,
  ) => {
    dispatch({
      t: 'routine.setStepDone',
      routineId,
      stepId,
      personId: person.id,
      date: today,
      done,
      at: new Date().toISOString(),
      entryId: newId('led'),
    })
    if (done) {
      celebrate({
        points: willFinish ? bonus : 0,
        x: at.x,
        y: at.y,
        color: person.color,
        big: willFinish,
        // The last step of a routine sends up the routine's own icon.
        emoji: willFinish ? routineEmojiFor(routineId) : emoji,
      })
    }
  }


  const redeem = (reward: Reward) => {
    if (person.points < reward.cost) return
    const redemption: Redemption = {
      id: newId('rdm'),
      rewardId: reward.id,
      rewardTitle: reward.title,
      rewardEmoji: reward.emoji,
      personId: person.id,
      cost: reward.cost,
      status: 'pending',
      at: new Date().toISOString(),
    }
    dispatch({ t: 'reward.redeem', redemption, entryId: newId('led') })
    setRedeeming(null)
    toast(`${person.name} redeemed ${reward.title}`)
  }

  return (
    <div style={tint(person.color)}>
      <motion.div
        className="kid-hero"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="kid-hero-top">
          <IconButton icon="chevronLeft" label="Back to family" onClick={onBack} filled />
          <span className="spacer" />
          {allDone ? (
            <motion.span
              className="kid-done-badge"
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              🎉 All done!
            </motion.span>
          ) : null}
        </div>

        <div className="kid-hero-main">
          <ProgressRing ratio={progress.total === 0 ? 0 : progress.ratio} size={128} thickness={7} color={person.color}>
            <Avatar person={person} size={104} />
          </ProgressRing>

          <div style={{ minWidth: 0 }}>
            <h1 className="display truncate">{person.name}</h1>
            <div className="kid-stats">
              <span className="kid-stat">
                <Icon name="star" size={19} />
                <strong><CountUp value={person.points} /></strong> points
              </span>
              {streak > 1 ? (
                <span className="kid-stat">
                  <Icon name="flame" size={19} />
                  <strong>{streak}</strong> day streak
                </span>
              ) : null}
              {progress.total > 0 ? (
                <span className="kid-stat">
                  <Icon name="check" size={19} />
                  <strong>{progress.done}</strong>/{progress.total} today
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>

      {blocks.length > 0 ? (
        <section className="kid-section">
          <div className="section-head">
            <span className="eyebrow">Their day</span>
          </div>
          <div className="kid-blocks">
            {blocks.map((block) => {
              const active = nowMinutes >= minutesOfDay(block.startTime) && nowMinutes < minutesOfDay(block.endTime)
              return (
                <div key={block.id} className={`kid-block${active ? ' on' : ''}`} style={tint(block.color)}>
                  <span className="kid-block-emoji">{block.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="h3 truncate">{block.title}</div>
                    <div className="tiny numeral">{formatClockTime(block.startTime)}</div>
                  </div>
                  {active ? <span className="tl-badge">NOW</span> : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {routines.map((routine) => {
        const routineDone = routineProgress(state, routine, person.id, today)
        return (
          <section className="kid-section" key={routine.id}>
            <div className="section-head">
              <div className="row" style={{ gap: 10 }}>
                <span style={{ fontSize: 26 }}>{routine.emoji}</span>
                <div>
                  <h2 className="h2">{routine.name}</h2>
                  <span className="small">
                    {routineDone.done} of {routineDone.total}
                    {routine.points > 0 ? ` · ${routine.points} point bonus` : ''}
                  </span>
                </div>
              </div>
              <ProgressRing ratio={routineDone.ratio} size={44} thickness={5} color={person.color} />
            </div>

            <div className="task-list">
              {routine.steps.map((step, index) => {
                const done = isStepDone(state, routine.id, step.id, person.id, today)
                const willFinish = !done && routineDone.done + 1 >= routineDone.total
                return (
                  <motion.div
                    key={step.id}
                    className={`task-row${done ? ' done' : ''}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                    layout
                  >
                    <Check
                      checked={done}
                      color={person.color}
                      large
                      label={step.title}
                      onChange={(at) =>
                        toggleStep(routine.id, step.id, step.emoji, !done, at, willFinish, routine.points)
                      }
                    />
                    <span className="task-emoji">{step.emoji}</span>
                    <span className="task-title">{step.title}</span>
                    {step.minutes ? <span className="task-meta numeral">{step.minutes}m</span> : null}
                  </motion.div>
                )
              })}
            </div>
          </section>
        )
      })}

      {chores.length > 0 ? (
        <section className="kid-section">
          <div className="section-head">
            <h2 className="h2">Jobs</h2>
            <span className="small">
              {chores.filter((chore) => isChoreDone(state, chore.id, person.id, today)).length} of {chores.length}
            </span>
          </div>
          <div className="task-list">
            {chores.map((chore, index) => {
              const done = isChoreDone(state, chore.id, person.id, today)
              return (
                <motion.div
                  key={chore.id}
                  className={`task-row${done ? ' done' : ''}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                  layout
                >
                  <Check
                    checked={done}
                    color={person.color}
                    large
                    label={chore.title}
                    onChange={(at) => toggleChore(chore.id, chore.points, chore.title, chore.emoji, !done, at)}
                  />
                  <span className="task-emoji">{chore.emoji}</span>
                  <span className="task-title">{chore.title}</span>
                  {chore.points > 0 ? (
                    <span className="task-points numeral">
                      <Icon name="star" size={13} />
                      {chore.points}
                    </span>
                  ) : null}
                </motion.div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="kid-section">
        <div className="section-head">
          <h2 className="h2">Spend points</h2>
          <span className="small numeral">{person.points} available</span>
        </div>

        {rewards.length === 0 ? (
          <Empty emoji="🎁" title="No rewards set up yet" hint="Add some on the Rewards tab." />
        ) : (
          <div className="reward-rail">
            {rewards.map((reward) => {
              const affordable = person.points >= reward.cost
              const shortfall = reward.cost - person.points
              return (
                <motion.button
                  key={reward.id}
                  className={`reward-card${affordable ? ' can' : ''}`}
                  onClick={() => (affordable ? setRedeeming(reward) : toast(`${shortfall} more points to go!`))}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                  layout
                >
                  <span className="reward-emoji">{reward.emoji}</span>
                  <span className="reward-title clamp-2">{reward.title}</span>
                  <span className="reward-cost numeral">
                    <Icon name="star" size={13} />
                    {reward.cost}
                  </span>
                  {!affordable ? (
                    <span className="reward-lock">
                      <span className="reward-progress" style={{ width: `${Math.min(100, (person.points / reward.cost) * 100)}%` }} />
                    </span>
                  ) : null}
                </motion.button>
              )
            })}
          </div>
        )}
      </section>

      <Dialog open={redeeming !== null} onClose={() => setRedeeming(null)}>
        <AnimatePresence>
          {redeeming ? (
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 20 }}
            >
              <div style={{ fontSize: 68, lineHeight: 1 }}>{redeeming.emoji}</div>
              <h3 className="h1" style={{ marginTop: 14 }}>{redeeming.title}</h3>
              <p className="body" style={{ marginTop: 8 }}>
                This costs <strong>{redeeming.cost} points</strong>. {person.name} will have{' '}
                <strong>{person.points - redeeming.cost}</strong> left.
              </p>
              <div className="row" style={{ marginTop: 26, gap: 10 }}>
                <button className="btn btn-soft btn-block" onClick={() => setRedeeming(null)}>
                  Not yet
                </button>
                <button className="btn btn-accent btn-block" onClick={() => redeem(redeeming)}>
                  Redeem
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Dialog>
    </div>
  )
}
