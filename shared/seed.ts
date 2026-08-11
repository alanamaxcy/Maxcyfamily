/**
 * First-run state. People start empty on purpose — the setup screen collects
 * the real family rather than leaving placeholder names on a kitchen wall. The
 * chores, routines and rewards seeded here are unassigned "family" items, so
 * they're useful immediately and easy to hand out once profiles exist.
 */

import type { Chore, Core, FullState, Reward, Routine, ScheduleBlock, Settings, TodoList } from './types.ts'
import { SEED_RECIPES } from './recipes.ts'

export const PERSON_COLORS = [
  '#FF6B5A', // coral
  '#2F6BEA', // cobalt
  '#12855F', // forest
  '#FFAE1A', // amber
  '#7C4DFF', // violet
  '#0FA8A0', // teal
  '#F0567A', // rose
  '#FF8A34', // tangerine
] as const

const EPOCH = '2024-01-01T00:00:00.000Z'

export const DEFAULT_SETTINGS: Settings = {
  householdName: 'Our Family',
  timezone: 'America/New_York',
  weekStartsOn: 0,
  theme: 'auto',
  calendars: [],
  weather: {
    latitude: 33.749,
    longitude: -84.388,
    label: 'Atlanta, GA',
    units: 'F',
  },
  sleep: {
    enabled: true,
    idleMinutes: 5,
    intervalSeconds: 30,
    showClock: true,
    showNextEvent: true,
    showWeather: true,
    photos: [],
  },
  pin: '',
  celebrate: true,
  scheduleShowsEvents: true,
}

const WEEKDAYS = [1, 2, 3, 4, 5]

/**
 * A starter homeschool rhythm. Every field is editable on the iPad — this only
 * exists so day one shows a real day instead of an empty timeline.
 */
const SCHEDULE: ScheduleBlock[] = [
  { id: 'blk_wake', title: 'Wake up & breakfast', emoji: '🌅', startTime: '07:00', endTime: '08:00', color: '#FFAE1A', personIds: [], schedule: { type: 'daily' }, sort: 0 },
  { id: 'blk_basket', title: 'Morning basket', emoji: '🧺', startTime: '08:00', endTime: '09:00', color: '#FF8A34', personIds: [], schedule: { type: 'weekly', days: WEEKDAYS }, sort: 1 },
  { id: 'blk_math', title: 'Math', emoji: '➗', startTime: '09:00', endTime: '10:00', color: '#2F6BEA', personIds: [], schedule: { type: 'weekly', days: WEEKDAYS }, sort: 2 },
  { id: 'blk_break', title: 'Outside break', emoji: '🌳', startTime: '10:00', endTime: '10:30', color: '#12855F', personIds: [], schedule: { type: 'weekly', days: WEEKDAYS }, sort: 3 },
  { id: 'blk_reading', title: 'Reading', emoji: '📖', startTime: '10:30', endTime: '11:30', color: '#7C4DFF', personIds: [], schedule: { type: 'weekly', days: WEEKDAYS }, sort: 4 },
  { id: 'blk_writing', title: 'Writing', emoji: '✏️', startTime: '11:30', endTime: '12:15', color: '#0FA8A0', personIds: [], schedule: { type: 'weekly', days: WEEKDAYS }, sort: 5 },
  { id: 'blk_lunch', title: 'Lunch', emoji: '🥪', startTime: '12:15', endTime: '13:15', color: '#FFAE1A', personIds: [], schedule: { type: 'daily' }, sort: 6 },
  { id: 'blk_quiet', title: 'Quiet time', emoji: '🤫', startTime: '13:15', endTime: '14:15', color: '#8C8FA0', personIds: [], schedule: { type: 'daily' }, sort: 7 },
  { id: 'blk_science', title: 'Science & history', emoji: '🔬', startTime: '14:15', endTime: '15:15', color: '#F0567A', personIds: [], schedule: { type: 'weekly', days: WEEKDAYS }, sort: 8 },
  { id: 'blk_free', title: 'Free play', emoji: '🪁', startTime: '15:15', endTime: '17:00', color: '#12855F', personIds: [], schedule: { type: 'daily' }, sort: 9 },
  { id: 'blk_dinner', title: 'Dinner', emoji: '🍽️', startTime: '17:30', endTime: '18:30', color: '#FF6B5A', personIds: [], schedule: { type: 'daily' }, sort: 10 },
  { id: 'blk_bed', title: 'Bedtime routine', emoji: '🌙', startTime: '19:00', endTime: '20:00', color: '#7C4DFF', personIds: [], schedule: { type: 'daily' }, sort: 11 },
]

const TODO_LISTS: TodoList[] = [
  { id: 'list_household', name: 'Household', emoji: '🏡', color: '#2F6BEA', sort: 0 },
  { id: 'list_errands', name: 'Errands', emoji: '🚗', color: '#FF8A34', sort: 1 },
  { id: 'list_school', name: 'School', emoji: '🎒', color: '#7C4DFF', sort: 2 },
]

