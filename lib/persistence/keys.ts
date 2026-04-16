// Single source of truth for localStorage keys used by app/_components/builder-platform.tsx
// and the Supabase sync layer.
//
// The builder component reads/writes these keys synchronously. The sync layer
// populates them before mount (hydration) and pushes changes back to Supabase
// via the custom storage event the component already dispatches.

export const BRIEF_KEY = 'irie-builder-brief'
export const LAST_GENERATION_KEY = 'irie-builder-last-generation'
export const PASS_HISTORY_KEY = 'irie-builder-pass-history'
export const PENDING_GENERATION_KEY = 'irie-builder-pending-generation' // transient, stays local
export const RAIL_KEY = 'irie-builder-rail-collapsed' // UI preference, stays local
export const STORAGE_EVENT = 'irie-builder-storage'

// Keys that should be migrated from anonymous localStorage into Supabase on rescue.
export const RESCUABLE_KEYS = [BRIEF_KEY, LAST_GENERATION_KEY, PASS_HISTORY_KEY]
