export const MODELS = {
  sonnet: 'claude-sonnet-4-5',
  haiku: 'claude-haiku-4-5-20251001',
} as const

export interface AgentTuning {
  model: (typeof MODELS)[keyof typeof MODELS]
  maxTokens: number
  timeoutMs: number
}

export type AgentKey =
  | 'creativeDirector'
  | 'brandVoice'
  | 'psychologyDirector'
  | 'artDirector'
  | 'motionDirector'
  | 'mobileDirector'
  | 'assembler'
  | 'critic'

export const AGENT_CONFIG: Record<AgentKey, AgentTuning> = {
  creativeDirector: { model: MODELS.sonnet, maxTokens: 500, timeoutMs: 15000 },
  brandVoice: { model: MODELS.sonnet, maxTokens: 800, timeoutMs: 15000 },
  psychologyDirector: { model: MODELS.haiku, maxTokens: 700, timeoutMs: 15000 },
  artDirector: { model: MODELS.sonnet, maxTokens: 800, timeoutMs: 15000 },
  motionDirector: { model: MODELS.haiku, maxTokens: 500, timeoutMs: 15000 },
  mobileDirector: { model: MODELS.haiku, maxTokens: 500, timeoutMs: 15000 },
  assembler: { model: MODELS.haiku, maxTokens: 3500, timeoutMs: 27000 },
  critic: { model: MODELS.haiku, maxTokens: 900, timeoutMs: 8000 },
}

export const TOTAL_BUDGET_MS = 55000
