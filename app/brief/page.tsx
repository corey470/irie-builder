import { BriefPage } from '@/app/_components/builder-platform'
import { PersistenceGate } from '@/app/_components/PersistenceGate'

export default function BriefRoute() {
  return (
    <PersistenceGate>
      <BriefPage />
    </PersistenceGate>
  )
}
