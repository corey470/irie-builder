'use client'

import { useEffect, useState } from 'react'

export type PersistenceStatus =
  | 'booting'
  | 'saved'
  | 'saving'
  | 'unsaved'
  | 'offline'
  | 'local-only'
  | 'error'

export const PERSISTENCE_STATUS_EVENT = 'irie-builder-persistence'

type PersistenceStatusDetail = {
  status: PersistenceStatus
  message?: string
}

export function emitPersistenceStatus(status: PersistenceStatus, message?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<PersistenceStatusDetail>(PERSISTENCE_STATUS_EVENT, {
      detail: { status, message },
    }),
  )
}

export function usePersistenceStatus() {
  const [state, setState] = useState<PersistenceStatusDetail>({
    status: 'saved',
    message: 'Saved',
  })

  useEffect(() => {
    function handle(event: Event) {
      const detail = (event as CustomEvent<PersistenceStatusDetail>).detail
      if (!detail?.status) return
      setState(detail)
    }

    window.addEventListener(PERSISTENCE_STATUS_EVENT, handle as EventListener)
    return () => window.removeEventListener(PERSISTENCE_STATUS_EVENT, handle as EventListener)
  }, [])

  return state
}
