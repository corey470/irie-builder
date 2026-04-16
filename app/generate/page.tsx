import { GeneratePage } from '@/app/_components/builder-platform'
import { PersistenceGate } from '@/app/_components/PersistenceGate'

export default function GenerateRoute() {
  return (
    <PersistenceGate>
      <GeneratePage />
    </PersistenceGate>
  )
}
