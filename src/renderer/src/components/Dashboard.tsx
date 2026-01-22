import { useState, JSX } from 'react'
import { Button, Card, ScrollShadow, Chip, Avatar } from '@heroui/react' // 👈 Добавили Avatar
import { VideoFile } from '@shared/types'
import { EditorPanel } from './editor/EditorPanel'

export const Dashboard = (): JSX.Element => {
  const [files, setFiles] = useState<VideoFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSelectFolder = async () => {
    try {
      const folderPath = await window.api.selectFolder()
      if (!folderPath) return

      setIsLoading(true)
      const foundFiles = await window.api.scanFolder(folderPath)
      setFiles(foundFiles)
    } catch (error) {
      console.error('Ошибка выбора папки:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = async (file: VideoFile) => {
    setSelectedFileId(file.id)
    if (!file.thumbnail) {
      // Логика генерации превью...
    }
  }

  const selectedFile = files.find((f) => f.id === selectedFileId)

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-foreground">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <div className="w-80 flex flex-col border-r border-white/10 bg-background/50 backdrop-blur-xl shrink-0">
        <div className="p-4 border-b border-white/10">
          <Button
            fullWidth
            onClick={handleSelectFolder}
            className="font-bold cursor-pointer"
            variant={'outline'}
          >
            {isLoading ? 'Сканирование...' : 'Выбрать папку'}
          </Button>
        </div>

        <ScrollShadow className="flex-1 p-4 space-y-3">
          {files.map((file) => (
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
                {/* 👇 НОВЫЙ КОД: Используем Avatar v3 */}
                <Avatar
                  className="w-16 h-16 rounded-lg bg-black/50 border border-white/5 shrink-0"
                  // radius="none" // Можно использовать radius="md", но className="rounded-lg" дает больше контроля
                >
                  <Avatar.Image
                    src={file.thumbnail}
                    alt={file.name}
                    className="object-cover w-full h-full"
                  />
                  <Avatar.Fallback className="text-xs text-default-500 font-bold">
                    MP4
                  </Avatar.Fallback>
                </Avatar>

                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-bold truncate text-white">{file.name}</div>
                  <Chip size="sm" className="mt-1 h-5 text-[10px]">
                    READY
                  </Chip>
                </div>
              </div>
            </Card>
          ))}

          {!isLoading && files.length === 0 && (
            <div className="text-center text-default-500 mt-10 text-sm opacity-50">
              Папка не выбрана <br /> или пуста
            </div>
          )}
        </ScrollShadow>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ */}
      <div className="flex-1 relative flex flex-col bg-black/90">
        {selectedFile ? (
          <EditorPanel file={selectedFile} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-default-500">
            <h3 className="text-xl font-medium text-default-300">Проект не выбран</h3>
          </div>
        )}
      </div>
    </div>
  )
}
