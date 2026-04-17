'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getOrCreateCurrentProject,
  hydrateLocalStorage,
  attachSupabaseSync,
} from '@/lib/persistence'
import { emitPersistenceStatus } from '@/lib/persistence/status'

type GateStatus = 'booting' | 'rescuing' | 'ready' | 'anonymous'

/**
 * Wraps every authenticated page. Before rendering children:
 *  1. If the user is signed in, load their project from Supabase (creating one
 *     and rescuing legacy localStorage data on first visit).
 *  2. Hydrate localStorage so the existing builder components pick up the
 *     Supabase-backed state synchronously on mount.
 *  3. Attach a storage-event listener that mirrors local writes back to
 *     Supabase (brief autosave, generation inserts).
 *
 * If the user is not signed in (e.g. gating off during Phase B/C previews),
 * render children immediately in localStorage-only mode.
 */
export function PersistenceGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>('booting')

  useEffect(() => {
    let cancelled = false
    let detach: (() => void) | undefined

    async function boot() {
      emitPersistenceStatus('booting', 'Connecting your workspace…')
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        emitPersistenceStatus('local-only', 'Local-only mode')
        if (!cancelled) setStatus('anonymous')
        return
      }

      try {
        const { project, rescued } = await getOrCreateCurrentProject(
          supabase,
          user.id,
        )
        if (rescued && !cancelled) setStatus('rescuing')
        if (rescued) emitPersistenceStatus('saving', 'Restoring your latest work…')
        await hydrateLocalStorage(supabase, project)
        detach = attachSupabaseSync(supabase, user.id, project.id)
        emitPersistenceStatus('saved', 'Saved')
        if (!cancelled) setStatus('ready')
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[persistence] boot failed', err)
        // Fall through to anonymous mode so the app is still usable.
        emitPersistenceStatus('offline', 'Offline — changes stored locally')
        if (!cancelled) setStatus('anonymous')
      }
    }

    void boot()

    return () => {
      cancelled = true
      detach?.()
    }
  }, [])

  if (status === 'booting') {
    return <GateLoading message="One moment…" />
  }
  if (status === 'rescuing') {
    return <GateLoading message="Pulling your work into your account…" />
  }
  return <>{children}</>
}

function GateLoading({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        background: '#080808',
        color: '#F2EDE4',
        fontFamily: "'Syne', system-ui, sans-serif",
        fontSize: '14px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      {message}
    </div>
  )
}
