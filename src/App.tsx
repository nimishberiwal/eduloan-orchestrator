import { useStore } from '@/store/appStore'
import { Sidebar } from '@/components/common/Sidebar'
import { Header } from '@/components/common/Header'
import { Toaster } from '@/components/common/ui'
import { Kanban } from '@/components/Kanban/Kanban'
import { Queues } from '@/components/Queues/Queues'
import { App360 } from '@/components/App360/App360'
import { Analytics } from '@/components/Analytics/Analytics'
import { Batches } from '@/components/Batches/Batches'
import { Reports } from '@/components/Reports/Reports'
import { Automation } from '@/components/Automation/Automation'
import { CommComposer } from '@/components/CRM/CommComposer'

export default function App() {
  const tab = useStore((s) => s.tab)
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-hidden">
          {tab === 'pipeline' && <Kanban />}
          {tab === 'queues' && <Queues />}
          {tab === 'batches' && <Batches />}
          {tab === 'app360' && <App360 />}
          {tab === 'analytics' && <Analytics />}
          {tab === 'reports' && <Reports />}
          {tab === 'automation' && <Automation />}
        </main>
      </div>
      <CommComposer />
      <Toaster />
    </div>
  )
}
