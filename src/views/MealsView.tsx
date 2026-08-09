/** The week's menu and the shopping list it feeds. */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Meal, MealRule, MealSlot, ShoppingItem } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { CATEGORY_META, CATEGORY_ORDER, guessCategory, splitQuantity } from '@shared/categorize.ts'
import { DAY_SHORT, addDays, formatDayLabel, parseISODate, startOfWeek, weekDates } from '@shared/date.ts'
import { ingredientNames, type Recipe } from '@shared/recipes.ts'
import { resolveDayMeals, resolveMeal, scheduleSummary } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { Avatar, Empty, Field, Segmented, SPRING, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet, ConfirmDialog } from '../components/Sheet.tsx'
import { DangerRow, EmojiPicker, SchedulePicker } from './editors/parts.tsx'

const SLOTS: { id: MealSlot; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { id: 'lunch', label: 'Lunch', emoji: '🥪' },
  { id: 'dinner', label: 'Dinner', emoji: '🍽️' },
]

export function MealsView() {
  const { state, today, dispatch, toast } = useApp()
  const [tab, setTab] = useState<'menu' | 'shopping'>('menu')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, state.core.settings.weekStartsOn))
  const [editing, setEditing] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [managingRules, setManagingRules] = useState(false)
  const [editingRule, setEditingRule] = useState<MealRule | 'new' | null>(null)

  const dates = useMemo(
    () => weekDates(weekStart, state.core.settings.weekStartsOn),
    [weekStart, state.core.settings.weekStartsOn],
  )

  const addToShopping = (names: string[], from: string) => {
    const existing = new Set(state.core.shopping.map((item) => item.text.toLowerCase()))
    const ops = names
      .filter((name) => name && !existing.has(name.toLowerCase()))
      .map((name) => {
        const { qty, text } = splitQuantity(name)
        const item: ShoppingItem = {
          id: newId('sh'),
          text,
          ...(qty ? { qty } : {}),
          category: guessCategory(text),
          done: false,
          fromMeal: from,
          createdAt: new Date().toISOString(),
        }
        return { t: 'shopping.upsert' as const, item }
      })

    if (ops.length === 0) {
      toast('Everything is already on the list')
      return
    }
    dispatch(ops)
    toast(`Added ${ops.length} item${ops.length === 1 ? '' : 's'} to shopping`)
  }

  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Kitchen</span>
          <h1 className="h1">{tab === 'menu' ? 'This week' : 'Shopping list'}</h1>
        </div>
        {tab === 'menu' ? (
          <div className="row" style={{ gap: 4 }}>
            <button className="btn btn-soft btn-sm" onClick={() => setManagingRules(true)}>
              <Icon name="refresh" size={15} /> Repeats
            </button>
            <button className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
              <Icon name="chevronLeft" size={20} />
            </button>
            <button
              className="btn btn-soft btn-sm"
              onClick={() => setWeekStart(startOfWeek(today, state.core.settings.weekStartsOn))}
            >
              This week
            </button>
            <button className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
              <Icon name="chevronRight" size={20} />
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ marginBottom: 18 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'menu', label: 'Menu' },
            {
              value: 'shopping',
              label: state.core.shopping.filter((item) => !item.done).length
                ? `Shopping (${state.core.shopping.filter((item) => !item.done).length})`
                : 'Shopping',
            },
          ]}
        />
      </div>

      {tab === 'menu' ? (
        <div className="stack">
          {dates.map((date, index) => {
            const resolved = resolveDayMeals(state.core, date)
            const isToday = date === today

            return (
              <motion.div
                key={date}
                className={`card meal-day${isToday ? ' today' : ''}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="row-between" style={{ marginBottom: 12 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="meal-daynum numeral">{parseISODate(date).getDate()}</span>
                    <div>
                      <div className="h3">{DAY_SHORT[parseISODate(date).getDay()]}</div>
                      <div className="tiny">{formatDayLabel(date, today)}</div>
                    </div>
                  </div>
                </div>

                <div className="meal-slots">
                  {SLOTS.map((slot) => {
                    const entry = resolved[slot.id]
                    const meal = entry?.meal
                    return (
                      <motion.button
                        key={slot.id}
                        className={`meal-slot${meal ? ' filled' : ''}`}
                        onClick={() => setEditing({ date, slot: slot.id })}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING}
                      >
                        <span className="meal-slot-label">
                          {slot.emoji} {slot.label}
                        </span>
                        {meal ? (
                          <>
                            <span className="meal-slot-title clamp-2">
                              {meal.emoji ? `${meal.emoji} ` : ''}
                              {meal.title}
                            </span>
                            {entry?.ruleId ? (
                              <span className="meal-repeat" title="Repeats on a schedule">
                                <Icon name="refresh" size={12} /> repeats
                              </span>
                            ) : null}
                            {meal.cookId ? (
                              <span className="meal-cook">
                                {(() => {
                                  const cook = state.core.people.find((person) => person.id === meal.cookId)
                                  return cook ? <Avatar person={cook} size={20} /> : null
                                })()}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="meal-slot-empty">
                            <Icon name="plus" size={16} />
                          </span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <ShoppingList />
      )}

      <MealEditor
        target={editing}
        onClose={() => setEditing(null)}
        onAddIngredients={addToShopping}
        onRepeat={(meal, slot) => {
          setEditing(null)
          setEditingRule({
            id: newId('mr'),
            slot,
            meal,
            schedule: { type: 'weeklyN', days: [parseISODate(today).getDay()], everyWeeks: 2, startDate: today },
          })
        }}
      />

      <Sheet
        open={managingRules}
        onClose={() => setManagingRules(false)}
        title="Repeating meals"
        subtitle="Meals that come back on their own"
        footer={
          <button
            className="btn btn-primary btn-block"
            onClick={() =>
              setEditingRule({
                id: newId('mr'),
                slot: 'dinner',
                meal: { title: '', emoji: '🍽️' },
                schedule: { type: 'weeklyN', days: [1], everyWeeks: 2, startDate: today },
              })
            }
          >
            <Icon name="plus" size={17} /> New repeating meal
          </button>
        }
      >
        {state.core.mealRules.length === 0 ? (
          <Empty
            emoji="🔁"
            title="Nothing repeats yet"
            hint="Set up the meals that come round on a cycle — taco Tuesday, spaghetti every other Monday."
          />
        ) : (
          <div className="card" style={{ padding: 6 }}>
            {state.core.mealRules.map((rule) => (
              <button key={rule.id} className="manage-row" onClick={() => setEditingRule(rule)}>
                <span className="manage-emoji">{rule.meal.emoji ?? '🍽️'}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div className="truncate" style={{ fontWeight: 600 }}>{rule.meal.title}</div>
                  <div className="tiny">
                    {SLOTS.find((slot) => slot.id === rule.slot)?.label} · {scheduleSummary(rule.schedule)}
                  </div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <MealRuleEditor
        rule={editingRule}
        onClose={() => setEditingRule(null)}
        onSave={(rule) => dispatch({ t: 'mealRule.upsert', rule })}
        onDelete={(id) => dispatch({ t: 'mealRule.remove', id })}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function MealRuleEditor({
  rule,
  onClose,
  onSave,
  onDelete,
}: {
  rule: MealRule | 'new' | null
  onClose: () => void
  onSave: (rule: MealRule) => void
  onDelete: (id: string) => void
}) {
  const { state, today } = useApp()
  const [draft, setDraft] = useState<MealRule | null>(null)
  const [seeded, setSeeded] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const key = rule === 'new' ? 'new' : (rule?.id ?? '')
  if (rule && seeded !== key) {
    setSeeded(key)
    setDraft(rule === 'new' ? null : structuredClone(rule))
  }

  const patchMeal = (changes: Partial<Meal>) =>
    setDraft((current) => (current ? { ...current, meal: { ...current.meal, ...changes } } : current))

  if (!draft) return null

  return (
    <>
      <Sheet
        open={rule !== null}
        onClose={onClose}
        title="Repeating meal"
        subtitle="It fills itself in on the days you choose"
        footer={
          <>
            <button className="btn btn-soft btn-block" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-block"
              disabled={!draft.meal.title.trim()}
              onClick={() => {
                onSave({ ...draft, meal: { ...draft.meal, title: draft.meal.title.trim() } })
                onClose()
              }}
            >
              Save
            </button>
          </>
        }
      >
        <Field label="What are we eating?">
          <input
            value={draft.meal.title}
            onChange={(event) => patchMeal({ title: event.target.value })}
            placeholder="Spaghetti"
            autoFocus
          />
        </Field>

        <Field label="Which meal?">
          <div className="row" style={{ gap: 8 }}>
            {SLOTS.map((slot) => (
              <button
                key={slot.id}
                className={`chip${draft.slot === slot.id ? ' chip-on' : ''}`}
                style={{ flex: 1, justifyContent: 'center', height: 44 }}
                onClick={() => setDraft({ ...draft, slot: slot.id })}
              >
                {slot.emoji} {slot.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Icon">
          <EmojiPicker value={draft.meal.emoji ?? '🍽️'} onChange={(emoji) => patchMeal({ emoji })} />
        </Field>

        <Field label="How often?" hint="Pick 'Every other week' for things like spaghetti every second Monday.">
          <SchedulePicker
            value={draft.schedule}
            onChange={(schedule) => setDraft({ ...draft, schedule })}
            today={today}
          />
        </Field>

        <Field label="Who cooks?">
          <div className="row wrap" style={{ gap: 8 }}>
            <button
              className={`person-pill${!draft.meal.cookId ? ' on' : ''}`}
              onClick={() => patchMeal({ cookId: undefined })}
            >
              <span className="person-pill-all">🤷</span> Nobody yet
            </button>
            {state.core.people
              .filter((person) => !person.archived)
              .map((person) => (
                <button
                  key={person.id}
                  className={`person-pill${draft.meal.cookId === person.id ? ' on' : ''}`}
                  style={tint(person.color)}
                  onClick={() => patchMeal({ cookId: person.id })}
                >
                  <Avatar person={person} size={26} />
                  {person.name}
                </button>
              ))}
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            value={draft.meal.notes ?? ''}
            onChange={(event) => patchMeal({ notes: event.target.value })}
            placeholder="Sides, timing, anything to remember"
          />
        </Field>

        {rule !== 'new' && rule ? (
          <DangerRow label="Stop repeating this meal" onClick={() => setConfirming(true)} />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title="Stop repeating?"
        message="Days where you already pinned this meal keep it."
        confirmLabel="Stop repeating"
        onConfirm={() => {
          if (rule && rule !== 'new') onDelete(rule.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function ShoppingList() {
  const { state, dispatch } = useApp()
  const [text, setText] = useState('')

  const items = state.core.shopping
  const outstanding = items.filter((item) => !item.done)
  const done = items.filter((item) => item.done)

  const add = () => {
    const value = text.trim()
    if (!value) return
    // Splitting on commas lets someone dictate a whole list in one go.
    const parts = value.split(/\s*,\s*/).filter(Boolean)
    dispatch(
      parts.map((part) => {
        const { qty, text: name } = splitQuantity(part)
        return {
          t: 'shopping.upsert' as const,
          item: {
            id: newId('sh'),
            text: name,
            ...(qty ? { qty } : {}),
            category: guessCategory(name),
            done: false,
            createdAt: new Date().toISOString(),
          } satisfies ShoppingItem,
        }
      }),
    )
    setText('')
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: outstanding.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      <div className="add-bar">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add()
          }}
          placeholder="Add milk, eggs, 2 lbs chicken…"
          enterKeyHint="done"
          aria-label="Add shopping item"
        />
        <motion.button className="btn btn-accent" onClick={add} whileTap={{ scale: 0.94 }} disabled={!text.trim()}>
          <Icon name="plus" size={18} />
        </motion.button>
      </div>

      {items.length === 0 ? (
        <Empty emoji="🛒" title="The list is empty" hint="Add items here, or push a recipe's ingredients over from Recipes." />
      ) : (
        <div className="stack" style={{ marginTop: 18 }}>
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="eyebrow" style={{ margin: '4px 0 8px 2px' }}>
                {CATEGORY_META[group.category].emoji} {CATEGORY_META[group.category].label}
              </div>
              <div className="card" style={{ padding: 6 }}>
                <AnimatePresence initial={false}>
                  {group.items.map((item) => (
                    <ShoppingRow key={item.id} item={item} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}

          {done.length > 0 ? (
            <div>
              <div className="row-between" style={{ margin: '10px 2px 8px' }}>
                <span className="eyebrow">In the cart ({done.length})</span>
                <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ t: 'shopping.clearDone' })}>
                  Clear
                </button>
              </div>
              <div className="card" style={{ padding: 6, opacity: 0.65 }}>
                <AnimatePresence initial={false}>
                  {done.map((item) => (
                    <ShoppingRow key={item.id} item={item} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}

function ShoppingRow({ item }: { item: ShoppingItem }) {
  const { dispatch, celebrate } = useApp()

  return (
    <motion.div
      className={`shop-row${item.done ? ' done' : ''}`}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30, height: 0 }}
      transition={SPRING}
    >
      <button
        className={`check${item.done ? ' check-on' : ''}`}
        style={{ '--tint': 'var(--forest)' } as React.CSSProperties}
        onClick={(event) => {
          const done = !item.done
          dispatch({ t: 'shopping.setDone', id: item.id, done })
          if (done) {
            const box = event.currentTarget.getBoundingClientRect()
            celebrate({
              points: 0,
              x: box.left + box.width / 2,
              y: box.top + box.height / 2,
              color: 'var(--forest)',
              big: false,
              emoji: CATEGORY_META[item.category].emoji,
            })
          }
        }}
        aria-label={item.done ? `Un-check ${item.text}` : `Check off ${item.text}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 9.5 17 19 7.5" />
        </svg>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="shop-text">
          {item.qty ? <strong className="numeral">{item.qty} </strong> : null}
          {item.text}
        </span>
        {item.fromMeal ? <div className="tiny truncate">from {item.fromMeal}</div> : null}
      </div>

      <button className="icon-btn" onClick={() => dispatch({ t: 'shopping.remove', id: item.id })} aria-label={`Remove ${item.text}`}>
        <Icon name="close" size={17} />
      </button>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */

function MealEditor({
  target,
  onClose,
  onAddIngredients,
  onRepeat,
}: {
  target: { date: string; slot: MealSlot } | null
  onClose: () => void
  onAddIngredients: (names: string[], from: string) => void
  onRepeat: (meal: Meal, slot: MealSlot) => void
}) {
  const { state, dispatch } = useApp()
  const [draft, setDraft] = useState<Meal>({ title: '' })
  const [seeded, setSeeded] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const key = target ? `${target.date}:${target.slot}` : ''
  const fromRule = target ? resolveMeal(state.core, target.date, target.slot)?.ruleId : undefined
  if (target && seeded !== key) {
    setSeeded(key)
    // Seed from whatever is showing, including a repeating meal, so editing
    // one day starts from the meal that is actually on the menu.
    setDraft(structuredClone(resolveMeal(state.core, target.date, target.slot)?.meal ?? { title: '' }))
  }

  const patch = (changes: Partial<Meal>) => setDraft((current) => ({ ...current, ...changes }))

  const applyRecipe = (recipe: Recipe) => {
    setDraft({
      title: recipe.title,
      emoji: recipe.cat === 'breakfast' ? '🍳' : recipe.cat === 'dessert' ? '🍰' : '🍽️',
      notes: recipe.description ?? '',
      ingredients: ingredientNames(recipe),
    })
    setPicking(false)
  }

  const save = () => {
    if (!target) return
    const title = draft.title.trim()
    dispatch({ t: 'meal.set', date: target.date, slot: target.slot, meal: title ? { ...draft, title } : null })
    onClose()
  }

  const slotMeta = SLOTS.find((slot) => slot.id === target?.slot)

  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={`${slotMeta?.emoji ?? ''} ${slotMeta?.label ?? 'Meal'}`}
      subtitle={target ? formatDayLabel(target.date, target.date) : undefined}
      footer={
        <>
          <button
            className="btn btn-soft btn-block"
            onClick={() => {
              if (!target) return
              dispatch({ t: 'meal.set', date: target.date, slot: target.slot, meal: null })
              onClose()
            }}
          >
            Clear
          </button>
          <button className="btn btn-primary btn-block" onClick={save}>Save</button>
        </>
      }
    >
      {picking ? (
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => setPicking(false)} style={{ marginBottom: 12 }}>
            <Icon name="chevronLeft" size={16} /> Back
          </button>
          <div className="stack">
            {state.core.recipes.map((recipe) => (
              <button key={recipe.id} className="manage-row" onClick={() => applyRecipe(recipe)}>
                <span className="manage-emoji">🍽️</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div className="truncate" style={{ fontWeight: 600 }}>{recipe.title}</div>
                  <div className="tiny truncate">{recipe.cat}</div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button className="btn btn-soft btn-block" onClick={() => setPicking(true)} style={{ marginBottom: 18 }}>
            <Icon name="recipes" size={18} /> Pick from the recipe vault
          </button>

          <Field label="What are we eating?">
            <input
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="Tacos, leftovers, pizza night…"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Enter') save()
              }}
            />
          </Field>

          <Field label="Who is cooking?">
            <div className="row wrap" style={{ gap: 8 }}>
              <button
                className={`person-pill${!draft.cookId ? ' on' : ''}`}
                onClick={() => patch({ cookId: undefined })}
              >
                <span className="person-pill-all">🤷</span> Nobody yet
              </button>
              {state.core.people
                .filter((person) => !person.archived)
                .map((person) => (
                  <button
                    key={person.id}
                    className={`person-pill${draft.cookId === person.id ? ' on' : ''}`}
                    style={tint(person.color)}
                    onClick={() => patch({ cookId: person.id })}
                  >
                    <Avatar person={person} size={26} />
                    {person.name}
                  </button>
                ))}
            </div>
          </Field>

          <Field label="Icon">
            <EmojiPicker value={draft.emoji ?? '🍽️'} onChange={(emoji) => patch({ emoji })} />
          </Field>

          <Field label="Notes">
            <textarea
              value={draft.notes ?? ''}
              onChange={(event) => patch({ notes: event.target.value })}
              placeholder="Sides, timing, who is out…"
            />
          </Field>

          {draft.ingredients && draft.ingredients.length > 0 ? (
            <button
              className="btn btn-soft btn-block"
              style={{ marginTop: 18 }}
              onClick={() => onAddIngredients(draft.ingredients ?? [], draft.title)}
            >
              <Icon name="cart" size={18} /> Add {draft.ingredients.length} ingredients to shopping
            </button>
          ) : null}

          {fromRule ? (
            <p className="field-hint" style={{ marginTop: 18 }}>
              🔁 This one repeats. Saving here changes just this day; use{' '}
              <strong>Repeats</strong> at the top of the week to change the schedule.
            </p>
          ) : (
            <button
              className="btn btn-soft btn-block"
              style={{ marginTop: 18 }}
              disabled={!draft.title.trim()}
              onClick={() => target && onRepeat({ ...draft, title: draft.title.trim() }, target.slot)}
            >
              <Icon name="refresh" size={17} /> Make this repeat
            </button>
          )}
        </>
      )}
    </Sheet>
  )
}
