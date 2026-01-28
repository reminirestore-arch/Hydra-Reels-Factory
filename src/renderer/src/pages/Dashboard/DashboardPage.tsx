/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import type { JSX } from 'react'
import { useState, lazy, Suspense, useMemo, useCallback } from 'react'
import type { StrategyType, VideoFile } from '@shared/types'
import { EditorPanel } from '@features/editor/EditorPanel'
import { useFilesStore } from '@features/files/model/filesStore'
import { useProcessingStore } from '@features/processing/model/processingStore'
import { apiClient } from '@api/apiClient'
import type { OverlaySavePayload } from '@features/editor/types'
import { FilesSidebar } from './components/FilesSidebar'
import { LogsPanel } from './components/LogsPanel'

// Lazy load EditorModal for code splitting
const EditorModal = lazy(() =>
  import('@features/editor/EditorModal').then((module) => ({ default: module.EditorModal }))
)

// Loading fallback for lazy components
const EditorModalLoader = (): JSX.Element => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
    <div className="text-white">Loading editor...</div>
  </div>
)

export function Dashboard(): JSX.Element {
  const { selectedFile, actions } = useFilesStore()
  const { isRendering } = useProcessingStore()

  const [activeStrategy, setActiveStrategy] = useState<StrategyType | null>(null)

  const handleFileSelect = useCallback(
    (file: VideoFile): void => {
      if (isRendering) return
      actions.selectFile(file)
    },
    [isRendering, actions]
  )

  const handleOpenEditor = useCallback(
    (strategy: StrategyType): void => {
      if (isRendering) return
      setActiveStrategy(strategy)
    },
    [isRendering]
  )

  const handleSaveOverlay = useCallback(
    async (payload: OverlaySavePayload): Promise<void> => {
      if (!selectedFile || !activeStrategy) return

      // ИСПРАВЛЕНИЕ: saveOverlay возвращает строку (путь), а не объект с полем path
      const overlayPath = await apiClient.saveOverlay(payload.overlayDataUrl)

      const next: VideoFile = {
        ...selectedFile,
        strategies: {
          ...selectedFile.strategies,
          [activeStrategy]: {
            ...selectedFile.strategies[activeStrategy],
            status: 'custom',
            overlayPath,
            canvasState: payload.canvasState,
            textData: payload.textData,
            overlaySettings: payload.overlaySettings,
            profileSettings: payload.profileSettings
          }
        }
      }

      actions.updateFile(next)
      setActiveStrategy(null)
    },
    [selectedFile, activeStrategy, actions]
  )

  // Memoized strategy data
  const activeStrategyData = useMemo(
    () => (selectedFile && activeStrategy ? selectedFile.strategies?.[activeStrategy] : null),
    [selectedFile, activeStrategy]
  )

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-foreground">
      <FilesSidebar onFileSelect={handleFileSelect} />

      <LogsPanel />

      <div
        className={`flex-1 relative flex flex-col bg-black/90 ${isRendering ? 'pointer-events-none opacity-60' : ''}`}
      >
        {selectedFile ? (
          <EditorPanel
            file={selectedFile}
            onOpenEditor={handleOpenEditor}
            isProcessing={isRendering}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-default-500">
            <h3 className="text-xl font-medium text-default-300">Проект не выбран</h3>
          </div>
        )}
      </div>

      {selectedFile && activeStrategy && (
        <Suspense fallback={<EditorModalLoader />}>
          <EditorModal
            isOpen={true}
            filePath={selectedFile.fullPath}
            strategyId={activeStrategy}
            initialState={activeStrategyData?.canvasState}
            initialOverlaySettings={activeStrategyData?.overlaySettings}
            initialProfileSettings={activeStrategyData?.profileSettings}
            onClose={() => setActiveStrategy(null)}
            onSave={handleSaveOverlay}
          />
        </Suspense>
      )}
    </div>
  )
}
