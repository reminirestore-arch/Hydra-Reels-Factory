import { useMemo, useRef, useState, JSX } from 'react'
import { Button, Card, ScrollShadow, Chip, Avatar } from '@heroui/react'
import { OverlaySettings, StrategyProfileSettings, StrategyType, VideoFile } from '@shared/types'
import { EditorPanel } from './editor/EditorPanel'
import { EditorModal } from './editor/EditorModal'

const getCustomCount = (file: VideoFile): number => {
  return Object.values(file.strategies).filter((strategy) => strategy.status === 'custom').length
}

const getOutputName = (filename: string, strategy: StrategyType): string => {
  const base = filename.replace(/\.[^/.]+$/, '')
  return `${base}_${strategy}.mp4`
}

export const Dashboard = (): JSX.Element => {
  const [files, setFiles] = useState<VideoFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [activeStrategy, setActiveStrategy] = useState<StrategyType | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState({ completed: 0, total: 0 })
  const [stopRequested, setStopRequested] = useState(false)
  const stopRequestedRef = useRef(false)

  const selectedFile = useMemo(() => files.find((f) => f.id === selectedFileId) ?? null, [files, selectedFileId])

  const handleSelectFolder = async () => {
    if (isProcessing) return
    try {
      const folderPath = await window.api.selectFolder()
      if (!folderPath) return

      setInputPath(folderPath)
      setIsLoading(true)
      const foundFiles = await window.api.scanFolder(folderPath)
      setFiles(foundFiles)
      setSelectedFileId(foundFiles[0]?.id ?? null)
    } catch (error) {
      console.error('Ошибка выбора папки:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectOutputFolder = async () => {
    if (isProcessing) return
    try {
      const folderPath = await window.api.selectOutputFolder()
      if (!folderPath) return
      setOutputPath(folderPath)
    } catch (error) {
      console.error('Ошибка выбора папки вывода:', error)
    }
  }

  const handleFileSelect = (file: VideoFile) => {
    if (isProcessing) return
    setSelectedFileId(file.id)
  }

  const handleOpenEditor = (strategy: StrategyType) => {
    if (isProcessing) return
    setActiveStrategy(strategy)
  }

  const handleSaveOverlay = async (payload: {
    canvasState: object
    overlayDataUrl: string
    textData: string
    overlaySettings: OverlaySettings
    profileSettings: StrategyProfileSettings
  }) => {
    if (!selectedFile || !activeStrategy) return

    const overlayPath = await window.api.saveOverlay(payload.overlayDataUrl)

    setFiles((prev) =>
      prev.map((file) =>
        file.id === selectedFile.id
          ? {
              ...file,
              strategies: {
                ...file.strategies,
                [activeStrategy]: {
                  ...file.strategies[activeStrategy],
                  status: 'custom',
                  overlayPath,
                  canvasState: payload.canvasState,
                  textData: payload.textData,
                  overlaySettings: payload.overlaySettings,
                  profileSettings: payload.profileSettings
                }
              }
            }
          : file
      )
    )

    setActiveStrategy(null)
  }

  const handleStartProcessing = async () => {
    if (!outputPath || !inputPath) return
    if (isProcessing) return

    stopRequestedRef.current = false
    setStopRequested(false)
    setIsProcessing(true)
    const totalJobs = files.length * 4
    setProcessingProgress({ completed: 0, total: totalJobs })
    let completed = 0

    for (const file of files) {
      if (stopRequestedRef.current) break

      setFiles((prev) =>
        prev.map((item) =>
          item.id === file.id ? { ...item, processingStatus: 'processing' } : item
        )
      )

      for (const strategy of Object.values(file.strategies)) {
        if (stopRequestedRef.current) break

        await window.api.renderStrategy({
          inputPath: file.fullPath,
          outputDir: outputPath,
          outputName: getOutputName(file.filename, strategy.id),
          overlayPath: strategy.overlayPath,
          overlayStart: strategy.overlaySettings.timing.startTime,
          overlayDuration: strategy.overlaySettings.timing.duration,
          strategyId: strategy.id
        })

        completed += 1
        setProcessingProgress({ completed, total: totalJobs })
      }

      if (!stopRequestedRef.current) {
        setFiles((prev) =>
          prev.map((item) => (item.id === file.id ? { ...item, processingStatus: 'done' } : item))
        )
      } else {
        setFiles((prev) =>
          prev.map((item) =>
            item.id === file.id ? { ...item, processingStatus: 'idle' } : item
          )
        )
        break
      }
    }

    setIsProcessing(false)
    setStopRequested(false)
    stopRequestedRef.current = false
  }

  const handleStopProcessing = () => {
    stopRequestedRef.current = true
    setStopRequested(true)
  }

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-foreground">
      <div className="w-80 flex flex-col border-r border-white/10 bg-background/50 backdrop-blur-xl shrink-0">
        <div className="p-4 border-b border-white/10 space-y-3">
          <Button
            fullWidth
            onClick={handleSelectFolder}
            className="font-bold cursor-pointer"
            variant={'outline'}
            isDisabled={isProcessing}
          >
            {isLoading ? 'Сканирование...' : 'Выбрать входную папку'}
          </Button>
          <Button
            fullWidth
            onClick={handleSelectOutputFolder}
            className="font-bold"
            variant={'outline'}
            isDisabled={isProcessing}
          >
            {outputPath ? 'Изменить папку вывода' : 'Выбрать папку вывода'}
          </Button>
          <div className="text-xs text-default-500">
            {inputPath ? `Input: ${inputPath}` : 'Input не выбран'}
          </div>
          <div className="text-xs text-default-500">
            {outputPath ? `Output: ${outputPath}` : 'Output не выбран'}
          </div>
        </div>

        <ScrollShadow className={`flex-1 p-4 space-y-3 ${isProcessing ? 'opacity-60 pointer-events-none' : ''}`}>
          {files.map((file) => {
            const customCount = getCustomCount(file)
            const processingLabel =
              file.processingStatus === 'done'
                ? 'Обработан'
                : file.processingStatus === 'processing'
                  ? 'В процессе'
                  : 'Не обработан'
            return (
              <Card
                key={file.id}
                className={`w-full border border-white/5 bg-default-100/5 transition-all cursor-pointer hover:bg-white/5 active:scale-95 ${selectedFileId === file.id ? 'border-primary/50 bg-primary/10' : ''}`}
              >
                <div
                  className="p-3 flex items-center gap-3 w-full h-full"
                  onClick={() => handleFileSelect(file)}
                  role="button"
                  tabIndex={0}
                >
                  <Avatar className="w-16 h-16 rounded-lg bg-black/50 border border-white/5 shrink-0">
                    <Avatar.Image
                      src={file.thumbnailDataUrl}
                      alt={file.filename}
                      className="object-cover w-full h-full"
                    />
                    <Avatar.Fallback className="text-xs text-default-500 font-bold">
                      MP4
                    </Avatar.Fallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-bold truncate text-white">{file.filename}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Chip size="sm" className="h-5 text-[10px]">
                        КАСТОМ {customCount}/4
                      </Chip>
                      <Chip
                        size="sm"
                        className="h-5 text-[10px]"
                        color={file.processingStatus === 'done' ? 'success' : 'default'}
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
              className={`font-bold ${isProcessing ? 'bg-warning text-black' : 'bg-primary text-black'}`}
              isDisabled={!outputPath || files.length === 0}
              onPress={isProcessing ? handleStopProcessing : handleStartProcessing}
            >
              {isProcessing ? 'ОСТАНОВИТЬ ОБРАБОТКУ' : 'ЗАПУСТИТЬ ОБРАБОТКУ'}
            </Button>
            {isProcessing && (
              <div className="text-xs text-default-400 text-center">
                Обработка: {processingProgress.completed}/{processingProgress.total}
                {stopRequested && ' • Остановка...'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`flex-1 relative flex flex-col bg-black/90 ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
      >
        {selectedFile ? (
          <EditorPanel
            file={selectedFile}
            onOpenEditor={handleOpenEditor}
            isProcessing={isProcessing}
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
