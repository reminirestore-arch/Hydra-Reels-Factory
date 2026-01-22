import { useMemo, useState, JSX } from 'react'
import { Button, Card, ScrollShadow, Chip, Avatar } from '@heroui/react'
import { StrategyType, VideoFile } from '@shared/types'
import { EditorPanel } from './editor/EditorPanel'
import { EditorModal } from './editor/EditorModal'

const getReadyCount = (file: VideoFile): number => {
  return Object.values(file.strategies).filter((strategy) => strategy.isReady).length
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

  const selectedFile = useMemo(() => files.find((f) => f.id === selectedFileId) ?? null, [files, selectedFileId])

  const handleSelectFolder = async () => {
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
    try {
      const folderPath = await window.api.selectOutputFolder()
      if (!folderPath) return
      setOutputPath(folderPath)
    } catch (error) {
      console.error('Ошибка выбора папки вывода:', error)
    }
  }

  const handleFileSelect = (file: VideoFile) => {
    setSelectedFileId(file.id)
  }

  const handleOpenEditor = (strategy: StrategyType) => {
    setActiveStrategy(strategy)
  }

  const handleSaveOverlay = async (payload: { canvasState: object; overlayDataUrl: string; textData: string }) => {
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
                  isReady: true,
                  overlayPath,
                  canvasState: payload.canvasState,
                  textData: payload.textData
                }
              }
            }
          : file
      )
    )

    setActiveStrategy(null)
  }

  const handleUpdateDuration = (duration: number) => {
    if (!selectedFile) return
    setFiles((prev) =>
      prev.map((file) => (file.id === selectedFile.id ? { ...file, overlayDuration: duration } : file))
    )
  }

  const handleApplySettings = (settings: unknown) => {
    console.log('Exporting settings:', settings)
  }

  const handleStartProcessing = async () => {
    if (!outputPath || !inputPath) return
    if (isProcessing) return

    setIsProcessing(true)
    for (const file of files) {
      for (const strategy of Object.values(file.strategies)) {
        if (!strategy.isReady || !strategy.overlayPath) continue

        await window.api.renderStrategy({
          inputPath: file.fullPath,
          outputDir: outputPath,
          outputName: getOutputName(file.filename, strategy.id),
          overlayPath: strategy.overlayPath,
          overlayDuration: file.overlayDuration,
          strategyId: strategy.id
        })
      }
    }
    setIsProcessing(false)
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
          >
            {isLoading ? 'Сканирование...' : 'Выбрать входную папку'}
          </Button>
          <Button fullWidth onClick={handleSelectOutputFolder} className="font-bold" variant={'outline'}>
            {outputPath ? 'Изменить папку вывода' : 'Выбрать папку вывода'}
          </Button>
          <div className="text-xs text-default-500">
            {inputPath ? `Input: ${inputPath}` : 'Input не выбран'}
          </div>
          <div className="text-xs text-default-500">
            {outputPath ? `Output: ${outputPath}` : 'Output не выбран'}
          </div>
        </div>

        <ScrollShadow className="flex-1 p-4 space-y-3">
          {files.map((file) => {
            const readyCount = getReadyCount(file)
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
                    <Chip size="sm" className="mt-1 h-5 text-[10px]">
                      READY {readyCount}/4
                    </Chip>
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
          <Button
            fullWidth
            size="lg"
            className="font-bold bg-primary text-black"
            isDisabled={!outputPath || files.length === 0 || isProcessing}
            onPress={handleStartProcessing}
          >
            {isProcessing ? 'Обработка...' : 'ЗАПУСТИТЬ ОБРАБОТКУ'}
          </Button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col bg-black/90">
        {selectedFile ? (
          <EditorPanel
            file={selectedFile}
            onOpenEditor={handleOpenEditor}
            onUpdateDuration={handleUpdateDuration}
            onApplySettings={handleApplySettings}
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
