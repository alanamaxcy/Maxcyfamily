/**
 * A kid's own page.
 *
 * Routines are the point of this screen: each one is a full card with its own
 * bonus, and finishing every step pays out. Jobs sit underneath as à la carte
 * extras — tap any of them, any time, for the points printed on the tile.
 *
 * Designed to be usable by someone who can't read much yet: emoji lead every
 * row, targets are large, and finishing anything is loud.
 */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ID, Redemption, Reward, Routine } from '@shared/types.ts'
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
import { Avatar, Check, CountUp, Empty, IconButton, ProgressRing, SPRING, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Dialog } from '../components/Sheet.tsx'
import { ParentView } from './ParentView.tsx'

const TIME_ORDER: Record<Routine['timeOfDay'], number> = { morning: 0, afternoon: 1, evening: 2 }

export function PersonView({ personId, onBack }: { personId: ID; onBack: () => void }) {
  const { state, today, dispatch, celebrate, toast } = useApp()
  const now = useNow('minute')
  // Household timezone, not the device's — see the note in TodayView.
  const nowMinutes = minutesOfDayInTimezone(now.toISOString(), state.core.settings.timezone)

  const [redeeming, setRedeeming] = useState<Reward | null>(null)

  const person = state.core.people.find((entry) => entry.id === personId)

  const routines = useMemo(() => {
    if (!person) return []
    return routinesForPerson(state.core, person.id, today).sort(
      (a, b) => TIME_ORDER[a.timeOfDay] - TIME_ORDER[b.timeOfDay],
    )
  }, [state.core, person, today])

  const jobs = useMemo(
    () => (person ? [...choresForPerson(state.core, person.id, today), ...familyChores(state.core, today)] : []),
    [state.core, person, today],
  )
  const blocks = useMemo(
    () => (person ? blocksForDate(state.core, today, person.id) : []),
    [state.core, person, today],
  )

  if (!person) {
    return (
      <Empty
        emoji="🤷"
        title="That profile is gone"
        action={<button className="btn btn-soft" onClick={onBack}>Go back</button>}
      />
    )
  }

  // Grown-ups get a different page entirely — schedule, tasks and what's
  // coming, with no routines, points or rewards.
  if (person.role === 'parent') return <ParentView person={person} onBack={onBack} />

  const progress = progressFor(state, person.id, today)
  const streak = streakFor(state, person.id, today)
  const allDone = progress.total > 0 && progress.done >= progress.total

  const rewards = state.core.rewards.filter((reward) => !reward.archived).sort((a, b) => a.cost - b.cost)

  const toggleJob = (
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
    routine: Routine,
    stepId: ID,
    emoji: string,
    done: boolean,
    at: { x: number; y: number },
    willFinish: boolean,
  ) => {
    dispatch({
      t: 'routine.setStepDone',
      routineId: routine.id,
      stepId,
      personId: person.id,
      date: today,
      done,
      at: new Date().toISOString(),
      entryId: newId('led'),
    })
    if (done) {
      celebrate({
        // Steps themselves pay nothing; the whole routine is what earns.
        points: willFinish ? routine.points : 0,
        x: at.x,
        y: at.y,
        color: person.color,
        big: willFinish,
        emoji: willFinish ? routine.emoji : emoji,
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
      {/* ---------------------------------------------------------- */}
      {/* Hero                                                        */}
      {/* ---------------------------------------------------------- */}
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
          <ProgressRing
            ratio={progress.total === 0 ? 0 : progress.ratio}
            size={128}
            thickness={7}
            color={person.color}
          >
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
            </div>
          </div>
        </div>
      </motion.div>

      {/* ---------------------------------------------------------- */}
      {/* Routines — the focus of this screen                         */}
      {/* ---------------------------------------------------------- */}
      {routines.length === 0 ? (
        <Empty
          emoji="🌅"
          title="No routines yet"
          hint="Routines are the checklists that repeat every day — morning and bedtime. Add them on the Routines tab."
        />
      ) : (
        routines.map((routine, routineIndex) => {
          const done = routineProgress(state, routine, person.id, today)
          const complete = done.total > 0 && done.done >= done.total

          return (
            <motion.section
              key={routine.id}
              className={`routine-card${complete ? ' complete' : ''}`}
              style={tint(person.color)}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: routineIndex * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <header className="routine-head">
                <span className="routine-emoji">{routine.emoji}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 className="routine-name truncate">{routine.name}</h2>
                  <AnimatePresence mode="wait" initial={false}>
                    {complete ? (
                      <motion.p
                        key="done"
                        className="routine-bonus earned"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.28 }}
                      >
                        🎉 {routine.points} points earned!
                      </motion.p>
                    ) : (
                      <motion.p
                        key="todo"
                        className="routine-bonus"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.28 }}
                      >
                        Finish all {done.total} to earn{' '}
                        <strong>{routine.points} points</strong>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="routine-count numeral">
                  <span className="routine-count-done">{done.done}</span>
                  <span className="routine-count-total">/{done.total}</span>
                </div>
              </header>

              <div className="routine-bar">
                <motion.span
                  className="routine-bar-fill"
                  initial={false}
                  animate={{ width: `${Math.round(done.ratio * 100)}%` }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              <div className="routine-steps">
                {routine.steps.map((step, index) => {
                  const stepDone = isStepDone(state, routine.id, step.id, person.id, today)
                  const willFinish = !stepDone && done.done + 1 >= done.total

                  return (
                    <motion.div
                      key={step.id}
                      className={`step-item${stepDone ? ' done' : ''}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                      layout
                    >
                      <Check
                        checked={stepDone}
                        color={person.color}
                        large
                        label={step.title}
                        onChange={(at) => toggleStep(routine, step.id, step.emoji, !stepDone, at, willFinish)}
                      />
                      <span className="step-emoji">{step.emoji}</span>
                      <span className="step-title">{step.title}</span>
                      {step.minutes ? <span className="step-mins numeral">{step.minutes}m</span> : null}
                    </motion.div>
                  )
                })}
              </div>
            </motion.section>
          )
        })
      )}

      {/* ---------------------------------------------------------- */}
      {/* Jobs — à la carte extras                                    */}
      {/* ---------------------------------------------------------- */}
      {jobs.length > 0 ? (
        <section className="kid-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Extra jobs</span>
              <h2 className="h2">Earn bonus points</h2>
            </div>
            <span className="small numeral">
              {jobs.filter((job) => isChoreDone(state, job.id, person.id, today)).length} of {jobs.length}
            </span>
          </div>

          <div className="jobs-grid">
            {jobs.map((job, index) => {
              const jobDone = isChoreDone(state, job.id, person.id, today)

              return (
                <motion.button
                  key={job.id}
                  className={`job-card${jobDone ? ' done' : ''}`}
                  style={tint(person.color)}
                  onClick={(event) => {
                    const box = event.currentTarget.getBoundingClientRect()
                    toggleJob(job.id, job.points, job.title, job.emoji, !jobDone, {
                      x: box.left + box.width / 2,
                      y: box.top + box.height / 2,
                    })
                  }}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  whileTap={{ scale: 0.95 }}
                  layout
                  aria-pressed={jobDone}
                >
                  <span className="job-emoji">{job.emoji}</span>
                  <span className="job-title clamp-2">{job.title}</span>
                  <span className="job-points numeral">
                    <Icon name="star" size={13} /> {job.points}
                  </span>

                  <motion.span
                    className="job-tick"
                    initial={false}
                    animate={jobDone ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
                    transition={SPRING}
                    aria-hidden="true"
                  >
                    <Icon name="check" size={16} strokeWidth={3.6} />
                  </motion.span>
                </motion.button>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- */}
      {/* Rewards                                                     */}
      {/* ---------------------------------------------------------- */}
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
                  transition={SPRING}
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
                      <span
                        className="reward-progress"
                        style={{ width: `${Math.min(100, (person.points / reward.cost) * 100)}%` }}
                      />
                    </span>
                  ) : null}
                </motion.button>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Their day                                                   */}
      {/* ---------------------------------------------------------- */}
      {blocks.length > 0 ? (
        <section className="kid-section">
          <div className="section-head">
            <span className="eyebrow">Their day</span>
          </div>
          <div className="kid-blocks">
            {blocks.map((block) => {
              const active =
                nowMinutes >= minutesOfDay(block.startTime) && nowMinutes < minutesOfDay(block.endTime)

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
