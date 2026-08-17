// ============================================================================
// Shared UI primitives — chips, badges, modal, toasts (product register)
// Consistent state vocabulary: default / hover / focus / active / disabled.
// ============================================================================
import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Status } from '@/types'
import { useStore } from '@/store/appStore'

// Status chip palette (§15.2) — softened, ring-based for a calmer surface
const STATUS_CLASS: Record<Status, string> = {
  not_started: 'bg-slate-50 text-slate-600 ring-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  sent_back: 'bg-orange-50 text-orange-700 ring-orange-200',
  on_hold: 'bg-purple-50 text-purple-700 ring-purple-200',
  pending_checker: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
}
const STATUS_DOT: Record<Status, string> = {
  not_started: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  pending: 'bg-amber-500',
  completed: 'bg-emerald-500',
  sent_back: 'bg-orange-500',
  on_hold: 'bg-purple-500',
  pending_checker: 'bg-indigo-500',
  rejected: 'bg-red-500',
}
const STATUS_LABEL: Record<Status, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  pending: 'Pending',
  completed: 'Completed',
  sent_back: 'Sent back',
  on_hold: 'On hold',
  pending_checker: 'Pending checker',
  rejected: 'Rejected',
}

export function StatusChip({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-11 font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

type Tone = 'slate' | 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'indigo' | 'orange' | 'teal'
const TONE: Record<Tone, string> = {
  slate: 'bg-slate-50 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
}

export function Chip({
  children,
  tone = 'slate',
  title,
}: {
  children: ReactNode
  tone?: Tone
  title?: string
}) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-11 font-medium ring-1 ring-inset ${TONE[tone]}`}>
      {children}
    </span>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-auto bg-slate-900/40 p-6 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className={`mt-16 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} animate-modal-in overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-14 font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-11 font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-13 transition-colors focus:border-brand-400"
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-13 transition-colors focus:border-brand-400"
    />
  )
}

export function Btn({
  children,
  onClick,
  tone = 'default',
  size = 'md',
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
  title?: string
}) {
  const tones: Record<string, string> = {
    default: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100',
    primary: 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700 hover:border-brand-700 active:bg-brand-800 shadow-sm',
    danger: 'border-red-300 bg-white text-red-600 hover:bg-red-50 hover:border-red-400 active:bg-red-100',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  }
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-all duration-150 ${tones[tone]} ${
        size === 'sm' ? 'px-2 py-1 text-12' : 'px-3 py-1.5 text-13'
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white`}
    >
      {children}
    </button>
  )
}

export function MatchChip({ match }: { match: 'pass' | 'fail' | 'pending' }) {
  if (match === 'pass')
    return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700" title="pass">✓</span>
  if (match === 'fail')
    return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-700" title="fail">✗</span>
  return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-400" title="pending">–</span>
}

export function Toaster() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} id={t.id} kind={t.kind} message={t.message} onDone={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastCard({
  id,
  kind,
  message,
  onDone,
}: {
  id: string
  kind: string
  message: string
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200)
    return () => clearTimeout(t)
  }, [id, onDone])
  const tone: Record<string, string> = {
    success: 'border-emerald-200 bg-white text-emerald-800',
    error: 'border-red-200 bg-white text-red-800',
    info: 'border-blue-200 bg-white text-blue-800',
    warn: 'border-amber-200 bg-white text-amber-800',
  }
  const dot: Record<string, string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warn: 'bg-amber-500',
  }
  return (
    <div
      onClick={onDone}
      className={`pointer-events-auto flex animate-toast-in cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-13 shadow-pop ${tone[kind] ?? tone.info}`}
    >
      <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${dot[kind] ?? dot.info}`} />
      <span className="leading-snug text-slate-700">{message}</span>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-12 text-center text-13 text-slate-400">{children}</div>
}
