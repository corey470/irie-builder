import { PublishPage } from '@/app/_components/builder-platform'
import { PersistenceGate } from '@/app/_components/PersistenceGate'

export default function PublishRoute() {
  return (
    <PersistenceGate>
      <PublishPage />
    </PersistenceGate>
  )
}
