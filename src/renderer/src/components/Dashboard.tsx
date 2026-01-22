import { useState, JSX } from 'react';
// Убрали Image из импорта
import { Button, Card, ScrollShadow, Chip } from "@heroui/react";
import { VideoFile } from '@shared/types';
import { EditorPanel } from './editor/EditorPanel';

export const Dashboard = (): JSX.Element => {
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VideoFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Заглушка (восстанови свою логику работы с файловой системой здесь)
  const handleSelectFolder = async () => { console.log("Выбор папки"); };

  const selectedFile = files.find(f => f.id === selectedFileId);

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-foreground">

      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <div className="w-80 flex flex-col border-r border-white/10 bg-background/50 backdrop-blur-xl shrink-0">
        <div className="p-4 border-b border-white/10">
          <Button
            color="primary"
            variant="shadow"
            fullWidth
            onPress={handleSelectFolder}
            className="font-bold"
          >
            Выбрать папку
          </Button>
        </div>

        <ScrollShadow className="flex-1 p-4 space-y-3">
          {files.map(file => (
            <Card
              key={file.id}
              isPressable
              onPress={() => setSelectedFileId(file.id)}
              className={`w-full border border-white/5 bg-default-100/5 transition-all ${selectedFileId === file.id ? 'border-primary/50 bg-primary/10' : ''}`}
            >
              {/* Используем обычный div для отступов вместо CardBody */}
              <div className="p-3 flex items-center gap-3">
                <div className="w-16 h-16 bg-black/50 rounded-lg shrink-0 overflow-hidden relative border border-white/5">
                  {file.thumbnail ? (
                    // 👇 ЗАМЕНА: Обычный img тег вместо компонента Image
                    <img
                      src={file.thumbnail}
                      className="object-cover w-full h-full"
                      alt={file.name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-default-500">No IMG</div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-bold truncate text-white">{file.name}</div>
                  <Chip size="sm" variant="flat" color="warning" className="mt-1 h-5 text-[10px]">
                    READY
                  </Chip>
                </div>
              </div>
            </Card>
          ))}

          {files.length === 0 && (
            <div className="text-center text-default-500 mt-10 text-sm opacity-50">
              Папка не выбрана <br/> или пуста
            </div>
          )}
        </ScrollShadow>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ (ИНСПЕКТОР) */}
      <div className="flex-1 relative flex flex-col bg-black/90">
        {selectedFile ? (
          <EditorPanel file={selectedFile} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-default-500">
            {/* Декоративный элемент на CSS */}
            <div className="w-20 h-20 rounded-3xl bg-default-100/10 mb-6 flex items-center justify-center border border-white/5">
              <span className="text-4xl opacity-20">🎬</span>
            </div>
            <h3 className="text-xl font-medium text-default-300">Проект не выбран</h3>
            <p className="text-sm mt-2 opacity-40">Выберите видео из списка слева</p>
          </div>
        )}
      </div>
    </div>
  );
};
