import { JSX } from 'react'
import { StrategyType, VideoFile } from '@shared/types'
import { EditorCanvas } from './EditorCanvas'

interface EditorModalProps {
  file: VideoFile
  strategyId: StrategyType
  onClose: () => void
  onSave: (payload: { canvasState: object; overlayDataUrl: string; textData: string }) => void
}

export const EditorModal = ({ file, strategyId, onClose, onSave }: EditorModalProps): JSX.Element => {
  const strategy = file.strategies[strategyId]

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      <EditorCanvas
        filePath={file.fullPath}
        initialState={strategy.canvasState}
        onClose={onClose}
        onSave={onSave}
      />
    </div>
  )
}
