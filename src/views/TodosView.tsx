/** Shared to-do lists — the grown-up counterpart to the kids' chores. */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Todo, TodoList } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { formatDayLabel } from '@shared/date.ts'
import { useApp } from '../lib/store.tsx'
import { Avatar, Empty, Field, SPRING, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet, ConfirmDialog } from '../components/Sheet.tsx'
import { ColorPicker, DangerRow, EmojiPicker } from './editors/parts.tsx'

export function TodosView() {
  const { state, today, dispatch } = useApp()
  const lists = [...state.core.todoLists].sort((a, b) => a.sort - b.sort)
  const [activeId, setActiveId] = useState<string>(() => lists[0]?.id ?? '')
  const [text, setText] = useState('')
  const [editingList, setEditingList] = useState<TodoList | 'new' | null>(null)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)

  const active = lists.find((list) => list.id === activeId) ?? lists[0] ?? null
  const todos = state.core.todos.filter((todo) => todo.listId === active?.id)
  const outstanding = todos.filter((todo) => !todo.done).sort((a, b) => {
    if (Boolean(b.starred) !== Boolean(a.starred)) return b.starred ? 1 : -1
    return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
  })
  const done = todos.filter((todo) => todo.done)

  const add = () => {
    const value = text.trim()
    if (!value || !active) return
    dispatch({
      t: 'todo.upsert',
      todo: { id: newId('td'), listId: active.id, text: value, done: false, createdAt: new Date().toISOString() },
    })
    setText('')
  }

  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">To-dos</span>
          <h1 className="h1">{active?.name ?? 'Lists'}</h1>
        </div>
        <button className="btn btn-soft btn-sm" onClick={() => setEditingList('new')}>
          <Icon name="plus" size={16} /> List
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {lists.map((list) => {
          const count = state.core.todos.filter((todo) => todo.listId === list.id && !todo.done).length
          const on = list.id === active?.id
          return (
            <button
              key={list.id}
              className={`chip${on ? ' chip-on' : ''}`}
              style={on ? { background: list.color, color: '#fff' } : undefined}
              onClick={() => setActiveId(list.id)}
              onDoubleClick={() => setEditingList(list)}
            >
              {list.emoji} {list.name}
              {count > 0 ? <span className="chip-count">{count}</span> : null}
            </button>
          )
        })}
        {active ? (
          <button className="chip" onClick={() => setEditingList(active)} aria-label="Edit list">
            <Icon name="edit" size={15} />
          </button>
        ) : null}
      </div>

      {!active ? (
        <Empty
          emoji="📝"
          title="No lists yet"
          action={
            <button className="btn btn-accent" onClick={() => setEditingList('new')}>
              <Icon name="plus" size={18} /> New list
            </button>
          }
        />
      ) : (
        <>
          <div className="add-bar">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') add()
              }}
              placeholder={`Add to ${active.name}…`}
              enterKeyHint="done"
              aria-label="New to-do"
            />
            <motion.button className="btn btn-accent" onClick={add} whileTap={{ scale: 0.94 }} disabled={!text.trim()}>
              <Icon name="plus" size={18} />
            </motion.button>
          </div>

          {todos.length === 0 ? (
            <Empty emoji="🎈" title="All clear" hint="Nothing on this list right now." />
          ) : (
            <div className="stack" style={{ marginTop: 18 }}>
              <div className="card" style={{ padding: 6 }}>
                <AnimatePresence initial={false}>
                  {outstanding.map((todo) => (
                    <TodoRow key={todo.id} todo={todo} today={today} onEdit={() => setEditingTodo(todo)} />
                  ))}
                </AnimatePresence>
                {outstanding.length === 0 ? (
                  <div className="small" style={{ padding: 20, textAlign: 'center' }}>Everything is done 🎉</div>
                ) : null}
              </div>

              {done.length > 0 ? (
                <div>
                  <div className="row-between" style={{ margin: '10px 2px 8px' }}>
                    <span className="eyebrow">Done ({done.length})</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ t: 'todo.clearDone', listId: active.id })}>
                      Clear
                    </button>
                  </div>
                  <div className="card" style={{ padding: 6, opacity: 0.62 }}>
                    <AnimatePresence initial={false}>
                      {done.map((todo) => (
                        <TodoRow key={todo.id} todo={todo} today={today} onEdit={() => setEditingTodo(todo)} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      <ListEditor
        list={editingList}
        onClose={() => setEditingList(null)}
        onSave={(list) => {
          dispatch({ t: 'todoList.upsert', list })
          setActiveId(list.id)
        }}
        onDelete={(id) => {
          dispatch({ t: 'todoList.remove', id })
          setActiveId(lists.find((list) => list.id !== id)?.id ?? '')
        }}
      />
      <TodoEditor todo={editingTodo} onClose={() => setEditingTodo(null)} />
    </>
  )
}

/* ------------------------------------------------------------------ */

function TodoRow({ todo, today, onEdit }: { todo: Todo; today: string; onEdit: () => void }) {
  const { state, dispatch, celebrate } = useApp()
  const assignee = state.core.people.find((person) => person.id === todo.assigneeId)
  const list = state.core.todoLists.find((entry) => entry.id === todo.listId)
  const overdue = todo.dueDate && !todo.done && todo.dueDate < today

  return (
    <motion.div
      className={`todo-row${todo.done ? ' done' : ''}`}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 34, height: 0 }}
      transition={SPRING}
    >
      <button
        className={`check${todo.done ? ' check-on' : ''}`}
        style={{ '--tint': assignee?.color ?? 'var(--forest)' } as React.CSSProperties}
        onClick={(event) => {
          const done = !todo.done
          dispatch({ t: 'todo.setDone', id: todo.id, done, at: new Date().toISOString() })
          if (done) {
            const box = event.currentTarget.getBoundingClientRect()
            celebrate({
              points: 0,
              x: box.left + box.width / 2,
              y: box.top + box.height / 2,
              color: assignee?.color ?? list?.color ?? 'var(--forest)',
              big: false,
              emoji: list?.emoji ?? '✅',
            })
          }
        }}
        aria-label={todo.done ? `Un-check ${todo.text}` : `Complete ${todo.text}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 9.5 17 19 7.5" />
        </svg>
      </button>

      <button className="todo-main" onClick={onEdit}>
        <span className="todo-text">
          {todo.starred ? '⭐️ ' : ''}
          {todo.text}
        </span>
        {todo.dueDate ? (
          <span className={`todo-due${overdue ? ' overdue' : ''}`}>{formatDayLabel(todo.dueDate, today)}</span>
        ) : null}
      </button>

      {assignee ? <Avatar person={assignee} size={26} /> : null}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */

function TodoEditor({ todo, onClose }: { todo: Todo | null; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const [draft, setDraft] = useState<Todo | null>(todo)
  const [seeded, setSeeded] = useState<string | null>(null)

  if (todo && seeded !== todo.id) {
    setSeeded(todo.id)
    setDraft(structuredClone(todo))
  }

  const patch = (changes: Partial<Todo>) => setDraft((current) => (current ? { ...current, ...changes } : current))

  return (
    <Sheet
      open={todo !== null}
      onClose={onClose}
      title="Edit to-do"
      footer={
        <>
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              if (todo) dispatch({ t: 'todo.remove', id: todo.id })
              onClose()
            }}
          >
            <Icon name="trash" size={17} /> Delete
          </button>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              if (draft?.text.trim()) dispatch({ t: 'todo.upsert', todo: { ...draft, text: draft.text.trim() } })
              onClose()
            }}
          >
            Save
          </button>
        </>
      }
    >
      {draft ? (
        <>
          <Field label="To-do">
            <input value={draft.text} onChange={(event) => patch({ text: event.target.value })} autoFocus />
          </Field>

          <Field label="Due date">
            <input
              type="date"
              value={draft.dueDate ?? ''}
              onChange={(event) => patch({ dueDate: event.target.value || undefined })}
            />
          </Field>

          <Field label="Who is doing it?">
            <div className="row wrap" style={{ gap: 8 }}>
              <button className={`person-pill${!draft.assigneeId ? ' on' : ''}`} onClick={() => patch({ assigneeId: undefined })}>
                <span className="person-pill-all">🤷</span> Anyone
              </button>
              {state.core.people
                .filter((person) => !person.archived)
                .map((person) => (
                  <button
                    key={person.id}
                    className={`person-pill${draft.assigneeId === person.id ? ' on' : ''}`}
                    style={tint(person.color)}
                    onClick={() => patch({ assigneeId: person.id })}
                  >
                    <Avatar person={person} size={26} />
                    {person.name}
                  </button>
                ))}
            </div>
          </Field>

          <div className="row-between" style={{ marginTop: 18 }}>
            <span className="field-label" style={{ margin: 0 }}>⭐️ Star it</span>
            <button
              className={`switch${draft.starred ? ' on' : ''}`}
              style={{ justifyContent: draft.starred ? 'flex-end' : 'flex-start' }}
              onClick={() => patch({ starred: !draft.starred })}
              role="switch"
              aria-checked={Boolean(draft.starred)}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </>
      ) : null}
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

function ListEditor({
  list,
  onClose,
  onSave,
  onDelete,
}: {
  list: TodoList | 'new' | null
  onClose: () => void
  onSave: (list: TodoList) => void
  onDelete: (id: string) => void
}) {
  const { state } = useApp()
  const make = (): TodoList => ({
    id: newId('ls'),
    name: '',
    emoji: '📝',
    color: '#2F6BEA',
    sort: state.core.todoLists.length,
  })

  const key = list === 'new' ? 'new' : (list?.id ?? '')
  const [seeded, setSeeded] = useState<string | null>(null)
  const [draft, setDraft] = useState<TodoList>(make)
  const [confirming, setConfirming] = useState(false)

  if (list && seeded !== key) {
    setSeeded(key)
    setDraft(list === 'new' ? make() : structuredClone(list))
  }

  const patch = (changes: Partial<TodoList>) => setDraft((current) => ({ ...current, ...changes }))

  return (
    <>
      <Sheet
        open={list !== null}
        onClose={onClose}
        title={list === 'new' ? 'New list' : 'Edit list'}
        footer={
          <>
            <button className="btn btn-soft btn-block" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-block"
              disabled={!draft.name.trim()}
              onClick={() => {
                onSave({ ...draft, name: draft.name.trim() })
                onClose()
              }}
            >
              Save
            </button>
          </>
        }
      >
        <Field label="Name">
          <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Household, Errands…" autoFocus />
        </Field>
        <Field label="Colour">
          <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
        </Field>
        <Field label="Icon">
          <EmojiPicker value={draft.emoji} onChange={(emoji) => patch({ emoji })} />
        </Field>

        {list !== 'new' && list ? <DangerRow label="Delete this list" onClick={() => setConfirming(true)} /> : null}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title="Delete this list?"
        message="Everything on it will be removed too."
        onConfirm={() => {
          if (list && list !== 'new') onDelete(list.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}
