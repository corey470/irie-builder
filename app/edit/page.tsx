import { EditorPage } from '@/app/_components/builder-platform'
import { PersistenceGate } from '@/app/_components/PersistenceGate'

export default function EditRoute() {
  return (
    <PersistenceGate>
      <EditorPage />
    </PersistenceGate>
  )
}
