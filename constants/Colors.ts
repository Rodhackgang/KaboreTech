const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    // Base
    white: '#FFFFFF',
    black: '#000000',
    gray: '#F1F1F1',

    // Text & Background
    text: '#11181C',
    background: '#FFFFFF',

    // UI
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,

    // Semantic
    primary: '#0a7ea4',
    secondary: '#64748b',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#facc15',
    info: '#3b82f6',

    // Neutrals
    neutral100: '#f5f5f5',
    neutral200: '#e5e5e5',
    neutral300: '#d4d4d4',
    neutral400: '#a3a3a3',
    neutral500: '#737373'
  },

  dark: {
    // Base
    white: '#FFFFFF',
    black: '#000000',
    gray: '#1e1e1e',

    // Text & Background
    text: '#ECEDEE',
    background: '#151718',

    // UI
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // Semantic
    primary: '#38bdf8',
    secondary: '#94a3b8',
    success: '#4ade80',
    error: '#f87171',
    warning: '#fde047',
    info: '#60a5fa',

    // Neutrals
    neutral100: '#1f2937',
    neutral200: '#374151',
    neutral300: '#4b5563',
    neutral400: '#6b7280',
    neutral500: '#9ca3af'
  }
};
