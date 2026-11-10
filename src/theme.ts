/**
 * Theme: Midnight Signal
 * Premium network diagnostics and infrastructure monitoring color system.
 */

export const THEME = {
  bg: {
    main: '#060709',       // Pure black main background
    secondary: '#0D0E12',  // Dark grey secondary background
    card: '#13141A',       // Card and panel surface
    elevated: '#1B1D26',   // Elevated card surface
    input: '#090A0E',      // Recessed input field background
    hover: '#1F222E',
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
