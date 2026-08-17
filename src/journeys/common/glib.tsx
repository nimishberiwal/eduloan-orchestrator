// ============================================================================
// Glib.money UI primitives (§3, §21).
//
// Quality floor these enforce so screens don't have to remember:
//   · 44px minimum touch targets
//   · 2px --glib-blue focus ring at 2px offset (declared once in index.css)
//   · ₹ with Indian grouping and tabular-nums; US$ always labelled
//   · buttons name the OUTCOME, so the label is always caller-supplied text
// ============================================================================
import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'

// ---- Money & numbers -------------------------------------------------------

/** ₹ with Indian digit grouping, tabular figures. Never rounds silently. */
export function inrFull(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

/** Compact ₹ for headline figures — ₹45.0L / ₹1.00Cr. */
export function inrShort(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`
  return inrFull(n)
}

/** USD is ALWAYS labelled US$ so it can never read as rupees (§21). */
export function usdFull(n: number): string {
  return 'US$' + Math.round(n).toLocaleString('en-US')
}

export function Money({ inr, className = '' }: { inr: number; className?: string }) {
  return <span className={`num ${className}`}>{inrFull(inr)}</span>
}

/** "about 2 minutes" — an estimate a person can act on, not a raw number. */
export function humanSeconds(s: number): string {
  if (s < 60) return 'under a minute'
  const m = Math.round(s / 60)
  if (m === 1) return 'about a minute'
  if (m < 60) return `about ${m} minutes`
  const h = Math.round(m / 60)
  return h === 1 ? 'about an hour' : `about ${h} hours`
}

// ---- Buttons ---------------------------------------------------------------

type BtnTone = 'primary' | 'secondary' | 'quiet' | 'danger'

const BTN_TONE: Record<BtnTone, string> = {
  primary:
    'bg-[var(--glib-blue)] text-white border-[var(--glib-blue)] hover:bg-[var(--blue-700)] hover:border-[var(--blue-700)] active:bg-[var(--blue-700)]',
  secondary:
    'bg-white text-[var(--glib-grey)] border-[var(--grey-300)] hover:bg-[var(--blue-grey)] active:bg-[var(--blue-grey)]',
  quiet:
    'bg-transparent text-[var(--glib-blue)] border-transparent hover:bg-[var(--blue-100)] active:bg-[var(--blue-100)]',
  danger:
    'bg-white text-[var(--stop)] border-[color:var(--stop)] hover:bg-[#fdf3f2] active:bg-[#fbe9e7]',
}

export function GButton({
  children,
  tone = 'primary',
  block,
  size = 'md',
  ...rest
}: {
  children: ReactNode
  tone?: BtnTone
  block?: boolean
  size?: 'md' | 'sm'
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition-colors duration-150',
        // 44px minimum touch target (§21)
        size === 'md' ? 'min-h-[48px] px-5 text-[15px]' : 'min-h-[44px] px-4 text-[14px]',
        block ? 'w-full' : '',
        BTN_TONE[tone],
        'disabled:cursor-not-allowed disabled:opacity-45',
        rest.className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** A whole card that behaves as one button — the task-row pattern. */
export function GRowButton({
  children,
  ...rest
}: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={[
        'w-full rounded-xl border border-[var(--grey-300)] bg-white p-4 text-left transition-colors duration-150',
        'hover:border-[var(--glib-blue)] hover:bg-[var(--blue-100)]/40 active:bg-[var(--blue-100)]',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--grey-300)] disabled:hover:bg-white',
        rest.className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ---- Surfaces --------------------------------------------------------------

export function GCard({
  children,
  className = '',
  tone = 'plain',
}: {
  children: ReactNode
  className?: string
  tone?: 'plain' | 'support' | 'info' | 'warn' | 'ok' | 'stop'
}) {
  const tones: Record<string, string> = {
    plain: 'border-[var(--grey-300)] bg-white',
    support: 'border-transparent bg-[var(--blue-grey)]',
    info: 'border-[color:var(--glib-blue)]/25 bg-[var(--blue-100)]',
    warn: 'border-[color:var(--warn)]/35 bg-[#fdf6ea]',
    ok: 'border-[color:var(--ok)]/30 bg-[#eef7f2]',
    stop: 'border-[color:var(--stop)]/30 bg-[#fdf3f2]',
  }
  return <div className={`rounded-xl border p-4 ${tones[tone]} ${className}`}>{children}</div>
}

/** A short explanatory block. Never a modal, never a footnote. */
export function Callout({
  title,
  children,
  tone = 'info',
}: {
  title?: string
  children: ReactNode
  tone?: 'info' | 'warn' | 'ok' | 'stop' | 'support'
}) {
  return (
    <GCard tone={tone}>
      {title ? <p className="display mb-1 text-[15px] font-semibold">{title}</p> : null}
      <div className="text-[14px] leading-[21px] text-[var(--glib-grey)]">{children}</div>
    </GCard>
  )
}

// ---- Headings & layout -----------------------------------------------------

export function ScreenTitle({
  title,
  intro,
  eyebrow,
}: {
  title: string
  intro?: string
  eyebrow?: string
}) {
  return (
    <header className="mb-5">
      {eyebrow ? (
        <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--grey-600)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="display text-[22px] font-bold leading-[28px] text-[var(--glib-grey)]">
        {title}
      </h1>
      {intro ? (
        <p className="mt-2 text-[15px] leading-[22px] text-[var(--grey-600)]">{intro}</p>
      ) : null}
    </header>
  )
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="display mb-3 text-[18px] font-semibold leading-6 text-[var(--glib-grey)]">
      {children}
    </h2>
  )
}

/** The sticky action bar every long screen ends with. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t border-[var(--grey-300)] bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

// ---- Form fields -----------------------------------------------------------

export function GField({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[13px] font-semibold leading-[18px] text-[var(--glib-grey)]"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-[12px] leading-4 text-[var(--grey-600)]">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-[12px] leading-4 text-[var(--stop)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const INPUT_BASE =
  'w-full min-h-[48px] rounded-xl border border-[var(--grey-300)] bg-white px-3.5 text-[15px] text-[var(--glib-grey)] placeholder:text-[var(--grey-300)] transition-colors hover:border-[var(--grey-600)]'

export function GInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_BASE} ${props.className ?? ''}`} />
}

