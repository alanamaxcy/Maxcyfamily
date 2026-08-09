/** Bottom sheet + centred dialog. Both trap focus and close on Escape. */

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton, SOFT_SPRING } from './ui.tsx'

function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  useDismiss(open, onClose)

  useEffect(() => {
    if (open) panel.current?.focus()
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
        >
          <motion.div
            className="sheet"
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SOFT_SPRING}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_event, info) => {
              // A decisive downward flick closes it, matching iOS muscle memory.
              if (info.offset.y > 140 || info.velocity.y > 620) onClose()
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-grab" />
            <div className="sheet-head">
              <div style={{ minWidth: 0 }}>
                <h2 className="h2 truncate">{title}</h2>
                {subtitle ? <p className="small truncate">{subtitle}</p> : null}
              </div>
              <IconButton icon="close" label="Close" onClick={onClose} filled />
            </div>
            <div className="sheet-body">{children}</div>
            {footer ? <div className="sheet-foot">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function Dialog({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  useDismiss(open, onClose)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="scrim scrim-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="dialog"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={SOFT_SPRING}
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <h3 className="h2">{title}</h3>
      {message ? <p className="body" style={{ marginTop: 10 }}>{message}</p> : null}
      <div className="row" style={{ marginTop: 26, gap: 10 }}>
        <button className="btn btn-soft btn-block" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn btn-block ${destructive ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
