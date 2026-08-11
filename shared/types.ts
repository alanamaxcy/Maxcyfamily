/**
 * Shared data model. Imported by both the React client and the Netlify
 * functions so a mutation means exactly the same thing on either side.
 */

import type { Recipe } from './recipes.ts'

export type { Recipe }

export type ISODate = string // 'YYYY-MM-DD'
export type ISODateTime = string // full ISO 8601 instant
export type MonthKey = string // 'YYYY-MM'
export type ID = string

export type Role = 'parent' | 'child'

export interface Person {
  id: ID
  name: string
  role: Role
  /** Hex colour used for calendar chips, avatars and progress rings. */
  color: string
  /** Emoji shown in the avatar bubble, or a photo id uploaded via settings. */
  emoji: string
  photoId?: ID
  points: number
  birthday?: ISODate
  /** Order in the Today columns / profile picker. */
  sort: number
  archived?: boolean
}

/** When a chore or routine is expected. */
export type Schedule =
  | { type: 'daily' }
  /** days: 0 = Sunday … 6 = Saturday */
  | { type: 'weekly'; days: number[] }
  | { type: 'once'; date: ISODate }
  /** Every n days counting from startDate. */
  | { type: 'everyN'; n: number; startDate: ISODate }
  /**
   * On these weekdays, but only every n-th week — "every other Monday".
   * Week alignment is anchored to the Sunday of startDate's week so it does
   * not drift when the household changes its week-starts-on preference.
   */
  | { type: 'weeklyN'; days: number[]; everyWeeks: number; startDate: ISODate }

export interface Chore {
  id: ID
  title: string
  emoji: string
  /** Empty = anyone in the family can claim it. */
  assigneeIds: ID[]
  schedule: Schedule
  points: number
  /** Free-text grouping shown as a section header, e.g. 'Kitchen'. */
  category?: string
  notes?: string
  archived?: boolean
  createdAt: ISODateTime
}

