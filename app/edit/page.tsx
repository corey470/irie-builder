import { TunerEditor } from '@/app/_components/tuner/TunerEditor'
import { PersistenceGate } from '@/app/_components/PersistenceGate'

export default function EditRoute() {
  return (
    <PersistenceGate>
      <TunerEditor />
    </PersistenceGate>
  )
}
