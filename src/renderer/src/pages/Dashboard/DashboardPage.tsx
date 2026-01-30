import type { JSX } from 'react'
import { useState, useMemo, useCallback } from 'react'
import type { StrategyType, VideoFile } from '@shared/types'
import { Tabs } from '@heroui/react'
import { STRATEGY_META } from '@shared/config/strategies'
import { useFilesStore } from '@features/files/model/filesStore'
import { useProcessingStore } from '@features/processing/model/processingStore'
import { apiClient } from '@api/apiClient'
import type { OverlaySavePayload } from '@features/editor/types'
import { EditorWorkspaceProvider } from '@features/editor/EditorWorkspace'
import { FilesSidebar } from './components/FilesSidebar'

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

  const handleSaveOverlay = useCallback(
    async (payload: OverlaySavePayload): Promise<void> => {
      if (!selectedFile || !activeStrategy) return

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
      // Keep activeStrategy so user stays in editor
    },
    [selectedFile, activeStrategy, actions]
  )

  const activeStrategyData = useMemo(
    () => (selectedFile && activeStrategy ? selectedFile.strategies?.[activeStrategy] : null),
    [selectedFile, activeStrategy]
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Zone 1: Collapsible Files Sidebar */}
      <FilesSidebar onFileSelect={handleFileSelect} />

      {/* Zone 2 + 3: Center (tabs + canvas) | Inspector */}
      <div
        className={`flex-1 min-w-0 flex flex-col ${isRendering ? 'pointer-events-none opacity-60' : ''}`}
      >
        {selectedFile ? (
          <>
            {/* Strategy Tabs at top of center */}
            <div className="shrink-0 border-b border-white/10 bg-black/90 px-4 py-2">
              <Tabs
                selectedKey={activeStrategy ?? undefined}
                onSelectionChange={(key) => setActiveStrategy(key as StrategyType)}
                variant="secondary"
                className="w-full"
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Стратегии обработки" className="gap-4">
                    {STRATEGY_META.map((strat) => (
                      <Tabs.Tab key={strat.id} id={strat.id}>
                        {strat.id}: {strat.label}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            </div>

            {activeStrategy ? (
              <div className="flex flex-1 min-h-0 min-w-0">
                <EditorWorkspaceProvider
                  filePath={selectedFile.fullPath}
                  strategyId={activeStrategy}
                  initialState={activeStrategyData?.canvasState}
                  initialOverlaySettings={activeStrategyData?.overlaySettings}
                  initialProfileSettings={activeStrategyData?.profileSettings}
                  onSave={handleSaveOverlay}
                  onUnselectStrategy={() => setActiveStrategy(null)}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-default-500 gap-4 p-4">
                <h3 className="text-xl font-medium text-default-300">
                  Выберите стратегию выше
                </h3>
                <p className="text-sm text-default-500">
                  IG1–IG4 — версии обработки для этого файла
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-default-500 p-4">
            <h3 className="text-xl font-medium text-default-300">Проект не выбран</h3>
            <p className="text-sm text-default-500 mt-2">
              Выберите файл в боковой панели
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
