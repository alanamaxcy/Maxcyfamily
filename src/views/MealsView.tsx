/** The week's menu and the shopping list it feeds. */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DayMeals, Meal, MealSlot, ShoppingItem } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { CATEGORY_META, CATEGORY_ORDER, guessCategory, splitQuantity } from '@shared/categorize.ts'
import { DAY_SHORT, addDays, formatDayLabel, parseISODate, startOfWeek, weekDates } from '@shared/date.ts'
import { ingredientNames, type Recipe } from '@shared/recipes.ts'
import { useApp } from '../lib/store.tsx'
import { Avatar, Empty, Field, Segmented, SPRING, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { EmojiPicker } from './editors/parts.tsx'

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
            const day: DayMeals = state.core.meals[date] ?? {}
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
                    const meal = day[slot.id]
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
  const { dispatch } = useApp()

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
        onClick={() => dispatch({ t: 'shopping.setDone', id: item.id, done: !item.done })}
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
}: {
  target: { date: string; slot: MealSlot } | null
  onClose: () => void
  onAddIngredients: (names: string[], from: string) => void
}) {
  const { state, dispatch } = useApp()
  const [draft, setDraft] = useState<Meal>({ title: '' })
  const [seeded, setSeeded] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const key = target ? `${target.date}:${target.slot}` : ''
  if (target && seeded !== key) {
    setSeeded(key)
    setDraft(structuredClone(state.core.meals[target.date]?.[target.slot] ?? { title: '' }))
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
        </>
      )}
    </Sheet>
  )
}
