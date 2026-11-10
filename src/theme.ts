/**
 * Theme: Midnight Signal
 * Premium network diagnostics and infrastructure monitoring color system.
 */

export const THEME = {
  bg: {
    main: '#090E17',
    secondary: '#0F1724',
    card: '#131D2B',
    elevated: '#1B293A',
    input: '#0C1420',
    hover: '#182435',
  },
  accent: {
    primary: '#22D3EE',    // Electric Cyan
    secondary: '#67E8F9',  // Soft Cyan
  },
  semantic: {
    success: '#34D399',    // Verified / Emerald
    error: '#FB7185',      // Failed / Rose
    warning: '#FBBF24',    // Blocked / Amber
    neutral: '#94A3B8',    // Pending / Slate
  },
  text: {
    primary: '#E8EEF6',
    secondary: '#94A3B8',
    muted: '#64748B',
  },
  border: {
    default: '#263548',
    focus: '#22D3EE',
    subtle: '#1B293A',
  },
} as const;
