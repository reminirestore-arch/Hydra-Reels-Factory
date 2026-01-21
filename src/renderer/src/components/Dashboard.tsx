import { useState, JSX } from 'react';
import { Button, Card, CardBody, Image, ScrollShadow, Chip, Spacer, Divider } from "@heroui/react";
// 👇 1. Импорт типа
import { VideoFile } from '@shared/types';
// 👇 2. Импорт p-limit
import pLimit from 'p-limit';

export const Dashboard = (): JSX.Element => {
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VideoFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    try {
      const path = await window.api.selectFolder();
      if (!path) return;

      setInputPath(path);
      setFiles([]);

      // 1. Быстро получаем список файлов
      const foundFiles = await window.api.scanFolder(path);
      setFiles(foundFiles);

      // 2. Настраиваем очередь (LIMIT = 5 потоков)
      const limit = pLimit(5);

      // 3. Запускаем задачи (forEach вместо map + tasks)
      foundFiles.forEach(file => {
        // Просто кидаем задачу в лимит, не сохраняя результат
        limit(async () => {
          try {
            const thumb = await window.api.extractFrame(file.path);

            setFiles(currentFiles =>
              currentFiles.map(f => f.id === file.id ? { ...f, thumbnail: thumb } : f)
            );
          } catch (e) {
            console.error(`Ошибка превью для ${file.name}:`, e);
          }
        });
      });

      // Мы не ждем await Promise.all(tasks), чтобы UI не блокировался.
      // Задачи начнут выполняться, а пользователь уже может кликать интерфейс.

    } catch (err) {
      console.error(err);
    }
  };

  const selectedFile = files.find(f => f.id === selectedFileId);

  // ... (Далее весь твой JSX без изменений) ...
  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans">
      {/* ... КОД UI ОСТАВЛЯЕМ КАК БЫЛ, ОН У ТЕБЯ ПРАВИЛЬНЫЙ ... */}
      <div className="w-80 flex flex-col border-r border-default-100 bg-background/50 backdrop-blur-xl shrink-0">

        {/* Хедер списка */}
        <div className="p-4 z-20 bg-background/80 backdrop-blur-md border-b border-default-100">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-default-500 uppercase tracking-widest">
              Исходники
            </span>
            <Button
              color="primary"
              variant="shadow"
              onPress={handleSelectFolder}
              className="w-full font-medium"
              startContent={<span className="text-lg">📁</span>}
            >
              {inputPath ? 'Сменить папку' : 'Выбрать папку'}
            </Button>
            {inputPath && (
              <Chip size="sm" variant="flat" color="default" className="max-w-full">
                <span className="truncate block max-w-[240px] text-[10px] font-mono">
                  {inputPath}
                </span>
              </Chip>
            )}
          </div>
        </div>

        {/* Список файлов */}
        <ScrollShadow className="flex-1 p-3 space-y-2">
          {files.map(file => {
            const isSelected = selectedFileId === file.id;
            return (
              <Card
                key={file.id}
                isPressable
                onPress={() => setSelectedFileId(file.id)}
                className={`w-full transition-all duration-200 border-1 ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,112,243,0.3)]'
                    : 'border-transparent bg-transparent hover:bg-default-100'
                }`}
                shadow="none"
              >
                <CardBody className="p-2 flex flex-row items-center gap-3 overflow-hidden">
                  {/* Миниатюра */}
                  <div className="relative shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-default-200 shadow-sm border border-white/10">
                    {file.thumbnail ? (
                      <Image
                        src={file.thumbnail}
                        alt="thumb"
                        classNames={{ wrapper: "w-full h-full", img: "w-full h-full object-cover" }}
                        radius="none"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-default-300/20" />
                    )}
                  </div>

                  {/* Информация */}
                  <div className="flex flex-col min-w-0 gap-1 items-start">
                    <span className={`text-sm font-semibold truncate w-full ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {file.name}
                    </span>
                    <Chip size="sm" variant="dot" color={isSelected ? "success" : "default"} className="border-0 px-0 h-4">
                      <span className="text-[10px]">New</span>
                    </Chip>
                  </div>
                </CardBody>
              </Card>
            )
          })}

          {files.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-default-400 gap-2">
              <div className="text-4xl">📂</div>
              <p className="text-sm">Нет файлов</p>
            </div>
          )}
        </ScrollShadow>

        <div className="p-2 text-center border-t border-default-100">
          <span className="text-[10px] text-default-400 font-mono">HYDRA v2.0 • PRO</span>
        </div>
      </div>

      {/* === ПРАВАЯ ПАНЕЛЬ (ИНСПЕКТОР) === */}
      <div className="flex-1 relative flex flex-col bg-black/90">
        {/* Фоновая сетка */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        {selectedFile ? (
          <div className="z-10 flex flex-col h-full p-8 overflow-y-auto">

            {/* Заголовок инспектора */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-default-500">
                  {selectedFile.name}
                </h1>
                <p className="text-default-400 font-mono mt-1 text-xs uppercase tracking-widest opacity-70">
                  ID: {selectedFile.id.split('-')[0]}...
                </p>
              </div>
              <Button color="success" variant="flat" size="sm">
                Готов к работе
              </Button>
            </div>

            <Divider className="my-0 bg-white/10" />
            <Spacer y={8} />

            {/* Секция стратегий */}
            <div className="grid grid-cols-2 gap-6 max-w-4xl">
              {[
                { id: 'IG1', title: 'IG1: Юмор', desc: 'Focus + Vignette', color: 'primary' },
                { id: 'IG2', title: 'IG2: POV', desc: 'Dynamic + Saturation', color: 'secondary' },
                { id: 'IG3', title: 'IG3: Кликбейт', desc: 'Crunchy + High Contrast', color: 'warning' },
                { id: 'IG4', title: 'IG4: ASMR', desc: 'Cinema + Grain', color: 'danger' },
              ].map((strat) => (
                <Card
                  key={strat.id}
                  isPressable
                  className="bg-content1/50 backdrop-blur-lg border-1 border-white/5 hover:border-white/20 transition-all group"
                >
                  <CardBody className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <Chip
                        color={strat.color as any}
                        variant="shadow"
                        size="sm"
                        classNames={{ content: "font-bold tracking-wider" }}
                      >
                        {strat.id}
                      </Chip>
                      <div className="w-3 h-3 rounded-full bg-default-300 group-hover:bg-white transition-colors" />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1">{strat.title}</h3>
                    <p className="text-sm text-default-400">{strat.desc}</p>

                    <Spacer y={4} />
                    <Button
                      className="w-full font-medium group-hover:bg-white group-hover:text-black transition-colors"
                      variant="flat"
                      color={strat.color as any}
                    >
                      Настроить
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-default-500 z-10">
            <div className="w-24 h-24 mb-6 rounded-[2rem] bg-gradient-to-tr from-default-100 to-default-50 border border-white/5 flex items-center justify-center shadow-2xl">
              <span className="text-4xl grayscale opacity-50">🎬</span>
            </div>
            <h3 className="text-xl font-medium text-default-300">Проект не выбран</h3>
            <p className="text-sm mt-2 max-w-xs text-center opacity-60">
              Выберите видео слева, чтобы начать магию монтажа
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
