/**
 * Recipe vault.
 *
 * The measurement logic here — density tables, cup↔gram conversion, fraction
 * formatting, the schema.org JSON-LD importer — is ported from the standalone
 * "My Favorite Recipes" app. Behaviour is preserved; the differences are that
 * everything is typed, the scale/unit mode is passed in rather than read from a
 * global, and importing goes through our own function instead of a public CORS
 * proxy.
 */

import densityData from './data/densities.json' with { type: 'json' }
import recipeData from './data/recipes.json' with { type: 'json' }
import type { ID, ISODateTime } from './types.ts'

export type UnitMode = 'cups' | 'grams'

export interface Ingredient {
  /** Section header row, e.g. "For the sauce" — has no quantity. */
  section?: string
  /** Unparsed fallback line when we couldn't make sense of it. */
  raw?: string
  q?: number
  u?: string
  name?: string
  note?: string
  /** e.g. "about " — printed before the quantity. */
  prefix?: string
  /** Authoritative weight, used instead of a density lookup when present. */
  gram?: number
}

export interface RecipeMeta {
  yield?: string
  servings?: string
  prep?: string
  cook?: string
  total?: string
}

export type RecipeCategory = 'breakfast' | 'lunch' | 'dinner' | 'sides' | 'dessert' | 'bread' | 'snack'

export interface Recipe {
  id: ID
  cat: RecipeCategory
  title: string
  author?: string
  url?: string
  description?: string
  meta: RecipeMeta
  ingredients: Ingredient[]
  instructions: string[]
  /** Grouped extras: { "Tips & Substitutions": [...], "Storage": [...] } */
  notes?: Record<string, string[]>
  /** Free-text note the family adds on the iPad. */
  familyNote?: string
  favorite?: boolean
  /** Set for recipes typed or imported in-app, absent for the seeded ones. */
  createdAt?: ISODateTime
  updatedAt?: ISODateTime
}

export const RECIPE_CATEGORIES: { id: RecipeCategory; name: string; emoji: string }[] = [
  { id: 'breakfast', name: 'Breakfast', emoji: '🍳' },
  { id: 'lunch', name: 'Lunch', emoji: '🥪' },
  { id: 'dinner', name: 'Dinner', emoji: '🍽️' },
  { id: 'sides', name: 'Sides', emoji: '🥗' },
  { id: 'bread', name: 'Bread', emoji: '🍞' },
  { id: 'dessert', name: 'Dessert', emoji: '🍰' },
  { id: 'snack', name: 'Snacks', emoji: '🍿' },
]

const DENSITIES = densityData.DENSITIES as Record<string, number>
const TBSP_DENSITY = densityData.TBSP_DENSITY as Record<string, number>
const TSP_DENSITY = densityData.TSP_DENSITY as Record<string, number>

export const SEED_RECIPES = recipeData as unknown as Recipe[]

/* ------------------------------------------------------------------ */
/* Measurement                                                         */
/* ------------------------------------------------------------------ */

/** Grams per one `unit` of `name`, or null when weighing it would be silly. */
export function lookupGrams(name: string | undefined, unit: string | undefined): number | null {
  if (!name) return null
  const table =
    unit === 'cup' ? DENSITIES : unit === 'tbsp' ? TBSP_DENSITY : unit === 'tsp' ? TSP_DENSITY : null
  if (!table) return null

  const needle = name.toLowerCase().trim()
  const exact = table[needle]
  if (exact !== undefined) return exact

  // Longest substring match, so "melted butter" still finds "butter".
  let best: string | null = null
  for (const key of Object.keys(table)) {
    if (needle.includes(key) && (best === null || key.length > best.length)) best = key
  }
  return best ? (table[best] ?? null) : null
}

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'],
  [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
]

/** 1.5 → "1½". Cooks read fractions, not decimals. */
export function pretty(num: number | undefined | null): string {
  if (num === undefined || num === null || Number.isNaN(num)) return ''
  if (Number.isInteger(num)) return String(num)

  const whole = Math.floor(num)
  const frac = num - whole
  for (const [value, glyph] of FRACTIONS) {
    if (Math.abs(frac - value) < 0.04) return whole > 0 ? `${whole}${glyph}` : glyph
  }
  return String(Math.round(num * 100) / 100)
}

