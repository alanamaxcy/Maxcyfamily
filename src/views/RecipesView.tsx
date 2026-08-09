/**
 * The recipe vault, carried over from the standalone recipes app.
 *
 * The measurement engine (scaling, cup↔gram conversion, fraction display) and
 * the JSON-LD importer are the same logic as before — see shared/recipes.ts.
 * What's new here is that recipes live in the shared family state, so an edit
 * on a phone shows up on the kitchen iPad.
 */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { ShoppingItem } from '@shared/types.ts'
import {
  RECIPE_CATEGORIES,
  formatIngredient,
  ingredientNames,
  makeRecipeId,
  parseIngredientLine,
  type Ingredient,
  type Recipe,
  type RecipeCategory,
  type UnitMode,
} from '@shared/recipes.ts'
import { guessCategory, splitQuantity } from '@shared/categorize.ts'
import { newId } from '@shared/id.ts'
import { useApp } from '../lib/store.tsx'
import { importRecipe } from '../lib/api.ts'
import { Empty, Field, Segmented, SPRING } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet, ConfirmDialog } from '../components/Sheet.tsx'
import { DangerRow } from './editors/parts.tsx'

const SCALES = [
  { value: 0.5, label: '½×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
]

export function RecipesView() {
  const { state, dispatch, toast } = useApp()
  const [openId, setOpenId] = useState<string | null>(null)
  const [category, setCategory] = useState<RecipeCategory | 'all' | 'favorites'>('all')
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null)

  const recipes = state.core.recipes

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return recipes
      .filter((recipe) => {
        if (category === 'favorites') return recipe.favorite
        if (category !== 'all' && recipe.cat !== category) return false
        return true
      })
      .filter((recipe) => {
        if (!needle) return true
        return (
          recipe.title.toLowerCase().includes(needle) ||
          (recipe.author ?? '').toLowerCase().includes(needle) ||
          recipe.ingredients.some((ing) => (ing.name ?? ing.raw ?? '').toLowerCase().includes(needle))
        )
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [recipes, category, query])

  const open = recipes.find((recipe) => recipe.id === openId) ?? null

  const addIngredients = (recipe: Recipe) => {
    const existing = new Set(state.core.shopping.map((item) => item.text.toLowerCase()))
    const ops = ingredientNames(recipe)
      .filter((name) => !existing.has(name.toLowerCase()))
      .map((name) => {
        const { qty, text } = splitQuantity(name)
        const item: ShoppingItem = {
          id: newId('sh'),
          text,
          ...(qty ? { qty } : {}),
          category: guessCategory(text),
          done: false,
          fromMeal: recipe.title,
          createdAt: new Date().toISOString(),
        }
        return { t: 'shopping.upsert' as const, item }
      })

    if (ops.length === 0) {
      toast('Already on the shopping list')
      return
    }
    dispatch(ops)
    toast(`Added ${ops.length} ingredients to shopping`)
  }

  if (open) {
    return (
      <RecipeDetail
        recipe={open}
        onBack={() => setOpenId(null)}
        onEdit={() => setEditing(open)}
        onAddToShopping={() => addIngredients(open)}
        onToggleFavorite={() => dispatch({ t: 'recipe.setFavorite', id: open.id, favorite: !open.favorite })}
      />
    )
  }

  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Kitchen</span>
          <h1 className="h1">Recipe vault</h1>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-soft btn-sm" onClick={() => setImporting(true)}>
            <Icon name="link" size={16} /> Import
          </button>
          <button className="btn btn-accent btn-sm" onClick={() => setEditing('new')}>
            <Icon name="plus" size={17} />
          </button>
        </div>
      </div>

      <div className="add-bar" style={{ marginBottom: 14 }}>
        <span className="search-icon"><Icon name="search" size={18} /></span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search recipes and ingredients"
          style={{ paddingLeft: 42 }}
          aria-label="Search recipes"
        />
      </div>

      <div className="chip-row" style={{ marginBottom: 18 }}>
        <button className={`chip${category === 'all' ? ' chip-on' : ''}`} onClick={() => setCategory('all')}>
          All {recipes.length}
        </button>
        <button className={`chip${category === 'favorites' ? ' chip-on' : ''}`} onClick={() => setCategory('favorites')}>
          ⭐️ Favourites
        </button>
        {RECIPE_CATEGORIES.map((entry) => {
          const count = recipes.filter((recipe) => recipe.cat === entry.id).length
          if (count === 0) return null
          return (
            <button
              key={entry.id}
              className={`chip${category === entry.id ? ' chip-on' : ''}`}
              onClick={() => setCategory(entry.id)}
            >
              {entry.emoji} {entry.name}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <Empty
          emoji="📖"
          title={query ? 'Nothing matches' : 'No recipes here yet'}
          hint={query ? 'Try a different word.' : 'Import one from a link, or type it in by hand.'}
          action={
            <button className="btn btn-accent" onClick={() => setImporting(true)}>
              <Icon name="link" size={18} /> Import from a link
            </button>
          }
        />
      ) : (
        <div className="recipe-grid">
          {filtered.map((recipe, index) => (
            <motion.button
              key={recipe.id}
              className="recipe-card"
              onClick={() => setOpenId(recipe.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.035, 0.45), duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileTap={{ scale: 0.97 }}
              layout
            >
              <span className="recipe-cat">
                {RECIPE_CATEGORIES.find((entry) => entry.id === recipe.cat)?.emoji ?? '🍽️'}
              </span>
              {recipe.favorite ? <span className="recipe-fav">⭐️</span> : null}
              <span className="recipe-title clamp-2">{recipe.title}</span>
              {recipe.author ? <span className="recipe-author truncate">{recipe.author}</span> : null}
              <span className="recipe-meta">
                {recipe.meta.total ? (
                  <span className="row" style={{ gap: 4 }}>
                    <Icon name="clock" size={13} /> {recipe.meta.total}
                  </span>
                ) : null}
                <span>{recipe.ingredients.filter((ing) => !ing.section).length} ingredients</span>
              </span>
            </motion.button>
          ))}
        </div>
      )}

      <ImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        onImported={(recipe) => {
          dispatch({ t: 'recipe.upsert', recipe })
          setImporting(false)
          setOpenId(recipe.id)
        }}
      />
      <RecipeEditor
        recipe={editing}
        onClose={() => setEditing(null)}
        onSave={(recipe) => dispatch({ t: 'recipe.upsert', recipe })}
        onDelete={(id) => {
          dispatch({ t: 'recipe.remove', id })
          setOpenId(null)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function RecipeDetail({
  recipe,
  onBack,
  onEdit,
  onAddToShopping,
  onToggleFavorite,
}: {
  recipe: Recipe
  onBack: () => void
  onEdit: () => void
  onAddToShopping: () => void
  onToggleFavorite: () => void
}) {
  const { dispatch } = useApp()
  const [scale, setScale] = useState(1)
  const [unit, setUnit] = useState<UnitMode>('cups')
  // Cooking progress is deliberately local: it's for the next 40 minutes, not
  // something to sync to everyone else's phone.
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [note, setNote] = useState(recipe.familyNote ?? '')

  const toggleStep = (index: number) =>
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  return (
    <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <Icon name="chevronLeft" size={18} /> All recipes
        </button>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={onToggleFavorite} aria-label="Favourite" title="Favourite">
            <span style={{ fontSize: 19 }}>{recipe.favorite ? '⭐️' : '☆'}</span>
          </button>
          <button className="icon-btn" onClick={onEdit} aria-label="Edit recipe">
            <Icon name="edit" size={19} />
          </button>
        </div>
      </div>

      <h1 className="h1">{recipe.title}</h1>
      {recipe.author ? <p className="small" style={{ marginTop: 4 }}>{recipe.author}</p> : null}
      {recipe.description ? <p className="body" style={{ marginTop: 12 }}>{recipe.description}</p> : null}

      <div className="recipe-facts">
        {recipe.meta.yield || recipe.meta.servings ? (
          <Fact label="Makes" value={recipe.meta.yield ?? recipe.meta.servings ?? ''} />
        ) : null}
        {recipe.meta.prep ? <Fact label="Prep" value={recipe.meta.prep} /> : null}
        {recipe.meta.cook ? <Fact label="Cook" value={recipe.meta.cook} /> : null}
        {recipe.meta.total ? <Fact label="Total" value={recipe.meta.total} /> : null}
      </div>

      <div className="row wrap" style={{ gap: 10, margin: '20px 0 16px' }}>
        <Segmented
          value={String(scale)}
          onChange={(next) => setScale(Number(next))}
          options={SCALES.map((entry) => ({ value: String(entry.value), label: entry.label }))}
        />
        <Segmented
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'cups', label: 'Cups' },
            { value: 'grams', label: 'Grams' },
          ]}
        />
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h2 className="h2">Ingredients</h2>
          <button className="btn btn-soft btn-sm" onClick={onAddToShopping}>
            <Icon name="cart" size={16} /> To list
          </button>
        </div>

        <ul className="ing-list">
          {recipe.ingredients.map((ing, index) =>
            ing.section ? (
              <li key={index} className="ing-section">{ing.section}</li>
            ) : (
              <IngredientRow key={index} ing={ing} scale={scale} unit={unit} />
            ),
          )}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2 className="h2" style={{ marginBottom: 14 }}>Method</h2>
        <ol className="step-list">
          {recipe.instructions.map((instruction, index) => (
            <motion.li
              key={index}
              className={`method-step${checked.has(index) ? ' done' : ''}`}
              onClick={() => toggleStep(index)}
              whileTap={{ scale: 0.99 }}
              transition={SPRING}
            >
              <span className="method-num numeral">{index + 1}</span>
              <span className="method-text">{instruction}</span>
            </motion.li>
          ))}
        </ol>
      </div>

      {recipe.notes
        ? Object.entries(recipe.notes).map(([heading, lines]) => (
            <div className="card" style={{ marginTop: 18 }} key={heading}>
              <h2 className="h2" style={{ marginBottom: 12 }}>{heading}</h2>
              <ul className="note-list">
                {lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </div>
          ))
        : null}

      <div className="card" style={{ marginTop: 18 }}>
        <Field label="Family notes" hint="Saved for everyone — what worked, what to change next time.">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (note !== (recipe.familyNote ?? '')) {
                dispatch({ t: 'recipe.upsert', recipe: { ...recipe, familyNote: note } })
              }
            }}
            placeholder="Doubled the sauce and it was perfect…"
          />
        </Field>
      </div>

      {recipe.url ? (
        <a className="btn btn-ghost btn-block" style={{ marginTop: 16 }} href={recipe.url} target="_blank" rel="noreferrer">
          <Icon name="link" size={17} /> Open the original
        </a>
      ) : null}
    </motion.div>
  )
}

function IngredientRow({ ing, scale, unit }: { ing: Ingredient; scale: number; unit: UnitMode }) {
  const [struck, setStruck] = useState(false)
  const formatted = formatIngredient(ing, scale, unit)

  return (
    <li className={`ing-row${struck ? ' struck' : ''}`} onClick={() => setStruck((value) => !value)}>
      <span className={`ing-amount numeral${formatted.converted ? ' converted' : ''}`}>{formatted.amount}</span>
      <span className="ing-name">{formatted.text}</span>
    </li>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="recipe-fact">
      <span className="tiny">{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ImportSheet({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: (recipe: Recipe) => void
}) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    try {
      const result = await importRecipe(url.trim())
      const recipe: Recipe = {
        ...result.recipe,
        id: makeRecipeId(result.recipe.title || 'imported recipe'),
        createdAt: new Date().toISOString(),
      }
      if (!result.foundRecipe) {
        setError('No structured recipe on that page — we grabbed what we could, edit it before saving.')
      }
      onImported(recipe)
      setUrl('')
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not import that link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Import a recipe"
      subtitle="Paste a link from any recipe site"
      footer={
        <>
          <button className="btn btn-soft btn-block" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-block" onClick={() => void run()} disabled={busy || !url.trim()}>
            {busy ? 'Fetching…' : 'Import'}
          </button>
        </>
      }
    >
      <Field label="Recipe link">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          inputMode="url"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter') void run()
          }}
        />
      </Field>
      {error ? <div className="banner" style={{ marginTop: 14 }}>{error}</div> : null}
      <p className="field-hint" style={{ marginTop: 14 }}>
        Most recipe sites publish a structured version we can read directly. If one doesn&rsquo;t, you&rsquo;ll get the
        title and description and can fill in the rest.
      </p>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

function RecipeEditor({
  recipe,
  onClose,
  onSave,
  onDelete,
}: {
  recipe: Recipe | 'new' | null
  onClose: () => void
  onSave: (recipe: Recipe) => void
  onDelete: (id: string) => void
}) {
  const make = (): Recipe => ({
    id: newId('rc'),
    cat: 'dinner',
    title: '',
    meta: {},
    ingredients: [],
    instructions: [],
    createdAt: new Date().toISOString(),
  })

  const key = recipe === 'new' ? 'new' : (recipe?.id ?? '')
  const [seeded, setSeeded] = useState<string | null>(null)
  const [draft, setDraft] = useState<Recipe>(make)
  const [confirming, setConfirming] = useState(false)

  if (recipe && seeded !== key) {
    setSeeded(key)
    setDraft(recipe === 'new' ? make() : structuredClone(recipe))
  }

  const patch = (changes: Partial<Recipe>) => setDraft((current) => ({ ...current, ...changes }))

  // Ingredients and steps are edited as plain text — far faster on a tablet
  // than a row-per-item form, and it round-trips through the same parser.
  const ingredientText = draft.ingredients
    .map((ing) => (ing.section ? `# ${ing.section}` : [ing.q, ing.u, ing.name].filter(Boolean).join(' ') + (ing.note ? `, ${ing.note}` : '')))
    .join('\n')

  return (
    <>
      <Sheet
        open={recipe !== null}
        onClose={onClose}
        title={recipe === 'new' ? 'New recipe' : 'Edit recipe'}
        footer={
          <>
            <button className="btn btn-soft btn-block" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-block"
              disabled={!draft.title.trim()}
              onClick={() => {
                onSave({ ...draft, title: draft.title.trim(), updatedAt: new Date().toISOString() })
                onClose()
              }}
            >
              Save
            </button>
          </>
        }
      >
        <Field label="Title">
          <input value={draft.title} onChange={(event) => patch({ title: event.target.value })} autoFocus />
        </Field>

        <Field label="Category">
          <div className="chip-row">
            {RECIPE_CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                className={`chip${draft.cat === entry.id ? ' chip-on' : ''}`}
                onClick={() => patch({ cat: entry.id })}
              >
                {entry.emoji} {entry.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Who wrote it">
          <input value={draft.author ?? ''} onChange={(event) => patch({ author: event.target.value })} placeholder="Optional" />
        </Field>

        <Field label="Description">
          <textarea value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value })} />
        </Field>

        <div className="field-row">
          <Field label="Makes">
            <input value={draft.meta.yield ?? draft.meta.servings ?? ''} onChange={(event) => patch({ meta: { ...draft.meta, yield: event.target.value } })} />
          </Field>
          <Field label="Total time">
            <input value={draft.meta.total ?? ''} onChange={(event) => patch({ meta: { ...draft.meta, total: event.target.value } })} />
          </Field>
        </div>

        <Field label="Ingredients" hint="One per line. Start a line with # for a section header.">
          <textarea
            defaultValue={ingredientText}
            style={{ minHeight: 200 }}
            onBlur={(event) => patch({ ingredients: parseIngredientBlock(event.target.value) })}
          />
        </Field>

        <Field label="Method" hint="One step per line.">
          <textarea
            defaultValue={draft.instructions.join('\n')}
            style={{ minHeight: 200 }}
            onBlur={(event) =>
              patch({ instructions: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })
            }
          />
        </Field>

        <Field label="Source link">
          <input value={draft.url ?? ''} onChange={(event) => patch({ url: event.target.value })} inputMode="url" />
        </Field>

        {recipe !== 'new' && recipe ? <DangerRow label="Delete this recipe" onClick={() => setConfirming(true)} /> : null}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title="Delete this recipe?"
        onConfirm={() => {
          if (recipe && recipe !== 'new') onDelete(recipe.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}

function parseIngredientBlock(text: string): Ingredient[] {
  const out: Ingredient[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      out.push({ section: line.replace(/^#+\s*/, '') })
      continue
    }
    // Reuse the importer's parser so hand-typed lines scale and convert too.
    const parsed = parseIngredientLine(line)
    if (parsed) out.push(parsed)
  }
  return out
}
