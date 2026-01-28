/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JSX } from 'react'
import { useMemo, useCallback } from 'react'
import { Button, Card, ScrollShadow, Chip, Avatar } from '@heroui/react'
import { Check } from 'lucide-react'
import type { VideoFile } from '@shared/types'
import { useFilesStore } from '@features/files/model/filesStore'
import { useProcessingStore } from '@features/processing/model/processingStore'

// Memoized helper function
const getCustomCount = (file: VideoFile): number => {
  return Object.values(file.strategies).filter((strategy) => strategy.status === 'custom').length
}

interface FilesSidebarProps {
  onFileSelect: (file: VideoFile) => void
}

export const FilesSidebar = ({ onFileSelect }: FilesSidebarProps): JSX.Element => {
  const { inputDir, outputDir, files, selectedFile, isLoading, error, actions } = useFilesStore()
  const {
    isRendering,
    error: renderError,
    progress,
    stopRequested,
    statusByFileId,
    actions: processingActions
  } = useProcessingStore()

  const handlePickInputDir = useCallback(async (): Promise<void> => {
    if (isRendering) return

    // сброс статусов ДО нового скана
    processingActions.clearStatuses()

    await actions.pickInputDir()
  }, [isRendering, processingActions, actions])

  const processingLabelByFileId = useCallback(
    (fileId: string): string => {
      const status = statusByFileId[fileId] ?? 'idle'

      return status === 'done'
        ? 'Обработан'
        : status === 'processing'
          ? 'В процессе'
          : status === 'error'
            ? 'Ошибка'
            : 'Не обработан'
    },
    [statusByFileId]
  )

  // Memoized custom count for files
  const filesWithCustomCount = useMemo(
    () => files.map((file) => ({ file, customCount: getCustomCount(file) })),
    [files]
  )

  return (
    <div className="w-80 flex flex-col border-r border-white/10 bg-background/50 backdrop-blur-xl shrink-0">
      <div className="p-4 border-b border-white/10 space-y-3">
        <Button
          fullWidth
          onPress={handlePickInputDir}
          className="font-bold cursor-pointer"
          variant="outline"
          isDisabled={isRendering || isLoading}
          {...({
            children: isLoading
              ? 'Сканирование...'
              : inputDir
                ? 'Изменить входную папку'
                : 'Выбрать входную папку'
          } as any)}
        />

        <Button
          fullWidth
          onPress={() => actions.pickOutputDir()}
          className="font-bold"
          variant="outline"
          isDisabled={isRendering || isLoading}
          {...({ children: outputDir ? 'Изменить папку вывода' : 'Выбрать папку вывода' } as any)}
        />

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
        {filesWithCustomCount.map(({ file, customCount }) => {
          const processingLabel = processingLabelByFileId(file.id)
          const status = statusByFileId[file.id] ?? 'idle'
          const isSelected = selectedFile?.id === file.id

          return (
            <div
              key={file.id}
              onClick={() => onFileSelect(file)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onFileSelect(file)
                }
              }}
              className="w-full"
            >
              <Card
                className={`w-full border transition-all cursor-pointer hover:bg-white/5 active:scale-[0.98] relative overflow-hidden ${
                  isSelected
                    ? 'border-primary bg-primary/15 shadow-lg shadow-primary/20 ring-2 ring-primary/30'
                    : 'border-white/5 bg-default-100/5'
                }`}
              >
                {/* Акцентная полоска слева для выбранного элемента */}
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}

                <div className="p-1 flex items-center gap-3 w-full h-full relative">
                  <div className="relative shrink-0">
                    <Avatar className="w-16 h-16 rounded-lg bg-black/50 border border-white/5">
                      <Avatar.Image
                        src={file.thumbnailDataUrl}
                        alt={file.filename}
                        className="object-cover w-full h-full"
                      />
                      <Avatar.Fallback className="text-xs text-default-500 font-bold">
                        MP4
                      </Avatar.Fallback>
                    </Avatar>
                    {/* Индикатор выбора на аватаре */}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background shadow-lg">
                        <Check size={12} className="text-black" strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div
                      className={`text-sm font-bold truncate transition-colors ${
                        isSelected ? 'text-primary' : 'text-white'
                      }`}
                    >
                      {file.filename}
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
            </div>
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
            {...({
              children: isRendering ? 'ОСТАНОВИТЬ ОБРАБОТКУ' : 'ЗАПУСТИТЬ ОБРАБОТКУ'
            } as any)}
          />

          {isRendering && (
            <div className="text-xs text-default-400 text-center">
              Обработка: {progress.completed}/{progress.total}
              {stopRequested && ' • Остановка...'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
