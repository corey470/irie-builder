export const PRESET_PLACEHOLDERS = {
  brand: 'Your Brand',
  name: 'Your Name',
  restaurant: 'Your Restaurant',
  event: 'Your Event',
} as const

export type PresetPlaceholderKey = keyof typeof PRESET_PLACEHOLDERS

export const PRESET_PLACEHOLDER_VALUES = Object.values(PRESET_PLACEHOLDERS)