export function formatGrams(grams: number | null | undefined): string {
  if (grams === null || grams === undefined || Number.isNaN(grams)) return ''
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`
  if (grams >= 10) return `${Math.round(grams)} g`
  return `${Math.round(grams * 10) / 10} g`
}

export interface FormattedIngredient {
  amount: string
  text: string
  /** True when we showed a weight instead of the original volume. */
  converted: boolean
}

export function formatIngredient(ing: Ingredient, scale = 1, unitMode: UnitMode = 'cups'): FormattedIngredient {
  if (ing.raw && ing.q === undefined && ing.gram === undefined) {
    return { amount: '', text: ing.raw, converted: false }
  }

  const scaledQ = (ing.q ?? 0) * scale
  let text = ing.name ?? ing.raw ?? ''
  if (ing.note) text += `, ${ing.note}`

  // Weight-only ingredient: no volume equivalent exists, so always show grams.
  if (ing.q === undefined && ing.gram !== undefined) {
    return { amount: formatGrams(ing.gram * scale), text, converted: true }
  }

  // Grams mode converts cups and tablespoons. Teaspoons stay volumetric —
  // "3 g of baking powder" is less useful in a kitchen than "¾ tsp".
  if (unitMode === 'grams' && (ing.u === 'cup' || ing.u === 'tbsp')) {
    if (ing.gram !== undefined) {
      return { amount: formatGrams(ing.gram * scale), text, converted: true }
    }
    const perUnit = lookupGrams(ing.name, ing.u)
    if (perUnit !== null) {
      return { amount: formatGrams(perUnit * scaledQ), text, converted: true }
    }
    // No density known (a tbsp of minced ginger) — fall through to volume.
  }

  let unitDisplay = ing.u ?? ''
  if (unitDisplay === 'cup' && scaledQ !== 1) unitDisplay = 'cups'

  let amount = ing.prefix ?? ''
  amount += pretty(scaledQ)
  if (unitDisplay) amount += ` ${unitDisplay}`

  return { amount: amount.trim(), text, converted: false }
}

/** Plain-text ingredient lines, for pushing a recipe onto the shopping list. */
export function ingredientNames(recipe: Recipe): string[] {
  return recipe.ingredients
    .filter((ing) => !ing.section)
    .map((ing) => ing.name ?? ing.raw ?? '')
    .map((name) => name.trim())
    .filter(Boolean)
}

/* ------------------------------------------------------------------ */
/* Import: schema.org Recipe out of a page's JSON-LD                   */
/* ------------------------------------------------------------------ */

export function stripTags(value: unknown): string {
  if (!value) return ''
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** ISO 8601 duration → "1 hr 30 min". */
export function isoDurationToText(iso: unknown): string {
  if (!iso) return ''
  const match = String(iso).match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
  if (!match) return String(iso)

  const days = parseInt(match[1] ?? '0', 10)
  const hours = parseInt(match[2] ?? '0', 10) + days * 24
  const minutes = parseInt(match[3] ?? '0', 10)

  const parts: string[] = []
  if (hours) parts.push(`${hours} hr`)
  if (minutes) parts.push(`${minutes} min`)
  return parts.join(' ')
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null

export function findRecipeInJsonLd(node: Json): Record<string, unknown> | null {
  if (!node) return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeInJsonLd(item as Json)
      if (found) return found
    }
    return null
  }
  if (typeof node !== 'object') return null

  const object = node as Record<string, unknown>
  const type = object['@type']
  const types = Array.isArray(type) ? type : type ? [type] : []
  if (types.some((entry) => String(entry).toLowerCase() === 'recipe')) return object
  if (object['@graph']) return findRecipeInJsonLd(object['@graph'] as Json)
  return null
}

/** Instructions arrive as strings, HowToStep objects, or nested HowToSections. */
export function flattenInstructions(node: Json): string[] {
  const out: string[] = []

  const walk = (value: Json): void => {
    if (!value) return
    if (typeof value === 'string') {
      const text = stripTags(value)
      if (text) out.push(text)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry as Json))
      return
    }
    if (typeof value !== 'object') return

    const object = value as Record<string, unknown>
    const type = object['@type']
    const types = Array.isArray(type) ? type : type ? [type] : []

    if (types.some((entry) => /HowToSection/i.test(String(entry)))) {
      if (object['itemListElement']) walk(object['itemListElement'] as Json)
    } else if (types.some((entry) => /HowToStep/i.test(String(entry)))) {
      const text = stripTags(object['text'] ?? object['name'] ?? '')
      if (text) out.push(text)
    } else if (object['text']) {
      walk(object['text'] as Json)
    } else if (object['itemListElement']) {
      walk(object['itemListElement'] as Json)
    }
  }

  walk(node)
  return out
}

const UNIT_PATTERN =
  /^(cups?|tablespoons?|tbsp\.?|tbs\.?|teaspoons?|tsp\.?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g\.?|kilograms?|kg\.?|milliliters?|ml\.?|liters?|l\.?|cloves?|sticks?|cans?|packets?|pinch|large|medium|small)\b\.?/i

export function normalizeUnit(unit: string): string {
  const value = unit.toLowerCase().replace(/\.$/, '')
  if (/^cups?$/.test(value)) return 'cup'
  if (/^(tablespoons?|tbsp|tbs)$/.test(value)) return 'tbsp'
  if (/^(teaspoons?|tsp)$/.test(value)) return 'tsp'
  if (/^(ounces?|oz)$/.test(value)) return 'oz'
  if (/^(pounds?|lbs?)$/.test(value)) return 'lb'
  if (/^(grams?|g)$/.test(value)) return 'g'
  if (/^(kilograms?|kg)$/.test(value)) return 'kg'
  if (/^(milliliters?|ml)$/.test(value)) return 'ml'
  if (/^(liters?|l)$/.test(value)) return 'l'
  return value
}

/** Best-effort parse of "1 1/2 cups flour, sifted". */
export function parseIngredientLine(line: string): Ingredient | null {
  const raw = stripTags(line)
  if (!raw) return null

  const qtyMatch = raw.match(/^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)\s*([-–]\s*\d+\/?\d*)?/)
  let q: number | undefined
  let rest = raw

  if (qtyMatch?.[1]) {
    const part = qtyMatch[1]
    if (part.includes(' ')) {
      const [whole, frac] = part.split(/\s+/)
      const [num, den] = (frac ?? '').split('/').map(Number)
      q = parseInt(whole ?? '0', 10) + (den ? (num ?? 0) / den : 0)
    } else if (part.includes('/')) {
      const [num, den] = part.split('/').map(Number)
      q = den ? (num ?? 0) / den : undefined
    } else {
      q = parseFloat(part)
    }
    rest = raw.slice(qtyMatch[0].length).trim()
  }

  const unitMatch = rest.match(UNIT_PATTERN)
  let u: string | undefined
  let after = rest
  if (unitMatch?.[1]) {
    u = normalizeUnit(unitMatch[1])
    after = rest.slice(unitMatch[0].length).trim()
  }
  after = after.replace(/^of\s+/i, '')

  let name = after
  let note = ''
  const commaIndex = after.indexOf(',')
  if (commaIndex !== -1) {
    name = after.slice(0, commaIndex).trim()
    note = after.slice(commaIndex + 1).trim()
  }

  if (!name && q === undefined) return { raw }

  const out: Ingredient = { name }
  if (q !== undefined) out.q = q
  if (u) out.u = u
  if (note) out.note = note
  return out
}

export interface ParsedImport {
  recipe: Omit<Recipe, 'id'>
  /** False when we fell back to <title>/meta description guessing. */
  foundRecipe: boolean
}

export function parseRecipeHtml(html: string, sourceUrl: string): ParsedImport {
  const recipe: Omit<Recipe, 'id'> = {
    cat: 'dinner',
    title: '',
    author: '',
    url: sourceUrl,
    description: '',
    meta: { servings: '', prep: '', cook: '', total: '' },
    ingredients: [],
    instructions: [],
  }

  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []
  let data: Record<string, unknown> | null = null

  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim()
    try {
      const found = findRecipeInJsonLd(JSON.parse(inner) as Json)
      if (found) {
        data = found
        break
      }
    } catch {
      // Malformed JSON-LD is common in the wild; just try the next block.
    }
  }

  if (data) {
    recipe.title = stripTags(data['name'])
    recipe.description = stripTags(data['description'])

    const author = data['author']
    if (author) {
      const first = Array.isArray(author) ? author[0] : author
      recipe.author =
        typeof first === 'string' ? first : stripTags((first as Record<string, unknown>)?.['name'])
    }

    if (data['prepTime']) recipe.meta.prep = isoDurationToText(data['prepTime'])
    if (data['cookTime']) recipe.meta.cook = isoDurationToText(data['cookTime'])
    if (data['totalTime']) recipe.meta.total = isoDurationToText(data['totalTime'])

    const recipeYield = data['recipeYield']
    if (recipeYield) {
      const first = Array.isArray(recipeYield) ? recipeYield[0] : recipeYield
      recipe.meta.servings = stripTags(String(first))
    }

    const ingredients = data['recipeIngredient']
    if (Array.isArray(ingredients)) {
      recipe.ingredients = ingredients
        .map((line) => parseIngredientLine(String(line)))
        .filter((entry): entry is Ingredient => entry !== null)
    }

    if (data['recipeInstructions']) {
      recipe.instructions = flattenInstructions(data['recipeInstructions'] as Json)
    }

    const category = String(data['recipeCategory'] ?? '').toLowerCase()
    const matched = RECIPE_CATEGORIES.find((entry) => category.includes(entry.id))
    if (matched) recipe.cat = matched.id
  } else {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (titleMatch?.[1]) {
      recipe.title = stripTags(titleMatch[1]).split('|')[0]?.split(' - ')[0]?.trim() ?? ''
    }
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
    if (descMatch?.[1]) recipe.description = stripTags(descMatch[1])
  }

  return { recipe, foundRecipe: Boolean(data) }
}

/**
 * Turns a stored source into something a browser will actually navigate to.
 *
 * The seeded recipes carry bare hostnames ("cooknourishbliss.com/…"), which a
 * browser treats as a *relative* path — the SPA catch-all then serves index.html
 * and the link appears to do nothing. Anything without a scheme gets https://,
 * and script-bearing schemes are refused outright.
 */
export function externalUrl(url: string | undefined | null): string | null {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return null
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`
  // Require something that at least looks like a hostname before guessing.
  if (!/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return null
  return `https://${trimmed}`
}

/** "cooknourishbliss.com/2020/…" -> "cooknourishbliss.com" */
export function urlHost(url: string | undefined | null): string {
  const full = externalUrl(url)
  if (!full) return ''
  try {
    return new URL(full).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function makeRecipeId(title: string): ID {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || `recipe-${Math.random().toString(36).slice(2, 8)}`
}
