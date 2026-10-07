import { lazy, Suspense } from 'react'
import ProgressHeader from '../ProgressHeader'
import { Loader2 } from 'lucide-react'

const AddAccountPage = lazy(() => import('../../../pages/AddAccountPage'))

export default function StepWalletSetup({ onBack, onSuccess }) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="px-4 sm:px-6">
        <ProgressHeader step={3} total={4} />
      </div>
      <div className="flex-1 min-h-0 w-full">
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-[var(--accent)]" size={28} />
            </div>
          }
        >
          <AddAccountPage
            isOnboarding
            onBack={onBack}
            onSuccess={onSuccess}
          />
        </Suspense>
      </div>
    </div>
  )
}