export function GNumber({
  value,
  onValue,
  prefix,
  ...rest
}: {
  value: number | ''
  onValue: (n: number) => void
  prefix?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-[var(--grey-600)]">
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        inputMode="numeric"
        value={value === '' ? '' : String(value)}
        onChange={(e) => onValue(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
        className={`${INPUT_BASE} num ${prefix ? 'pl-9' : ''}`}
      />
    </div>
  )
}

export function GSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${INPUT_BASE} appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%235A6169' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10 ${props.className ?? ''}`}
    />
  )
}

/** A large tappable choice — the mobile alternative to a radio group. */
export function GChoice({
  selected,
  title,
  detail,
  onClick,
  disabled,
}: {
  selected: boolean
  title: string
  detail?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'flex w-full min-h-[52px] items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
        selected
          ? 'border-[var(--glib-blue)] bg-[var(--blue-100)]'
          : 'border-[var(--grey-300)] bg-white hover:bg-[var(--blue-grey)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-[var(--glib-blue)]' : 'border-[var(--grey-300)]',
        ].join(' ')}
      >
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--glib-blue)]" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-[21px]">{title}</span>
        {detail ? (
          <span className="mt-0.5 block text-[13px] leading-[18px] text-[var(--grey-600)]">
            {detail}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function GCheckbox({
  checked,
  onChange,
  children,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  id?: string
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5 text-[14px] leading-[21px]"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[var(--glib-blue)]"
      />
      <span className="min-w-0">{children}</span>
    </label>
  )
}

// ---- Chips & meta ----------------------------------------------------------

type ChipTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'stop'
const CHIP: Record<ChipTone, string> = {
  neutral: 'bg-[var(--blue-grey)] text-[var(--grey-600)]',
  accent: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
  ok: 'bg-[#eef7f2] text-[var(--ok)]',
  warn: 'bg-[#fdf6ea] text-[var(--warn)]',
  stop: 'bg-[#fdf3f2] text-[var(--stop)]',
}

export function GChip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: ChipTone
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold leading-4 ${CHIP[tone]}`}
    >
      {children}
    </span>
  )
}

/** A labelled read-only value pair — used all over the offer and sanction. */
export function DataRow({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--blue-grey)] py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[14px] leading-5 text-[var(--grey-600)]">{label}</p>
        {hint ? <p className="text-[12px] leading-4 text-[var(--grey-600)]">{hint}</p> : null}
      </div>
      <div className="num shrink-0 text-right text-[15px] font-semibold leading-5 text-[var(--glib-grey)]">
        {value}
      </div>
    </div>
  )
}

// ---- States (§21: every screen has loading / empty / error) ----------------

export function GEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--grey-300)] px-4 py-10 text-center">
      <p className="display text-[16px] font-semibold text-[var(--glib-grey)]">{title}</p>
      {children ? (
        <div className="mx-auto mt-2 max-w-[36ch] text-[14px] leading-[21px] text-[var(--grey-600)]">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function GLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-8">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--blue-grey)] border-t-[var(--glib-blue)]" />
      <span className="text-[14px] text-[var(--grey-600)]">{label}…</span>
    </div>
  )
}

/** Errors say what happened and what to do — never "Oops", never an apology. */
export function GError({
  what,
  action,
  onAction,
}: {
  what: string
  action?: string
  onAction?: () => void
}) {
  return (
    <GCard tone="stop">
      <p className="text-[14px] leading-[21px] text-[var(--glib-grey)]">{what}</p>
      {action && onAction ? (
        <button
          onClick={onAction}
          className="mt-2 min-h-[44px] text-[14px] font-semibold text-[var(--stop)] underline underline-offset-2"
        >
          {action}
        </button>
      ) : null}
    </GCard>
  )
}
