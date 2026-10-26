// Shared Tailwind class strings for the reservation screens, built from the tokens in Design.md.

export const panel = 'p-6 sm:p-8 rounded-card bg-canvas border border-hairline';
export const softPanel = 'p-6 sm:p-8 rounded-card bg-canvas-soft';

const button =
  'inline-flex items-center justify-center gap-2 rounded-full font-strong whitespace-nowrap transition-colors disabled:opacity-40';
export const primaryButton = `${button} min-h-[48px] px-6 text-[15px] bg-primary text-on-primary hover:bg-primary-hover`;
export const outlineButton = `${button} min-h-[44px] px-5 text-[15px] bg-canvas text-ink border border-hairline hover:border-ink`;
export const softButton = `${button} min-h-[40px] px-4 text-sm bg-canvas-soft text-ink hover:bg-hairline`;
export const dangerButton = `${button} min-h-[48px] px-6 text-[15px] bg-danger text-white hover:brightness-95`;
export const dangerOutlineButton = `${button} min-h-[40px] px-4 text-sm bg-canvas text-danger border border-hairline hover:border-danger`;
export const iconButton =
  'inline-grid place-items-center w-9 h-9 rounded-full bg-canvas-soft text-ink hover:bg-hairline transition-colors';

export const fieldLabel = 'block mb-2 text-[13px] font-strong text-muted';
export const sectionTitle = 'text-2xl font-heading leading-tight text-ink';

// Seat and booking status pills: monochrome, read from the label.
const pill = 'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-strong whitespace-nowrap';
export const pillConfirmed = `${pill} bg-primary text-on-primary`;
export const pillRac = `${pill} bg-canvas-soft text-ink shadow-[inset_0_0_0_1px_var(--hairline)]`;
export const pillWaitlist = `${pill} text-muted shadow-[inset_0_0_0_1px_var(--hairline)]`;
export const pillPending = `${pill} bg-canvas text-ink shadow-[inset_0_0_0_1px_var(--ink)]`;
export const pillCancelled = `${pill} bg-danger-soft text-danger`;
export const pillNeutral = `${pill} bg-canvas-soft text-ink`;
export const pillOnSoft = `${pill} bg-canvas text-ink`;
