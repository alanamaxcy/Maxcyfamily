/**
 * These lock in the behaviour carried over from the standalone recipes app —
 * the measurement engine is the part a cook actually depends on.
 */

import { describe, expect, it } from 'vitest'
import {
  SEED_RECIPES,
  formatIngredient,
  isoDurationToText,
  lookupGrams,
  parseIngredientLine,
  parseRecipeHtml,
  pretty,
  stripTags,
  externalUrl,
  urlHost,
} from '@shared/recipes.ts'
import { guessCategory, splitQuantity } from '@shared/categorize.ts'

describe('seed data', () => {
  it('carries every recipe across intact', () => {
    expect(SEED_RECIPES).toHaveLength(14)
    for (const recipe of SEED_RECIPES) {
      expect(recipe.id).toBeTruthy()
      expect(recipe.title).toBeTruthy()
      expect(recipe.ingredients.length).toBeGreaterThan(0)
      expect(recipe.instructions.length).toBeGreaterThan(0)
    }
  })
})

describe('pretty', () => {
  it('prints cook-readable fractions', () => {
    expect(pretty(1.5)).toBe('1½')
    expect(pretty(0.25)).toBe('¼')
    expect(pretty(0.333)).toBe('⅓')
    expect(pretty(2)).toBe('2')
    expect(pretty(1.667)).toBe('1⅔')
  })

  it('falls back to a rounded decimal for odd amounts', () => {
    expect(pretty(1.07)).toBe('1.07')
  })
})

describe('lookupGrams', () => {
  it('finds exact matches', () => {
    expect(lookupGrams('all-purpose flour', 'cup')).toBe(120)
  })

  it('prefers the longest substring match', () => {
    // "melted butter" must resolve through "butter", not something shorter.
    expect(lookupGrams('melted butter', 'cup')).toBe(227)
  })

  it('returns null where weighing makes no sense', () => {
    expect(lookupGrams('minced ginger', 'tbsp')).toBeNull()
    expect(lookupGrams('flour', 'clove')).toBeNull()
  })
})

describe('formatIngredient', () => {
  const flour = { q: 2, u: 'cup', name: 'all-purpose flour' }

  it('scales volume amounts', () => {
    expect(formatIngredient(flour, 1, 'cups').amount).toBe('2 cups')
    expect(formatIngredient(flour, 0.5, 'cups').amount).toBe('1 cup')
    expect(formatIngredient(flour, 2, 'cups').amount).toBe('4 cups')
  })

  it('converts to grams when asked', () => {
    const result = formatIngredient(flour, 1, 'grams')
    expect(result.amount).toBe('240 g')
    expect(result.converted).toBe(true)
  })

  it('keeps teaspoons volumetric even in grams mode', () => {
    const result = formatIngredient({ q: 1, u: 'tsp', name: 'vanilla extract' }, 1, 'grams')
    expect(result.amount).toBe('1 tsp')
    expect(result.converted).toBe(false)
  })

  it('falls back to volume when no density is known', () => {
    const result = formatIngredient({ q: 2, u: 'tbsp', name: 'minced ginger' }, 1, 'grams')
    expect(result.amount).toBe('2 tbsp')
    expect(result.converted).toBe(false)
  })

  it('prefers an explicit gram weight over the density table', () => {
    const result = formatIngredient({ q: 1, u: 'cup', name: 'sourdough discard', gram: 200 }, 2, 'grams')
    expect(result.amount).toBe('400 g')
  })

  it('appends the note to the name', () => {
    const result = formatIngredient({ q: 1, u: 'cup', name: 'pecans', note: 'chopped' }, 1, 'cups')
    expect(result.text).toBe('pecans, chopped')
  })

  it('passes raw lines through untouched', () => {
    const result = formatIngredient({ raw: 'Salt and pepper to taste' }, 3, 'grams')
    expect(result.amount).toBe('')
    expect(result.text).toBe('Salt and pepper to taste')
  })
})

describe('parseIngredientLine', () => {
  it('splits quantity, unit, name and note', () => {
    expect(parseIngredientLine('1 1/2 cups flour, sifted')).toEqual({
      q: 1.5,
      u: 'cup',
      name: 'flour',
      note: 'sifted',
    })
  })

  it('normalises unit spellings', () => {
    expect(parseIngredientLine('2 tablespoons olive oil')?.u).toBe('tbsp')
    expect(parseIngredientLine('3 tsp. salt')?.u).toBe('tsp')
  })

  it('handles bare fractions', () => {
    expect(parseIngredientLine('1/4 cup sugar')?.q).toBe(0.25)
  })

  it('keeps unparseable lines as raw text', () => {
    expect(parseIngredientLine('Salt and pepper')).toEqual({ name: 'Salt and pepper' })
  })
})

describe('isoDurationToText', () => {
  it('renders hours and minutes', () => {
    expect(isoDurationToText('PT1H30M')).toBe('1 hr 30 min')
    expect(isoDurationToText('PT45M')).toBe('45 min')
    expect(isoDurationToText('P1DT2H')).toBe('26 hr')
  })
})