const CHORES: Chore[] = [
  {
    id: 'chore_dishes', title: 'Load the dishwasher', emoji: '🍽️', assigneeIds: [],
    schedule: { type: 'daily' }, points: 5, category: 'Kitchen', createdAt: EPOCH,
  },
  {
    id: 'chore_table', title: 'Set the table', emoji: '🍴', assigneeIds: [],
    schedule: { type: 'daily' }, points: 3, category: 'Kitchen', createdAt: EPOCH,
  },
  {
    id: 'chore_trash', title: 'Take out the trash', emoji: '🗑️', assigneeIds: [],
    schedule: { type: 'weekly', days: [1, 4] }, points: 5, category: 'Household', createdAt: EPOCH,
  },
  {
    id: 'chore_room', title: 'Tidy your room', emoji: '🛏️', assigneeIds: [],
    schedule: { type: 'daily' }, points: 5, category: 'Bedroom', createdAt: EPOCH,
  },
  {
    id: 'chore_laundry', title: 'Put away laundry', emoji: '🧺', assigneeIds: [],
    schedule: { type: 'weekly', days: [0, 3] }, points: 8, category: 'Bedroom', createdAt: EPOCH,
  },
  {
    id: 'chore_pet', title: 'Feed the pet', emoji: '🐾', assigneeIds: [],
    schedule: { type: 'daily' }, points: 3, category: 'Household', createdAt: EPOCH,
  },
  {
    id: 'chore_reading', title: '20 minutes of reading', emoji: '📚', assigneeIds: [],
    schedule: { type: 'daily' }, points: 10, category: 'Habits', createdAt: EPOCH,
  },
  {
    id: 'chore_water', title: 'Drink enough water', emoji: '💧', assigneeIds: [],
    schedule: { type: 'daily' }, points: 3, category: 'Habits', createdAt: EPOCH,
  },
]

const ROUTINES: Routine[] = [
  {
    id: 'routine_morning', name: 'Morning', emoji: '🌅', timeOfDay: 'morning', assigneeIds: [],
    schedule: { type: 'daily' }, points: 10, createdAt: EPOCH,
    steps: [
      { id: 'step_wake', title: 'Get dressed', emoji: '👕', minutes: 10 },
      { id: 'step_bed', title: 'Make your bed', emoji: '🛏️', minutes: 3 },
      { id: 'step_teeth_am', title: 'Brush teeth', emoji: '🪥', minutes: 2 },
      { id: 'step_breakfast', title: 'Eat breakfast', emoji: '🥣', minutes: 15 },
      { id: 'step_bag', title: 'Pack your bag', emoji: '🎒', minutes: 5 },
    ],
  },
  {
    id: 'routine_evening', name: 'Bedtime', emoji: '🌙', timeOfDay: 'evening', assigneeIds: [],
    schedule: { type: 'daily' }, points: 10, createdAt: EPOCH,
    steps: [
      { id: 'step_tidy', title: 'Tidy up toys', emoji: '🧸', minutes: 10 },
      { id: 'step_pajamas', title: 'Pajamas on', emoji: '🌜', minutes: 5 },
      { id: 'step_teeth_pm', title: 'Brush teeth', emoji: '🪥', minutes: 2 },
      { id: 'step_story', title: 'Read a story', emoji: '📖', minutes: 15 },
      { id: 'step_lights', title: 'Lights out', emoji: '💤', minutes: 1 },
    ],
  },
]

const REWARDS: Reward[] = [
  { id: 'reward_screen', title: '30 min screen time', emoji: '📱', cost: 50, sort: 0, limitPerWeek: 5 },
  { id: 'reward_treat', title: 'Pick a treat', emoji: '🍦', cost: 40, sort: 1 },
  { id: 'reward_movie', title: 'Choose movie night', emoji: '🍿', cost: 75, sort: 2 },
  { id: 'reward_dinner', title: 'Pick dinner', emoji: '🍕', cost: 100, sort: 3 },
  { id: 'reward_stayup', title: 'Stay up 30 min late', emoji: '🌜', cost: 120, sort: 4 },
  { id: 'reward_outing', title: 'Special outing', emoji: '🎡', cost: 250, sort: 5 },
  { id: 'reward_toy', title: 'New toy or book', emoji: '🎁', cost: 400, sort: 6 },
]

export function emptyCore(): Core {
  return {
    people: [],
    schedule: SCHEDULE.map((block) => ({ ...block })),
    chores: CHORES.map((chore) => ({ ...chore })),
    routines: ROUTINES.map((routine) => ({ ...routine, steps: routine.steps.map((step) => ({ ...step })) })),
    todoLists: TODO_LISTS.map((list) => ({ ...list })),
    todos: [],
    meals: {},
    mealRules: [],
    shopping: [],
    rewards: REWARDS.map((reward) => ({ ...reward })),
    events: [],
    recipes: structuredClone(SEED_RECIPES),
    settings: structuredClone(DEFAULT_SETTINGS),
  }
}

export function initialState(): FullState {
  return {
    meta: { rev: 0, updatedAt: new Date().toISOString() },
    core: emptyCore(),
    activity: {},
  }
}

/**
 * Fills in anything a stored blob predates, so an older payload never crashes a
 * newer build. Returns the same object when nothing was missing.
 */
export function migrate(state: FullState): FullState {
  const defaults = emptyCore()
  const core = state.core ?? defaults
  const settings = { ...DEFAULT_SETTINGS, ...(core.settings ?? {}) }
  settings.weather = { ...DEFAULT_SETTINGS.weather, ...(core.settings?.weather ?? {}) }
  settings.sleep = { ...DEFAULT_SETTINGS.sleep, ...(core.settings?.sleep ?? {}) }

  return {
    meta: state.meta ?? { rev: 0, updatedAt: new Date().toISOString() },
    core: {
      people: core.people ?? [],
      schedule: core.schedule ?? defaults.schedule,
      chores: core.chores ?? [],
      routines: core.routines ?? [],
      todoLists: core.todoLists ?? defaults.todoLists,
      todos: core.todos ?? [],
      meals: core.meals ?? {},
      mealRules: core.mealRules ?? [],
      shopping: core.shopping ?? [],
      rewards: core.rewards ?? defaults.rewards,
      events: core.events ?? [],
      recipes: core.recipes ?? defaults.recipes,
      settings,
    },
    activity: state.activity ?? {},
  }
}
