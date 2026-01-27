import { JSX } from 'react'
import { EditorCanvas } from './EditorCanvas'
import type { OverlaySavePayload } from './types'
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'

interface EditorModalProps {
  isOpen: boolean
  onClose: () => void
  filePath: string
  strategyId: StrategyType
  initialState?: object
  initialOverlaySettings?: OverlaySettings
  initialProfileSettings?: StrategyProfileSettings
  onSave: (payload: OverlaySavePayload) => void
}

export const EditorModal = ({
  isOpen,
  onClose,
  filePath,
  strategyId,
  initialState,
  initialOverlaySettings,
  initialProfileSettings,
  onSave
}: EditorModalProps): JSX.Element | null => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-gray-900 shadow-2xl ring-1 ring-white/10">
        <EditorCanvas
          filePath={filePath}
          strategyId={strategyId}
          initialState={initialState}
          initialOverlaySettings={initialOverlaySettings}
          initialProfileSettings={initialProfileSettings}
          onSave={onSave}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