describe('stripTags', () => {
  it('removes markup and decodes entities', () => {
    expect(stripTags('<p>Bob&#39;s  &amp; Sons</p>')).toBe("Bob's & Sons")
  })
})

describe('parseRecipeHtml', () => {
  const html = `
    <html><head><title>Ignore me</title>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"WebPage"},
      {"@type":"Recipe","name":"Test Pancakes","description":"Fluffy.",
       "author":{"@type":"Person","name":"Sam"},
       "prepTime":"PT10M","cookTime":"PT15M","totalTime":"PT25M","recipeYield":["8 pancakes"],
       "recipeIngredient":["2 cups all-purpose flour","1 tbsp sugar"],
       "recipeInstructions":[{"@type":"HowToStep","text":"Mix."},{"@type":"HowToStep","text":"Cook."}]}
    ]}
    </script></head><body></body></html>`

  it('pulls the recipe out of a @graph', () => {
    const { recipe, foundRecipe } = parseRecipeHtml(html, 'https://example.com/p')

    expect(foundRecipe).toBe(true)
    expect(recipe.title).toBe('Test Pancakes')
    expect(recipe.author).toBe('Sam')
    expect(recipe.meta.total).toBe('25 min')
    expect(recipe.meta.servings).toBe('8 pancakes')
    expect(recipe.ingredients).toHaveLength(2)
    expect(recipe.ingredients[0]).toMatchObject({ q: 2, u: 'cup', name: 'all-purpose flour' })
    expect(recipe.instructions).toEqual(['Mix.', 'Cook.'])
  })

  it('flattens HowToSection wrappers', () => {
    const sectioned = `<script type="application/ld+json">
      {"@type":"Recipe","name":"S","recipeInstructions":[
        {"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"A"},{"@type":"HowToStep","text":"B"}]}
      ]}</script>`
    const { recipe } = parseRecipeHtml(sectioned, 'https://example.com')
    expect(recipe.instructions).toEqual(['A', 'B'])
  })

  it('falls back to the title tag when there is no JSON-LD', () => {
    const plain = '<html><head><title>Some Cake | Blog</title></head></html>'
    const { recipe, foundRecipe } = parseRecipeHtml(plain, 'https://example.com')

    expect(foundRecipe).toBe(false)
    expect(recipe.title).toBe('Some Cake')
  })

  it('survives malformed JSON-LD blocks', () => {
    const broken = `<script type="application/ld+json">{ not json </script><title>Fallback</title>`
    expect(() => parseRecipeHtml(broken, 'https://example.com')).not.toThrow()
  })
})

describe('shopping helpers', () => {
  it('guesses an aisle', () => {
    expect(guessCategory('bananas')).toBe('produce')
    expect(guessCategory('whole milk')).toBe('dairy')
    expect(guessCategory('paper towels')).toBe('household')
    expect(guessCategory('widget')).toBe('other')
  })

  it('prefers the more specific keyword', () => {
    // "ice cream" (frozen) must beat "cream" (dairy).
    expect(guessCategory('ice cream')).toBe('frozen')
  })

  it('splits a leading quantity off the name', () => {
    expect(splitQuantity('2 lbs chicken thighs')).toEqual({ qty: '2 lbs', text: 'chicken thighs' })
    expect(splitQuantity('milk')).toEqual({ text: 'milk' })
  })
})

describe('externalUrl', () => {
  it('adds a scheme to the bare hostnames in the seed data', () => {
    // Without this the browser treats it as a relative path and the SPA
    // catch-all serves index.html — the link appears to do nothing.
    expect(externalUrl('cooknourishbliss.com/2020/02/11/classic-dairy-free-waffles')).toBe(
      'https://cooknourishbliss.com/2020/02/11/classic-dairy-free-waffles',
    )
  })

  it('leaves a full URL alone', () => {
    expect(externalUrl('https://example.com/x')).toBe('https://example.com/x')
    expect(externalUrl('http://example.com/x')).toBe('http://example.com/x')
  })

  it('upgrades protocol-relative links', () => {
    expect(externalUrl('//example.com/x')).toBe('https://example.com/x')
  })

  it('refuses script-bearing and non-web schemes', () => {
    expect(externalUrl('javascript:alert(1)')).toBeNull()
    expect(externalUrl('data:text/html,<script>')).toBeNull()
    expect(externalUrl('file:///etc/passwd')).toBeNull()
  })

  it('returns null for empty or non-hostname text', () => {
    expect(externalUrl('')).toBeNull()
    expect(externalUrl(undefined)).toBeNull()
    expect(externalUrl('just some notes')).toBeNull()
  })

  it('every seeded recipe produces a usable link', () => {
    for (const recipe of SEED_RECIPES) {
      expect(externalUrl(recipe.url)).toMatch(/^https:\/\//)
    }
  })

  it('names the host for the button label', () => {
    expect(urlHost('cooknourishbliss.com/2020/x')).toBe('cooknourishbliss.com')
    expect(urlHost('https://www.example.com/x')).toBe('example.com')
  })
})
