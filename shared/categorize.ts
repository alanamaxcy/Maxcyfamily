/**
 * Guesses an aisle for a shopping item so the list groups itself. It only has
 * to be right often enough to save taps — every item stays hand-editable.
 */

import type { ShoppingCategory } from './types.ts'

export const CATEGORY_ORDER: ShoppingCategory[] = [
  'produce',
  'meat',
  'dairy',
  'bakery',
  'frozen',
  'pantry',
  'drinks',
  'household',
  'other',
]

export const CATEGORY_META: Record<ShoppingCategory, { label: string; emoji: string }> = {
  produce: { label: 'Produce', emoji: '🥬' },
  meat: { label: 'Meat & Fish', emoji: '🍗' },
  dairy: { label: 'Dairy & Eggs', emoji: '🥛' },
  bakery: { label: 'Bakery', emoji: '🥖' },
  frozen: { label: 'Frozen', emoji: '🧊' },
  pantry: { label: 'Pantry', emoji: '🥫' },
  drinks: { label: 'Drinks', emoji: '🧃' },
  household: { label: 'Household', emoji: '🧻' },
  other: { label: 'Other', emoji: '🛒' },
}

const KEYWORDS: Record<Exclude<ShoppingCategory, 'other'>, string[]> = {
  produce: [
    'apple', 'avocado', 'banana', 'basil', 'bell pepper', 'berry', 'blueberr', 'broccoli', 'cabbage',
    'carrot', 'cauliflower', 'celery', 'cilantro', 'corn', 'cucumber', 'garlic', 'grape', 'green bean',
    'kale', 'lemon', 'lettuce', 'lime', 'mango', 'melon', 'mushroom', 'onion', 'orange', 'parsley',
    'peach', 'pear', 'pepper', 'pineapple', 'potato', 'raspberr', 'salad', 'spinach', 'squash',
    'strawberr', 'tomato', 'zucchini', 'fruit', 'veg',
  ],
  meat: [
    'bacon', 'beef', 'brisket', 'chicken', 'chorizo', 'cod', 'drumstick', 'ground turkey', 'ham',
    'hot dog', 'lamb', 'meatball', 'pepperoni', 'pork', 'prawn', 'salmon', 'sausage', 'shrimp',
    'steak', 'tilapia', 'tuna', 'turkey', 'wings',
  ],
  dairy: [
    'butter', 'cheddar', 'cheese', 'cottage', 'cream', 'egg', 'feta', 'greek yogurt', 'half and half',
    'milk', 'mozzarella', 'parmesan', 'sour cream', 'yoghurt', 'yogurt',
  ],
  bakery: [
    'bagel', 'baguette', 'bread', 'brioche', 'bun', 'croissant', 'donut', 'english muffin', 'muffin',
    'pita', 'roll', 'sourdough', 'tortilla',
  ],
  frozen: ['frozen', 'ice cream', 'popsicle', 'waffle', 'fish stick', 'tater tot', 'peas'],
  pantry: [
    'baking', 'bean', 'broth', 'cereal', 'chip', 'chocolate', 'cocoa', 'coffee', 'cracker', 'flour',
    'granola', 'honey', 'jam', 'ketchup', 'lentil', 'mayo', 'mustard', 'noodle', 'oat', 'oil', 'pasta',
    'peanut butter', 'popcorn', 'quinoa', 'rice', 'salsa', 'salt', 'sauce', 'seasoning', 'soup',
    'spice', 'sugar', 'syrup', 'taco', 'tea', 'tortilla chip', 'vanilla', 'vinegar',
  ],
  drinks: ['juice', 'lemonade', 'seltzer', 'soda', 'sparkling', 'water', 'kombucha', 'smoothie'],
  household: [
    'battery', 'bleach', 'detergent', 'dish soap', 'foil', 'diaper', 'floss', 'napkin', 'paper towel',
    'shampoo', 'soap', 'sponge', 'sunscreen', 'tissue', 'toilet paper', 'toothpaste', 'trash bag',
    'wipes', 'ziploc',
  ],
}

export function guessCategory(text: string): ShoppingCategory {
  const needle = text.toLowerCase()
  let best: ShoppingCategory = 'other'
  let bestLength = 0

  for (const category of Object.keys(KEYWORDS) as (keyof typeof KEYWORDS)[]) {
    for (const keyword of KEYWORDS[category]) {
      // Longest match wins, so "ice cream" beats "cream" and lands in frozen.
      if (needle.includes(keyword) && keyword.length > bestLength) {
        best = category
        bestLength = keyword.length
      }
    }
  }

  return best
}

/** Splits "2 lbs chicken thighs" into a quantity and a name. */
export function splitQuantity(text: string): { qty?: string; text: string } {
  const match = text.match(/^\s*(\d+(?:[./]\d+)?\s*(?:x|lbs?|oz|kg|g|ml|l|cans?|bags?|boxes|bunch(?:es)?|dozen|packs?|pints?|quarts?)?)\s+(.*)$/i)
  if (!match || !match[2]) return { text: text.trim() }
  return { qty: match[1]?.trim(), text: match[2].trim() }
}
