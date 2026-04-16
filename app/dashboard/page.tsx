import { ProjectsHomePage } from '@/app/_components/builder-platform'
import { PersistenceGate } from '@/app/_components/PersistenceGate'

export default function DashboardPage() {
  return (
    <PersistenceGate>
      <ProjectsHomePage />
    </PersistenceGate>
  )
}