export interface RoutineStep {
  id: ID
  title: string
  emoji: string
  minutes?: number
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

export interface Routine {
  id: ID
  name: string
  emoji: string
  timeOfDay: TimeOfDay
  assigneeIds: ID[]
  steps: RoutineStep[]
  schedule: Schedule
  /** Bonus awarded once, when every step is ticked for the day. */
  points: number
  archived?: boolean
  createdAt: ISODateTime
}

/**
 * A recurring block in the day's rhythm — "9:00 Math", "12:30 Lunch".
 *
 * Distinct from calendar events on purpose: these are the shape of a normal
 * homeschool day, they repeat by weekday, and they're owned and edited here
 * rather than in Google Calendar.
 */
export interface ScheduleBlock {
  id: ID
  title: string
  emoji: string
  /** 'HH:MM' in 24h, household-local. */
  startTime: string
  endTime: string
  color: string
  /** Empty = the whole family. */
  personIds: ID[]
  schedule: Schedule
  notes?: string
  archived?: boolean
  sort: number
}

export interface TodoList {
  id: ID
  name: string
  emoji: string
  color: string
  sort: number
}

export interface Todo {
  id: ID
  listId: ID
  text: string
  done: boolean
  assigneeId?: ID
  dueDate?: ISODate
  starred?: boolean
  createdAt: ISODateTime
  completedAt?: ISODateTime
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner'

export interface Meal {
  title: string
  emoji?: string
  notes?: string
  ingredients?: string[]
  /** Who is cooking. */
  cookId?: ID
}

export type DayMeals = Partial<Record<MealSlot, Meal>> & {
  note?: string
  /** Slots deliberately cleared, so a repeating meal stays off for this day. */
  skipped?: MealSlot[]
}

/**
 * A meal that comes back on a schedule — "spaghetti every other Monday".
 * An explicit meal on a date always wins over the rule.
 */
export interface MealRule {
  id: ID
  slot: MealSlot
  meal: Meal
  schedule: Schedule
  archived?: boolean
}

export type ShoppingCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'bakery'
  | 'frozen'
  | 'pantry'
  | 'drinks'
  | 'household'
  | 'other'

export interface ShoppingItem {
  id: ID
  text: string
  qty?: string
  category: ShoppingCategory
  done: boolean
  addedById?: ID
  /** Set when the item came from a meal plan, so we can show its origin. */
  fromMeal?: string
  createdAt: ISODateTime
}

export interface Reward {
  id: ID
  title: string
  emoji: string
  cost: number
  description?: string
  /** Optional cap so nobody redeems screen time six times on a Saturday. */
  limitPerWeek?: number
  archived?: boolean
  sort: number
}

export type RedemptionStatus = 'pending' | 'fulfilled' | 'cancelled'

export interface Redemption {
  id: ID
  rewardId: ID
  /** Snapshot so history still reads correctly if the reward is edited. */
  rewardTitle: string
  rewardEmoji: string
  personId: ID
  cost: number
  status: RedemptionStatus
  at: ISODateTime
  resolvedAt?: ISODateTime
}

export type LedgerRef = 'chore' | 'routine' | 'reward' | 'manual' | 'adjustment'

export interface LedgerEntry {
  id: ID
  personId: ID
  /** Positive = earned, negative = spent. */
  delta: number
  reason: string
  refType: LedgerRef
  /** Stable key used to prevent double-awarding, e.g. 'chore:c1:p2:2026-08-09'. */
  refKey?: string
  at: ISODateTime
  /** True once a parent has undone it; balance already reversed. */
  voided?: boolean
}

export type EventRepeat =
  | { type: 'none' }
  | { type: 'daily'; until?: ISODate }
  | { type: 'weekly'; days: number[]; until?: ISODate }
  | { type: 'monthly'; until?: ISODate }

export interface LocalEvent {
  id: ID
  title: string
  /** For all-day events these are plain 'YYYY-MM-DD' strings. */
  start: string
  end: string
  allDay: boolean
  personIds: ID[]
  location?: string
  notes?: string
  color?: string
  repeat: EventRepeat
  createdAt: ISODateTime
}

/** A tick on a chore or a single routine step. */
export interface Completion {
  byId: ID
  at: ISODateTime
}

export interface CalendarFeed {
  id: ID
  name: string
  /** Secret iCal/ICS subscription URL from Google / Apple / Outlook. */
  url: string
  color: string
  enabled: boolean
  /** Optional: attribute this whole feed to one person. */
  personId?: ID
}

export interface SleepPhoto {
  id: ID
  /** Either an uploaded blob id (served by /api/photos) or an external URL. */
  photoId?: ID
  url?: string
  caption?: string
}

export interface Settings {
  householdName: string
  timezone: string
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: number
  theme: 'light' | 'dark' | 'auto'
  calendars: CalendarFeed[]
  weather: {
    latitude: number
    longitude: number
    label: string
    units: 'F' | 'C'
  }
  sleep: {
    enabled: boolean
    idleMinutes: number
    /** Seconds each photo stays on screen. */
    intervalSeconds: number
    showClock: boolean
    showNextEvent: boolean
    showWeather: boolean
    photos: SleepPhoto[]
  }
  /** Empty string = no lock (the default). Set it to require a PIN to open the app. */
  pin: string
  /** Show the confetti burst when a kid completes something. */
  celebrate: boolean
  /** Merge connected-calendar events into the Schedule view's timeline. */
  scheduleShowsEvents: boolean
}

/** Definitional + slow-moving data. Small enough to ship on every change. */
export interface Core {
  people: Person[]
  schedule: ScheduleBlock[]
  chores: Chore[]
  routines: Routine[]
  todoLists: TodoList[]
  todos: Todo[]
  meals: Record<ISODate, DayMeals>
  mealRules: MealRule[]
  shopping: ShoppingItem[]
  rewards: Reward[]
  events: LocalEvent[]
  recipes: Recipe[]
  settings: Settings
}

/** Append-heavy data, bucketed by month so the payload stays bounded. */
export interface ActivityMonth {
  /** date -> completion key -> completion */
  completions: Record<ISODate, Record<string, Completion>>
  ledger: LedgerEntry[]
  redemptions: Redemption[]
}

export interface Meta {
  rev: number
  updatedAt: ISODateTime
}

export interface FullState {
  meta: Meta
  core: Core
  activity: Record<MonthKey, ActivityMonth>
}

/* ------------------------------------------------------------------ */
/* Calendar + weather payloads (derived, never stored as source of truth) */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
  notes?: string
  color: string
  /** Feed id, or 'local' for events created in the app. */
  source: string
  sourceName: string
  personIds: ID[]
}

export interface CalendarResponse {
  events: CalendarEvent[]
  fetchedAt: ISODateTime
  errors: { feedId: string; name: string; message: string }[]
}

export interface WeatherNow {
  temp: number
  feelsLike: number
  code: number
  isDay: boolean
  windSpeed: number
  humidity: number
}

export interface WeatherHour {
  time: ISODateTime
  temp: number
  code: number
  precipProbability: number
}

export interface WeatherDay {
  date: ISODate
  high: number
  low: number
  code: number
  precipProbability: number
  sunrise: ISODateTime
  sunset: ISODateTime
}

export interface WeatherResponse {
  now: WeatherNow
  hourly: WeatherHour[]
  daily: WeatherDay[]
  units: 'F' | 'C'
  label: string
  fetchedAt: ISODateTime
}
