import type { JSX } from 'react'
import { useState } from 'react'
import { Button, Card, ScrollShadow, Chip, Avatar } from '@heroui/react'
import type {
  OverlaySettings,
  StrategyProfileSettings,
  StrategyType,
  VideoFile
} from '@shared/types'
import { EditorPanel } from '../../features/editor/EditorPanel'
import { EditorModal } from '../../features/editor/EditorModal'
import { useFilesStore } from '../../features/files/model/filesStore'
import { useProcessingStore } from '../../features/processing/model/processingStore'
import { apiClient } from '../../shared/api/apiClient'

const getCustomCount = (file: VideoFile): number => {
  return Object.values(file.strategies).filter((strategy) => strategy.status === 'custom').length
}

export function Dashboard(): JSX.Element {
  const { inputDir, outputDir, files, selectedFile, isLoading, error, actions } = useFilesStore()
  const {
    isRendering,
    error: renderError,
    progress,
    stopRequested,
    statusByFileId,
    actions: processingActions
  } = useProcessingStore()

  const [activeStrategy, setActiveStrategy] = useState<StrategyType | null>(null)

  const handleFileSelect = (file: VideoFile): void => {
    if (isRendering) return
    actions.selectFile(file)
  }

  const handleOpenEditor = (strategy: StrategyType): void => {
    if (isRendering) return
    setActiveStrategy(strategy)
  }

  const handleSaveOverlay = async (payload: {
    canvasState: object
    overlayDataUrl: string
    textData: string
    overlaySettings: OverlaySettings
    profileSettings: StrategyProfileSettings
  }): Promise<void> => {
    if (!selectedFile || !activeStrategy) return

    const res = await apiClient.saveOverlay(payload.overlayDataUrl)
    const overlayPath = res.path

    const next: VideoFile = {
      ...(selectedFile as any),
      strategies: {
        ...(selectedFile as any).strategies,
        [activeStrategy]: {
          ...(selectedFile as any).strategies?.[activeStrategy],
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
  }

  const processingLabelByFileId = (fileId: string): string => {
    const status = statusByFileId[fileId] ?? 'idle'

    return status === 'done'
      ? 'Обработан'
      : status === 'processing'
        ? 'В процессе'
        : status === 'error'
          ? 'Ошибка'
          : 'Не обработан'
  }

  const handlePickInputDir = async (): Promise<void> => {
    if (isRendering) return

    // сброс статусов ДО нового скана
    processingActions.clearStatuses()

    await actions.pickInputDir()
  }

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-foreground">
      <div className="w-80 flex flex-col border-r border-white/10 bg-background/50 backdrop-blur-xl shrink-0">
        <div className="p-4 border-b border-white/10 space-y-3">
          <Button
            fullWidth
            onClick={handlePickInputDir}
            className="font-bold cursor-pointer"
            variant="outline"
            isDisabled={isRendering || isLoading}
          >
            {isLoading
              ? 'Сканирование...'
              : inputDir
                ? 'Изменить входную папку'
                : 'Выбрать входную папку'}
          </Button>

          <Button
            fullWidth
            onClick={() => actions.pickOutputDir()}
            className="font-bold"
            variant="outline"
            isDisabled={isRendering || isLoading}
          >
            {outputDir ? 'Изменить папку вывода' : 'Выбрать папку вывода'}
          </Button>

          <div className="text-xs text-default-500">
            {inputDir ? `Input: ${inputDir}` : 'Input не выбран'}
          </div>
          <div className="text-xs text-default-500">
            {outputDir ? `Output: ${outputDir}` : 'Output не выбран'}
          </div>

          {error && <div className="text-xs text-danger">{error}</div>}
          {renderError && <div className="text-xs text-danger">{renderError}</div>}
        </div>

        <ScrollShadow
          className={`flex-1 p-4 space-y-3 ${isRendering ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {files.map((file) => {
            const customCount = getCustomCount(file)
            const processingLabel = processingLabelByFileId(file.id)
            const status = statusByFileId[file.id] ?? 'idle'

            return (
              <Card
                key={(file as any).id}
                className={`w-full border border-white/5 bg-default-100/5 transition-all cursor-pointer hover:bg-white/5 active:scale-95 ${
                  (selectedFile as any)?.id === (file as any).id
                    ? 'border-primary/50 bg-primary/10'
                    : ''
                }`}
              >
                <div
                  className="p-3 flex items-center gap-3 w-full h-full"
                  onClick={() => handleFileSelect(file)}
                  role="button"
                  tabIndex={0}
                >
                  <Avatar className="w-16 h-16 rounded-lg bg-black/50 border border-white/5 shrink-0">
                    <Avatar.Image
                      src={(file as any).thumbnailDataUrl}
                      alt={(file as any).filename}
                      className="object-cover w-full h-full"
                    />
                    <Avatar.Fallback className="text-xs text-default-500 font-bold">
                      MP4
                    </Avatar.Fallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-bold truncate text-white">
                      {(file as any).filename}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Chip size="sm" className="h-5 text-[10px]">
                        КАСТОМ {customCount}/4
                      </Chip>
                      <Chip
                        size="sm"
                        className="h-5 text-[10px]"
                        color={
                          status === 'done' ? 'success' : status === 'error' ? 'danger' : 'default'
                        }
                      >
                        {processingLabel}
                      </Chip>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}

          {!isLoading && files.length === 0 && (
            <div className="text-center text-default-500 mt-10 text-sm opacity-50">
              Папка не выбрана <br /> или пуста
            </div>
          )}
        </ScrollShadow>

        <div className="p-4 border-t border-white/10">
          <div className="space-y-3">
            <Button
              fullWidth
              size="lg"
              className={`font-bold ${isRendering ? 'bg-warning text-black' : 'bg-primary text-black'}`}
              isDisabled={!outputDir || files.length === 0}
              onPress={
                isRendering ? () => processingActions.stop() : () => processingActions.renderAll()
              }
            >
              {isRendering ? 'ОСТАНОВИТЬ ОБРАБОТКУ' : 'ЗАПУСТИТЬ ОБРАБОТКУ'}
            </Button>

            {isRendering && (
              <div className="text-xs text-default-400 text-center">
                Обработка: {progress.completed}/{progress.total}
                {stopRequested && ' • Остановка...'}
              </div>
            )}
          </div>
        </div>
      </div>

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
        <EditorModal
          file={selectedFile}
          strategyId={activeStrategy}
          onClose={() => setActiveStrategy(null)}
          onSave={handleSaveOverlay}
        />
      )}
    </div>
  )
}
