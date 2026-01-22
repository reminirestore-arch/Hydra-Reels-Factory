import { useEffect, useRef, useState, ChangeEvent, JSX } from 'react'
import * as fabric from 'fabric';

export const EditorCanvas = (): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [canvasInstance, setCanvasInstance] = useState<fabric.Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CANVAS_WIDTH = 450;
  const CANVAS_HEIGHT = 800;

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#111',
      preserveObjectStacking: true,
      selection: true,
    });

    fabricRef.current = canvas;
    setCanvasInstance(canvas);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setCanvasInstance(null);
    };
  }, []);

  // Обработчик выбора файла
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasInstance) return;

    // ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД
    const filePath = window.api.getFilePath(file);

    console.log('Выбран файл:', file.name);
    console.log('Путь к файлу (safe):', filePath);

    let imageUrl = '';

    try {
      if (file.type.startsWith('video/')) {
        console.log('Запрашиваю кадр для:', filePath);
        imageUrl = await window.api.extractFrame(filePath);
      } else {
        imageUrl = URL.createObjectURL(file);
      }

      // ... Дальше код добавления картинки на холст ...
      const img = await fabric.FabricImage.fromURL(imageUrl);

      const scaleX = CANVAS_WIDTH / img.width!;
      const scaleY = CANVAS_HEIGHT / img.height!;
      const scale = Math.max(scaleX, scaleY);

      img.set({
        originX: 'center',
        originY: 'center',
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        scaleX: scale,
        scaleY: scale,
      });

      canvasInstance.backgroundImage = img;
      canvasInstance.requestRenderAll();

    } catch (err) {
      console.error("Ошибка:", err);
      alert('Не удалось обработать файл: ' + err);
    }
  };

  const addText = (): void => {
    if (!canvasInstance) return;

    const text = new fabric.IText('Текст Рилса', {
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Arial',
      fill: '#ffffff',
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      backgroundColor: '#000000',
      padding: 12,
      rx: 8,
      ry: 8,
      editable: true,
    });

    canvasInstance.add(text);
    canvasInstance.setActiveObject(text);
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-950">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*"
        className="hidden"
      />

      <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition border border-gray-700 cursor-pointer"
          >
            📁 Загрузить файл
          </button>

          <button
            onClick={addText}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition shadow-lg shadow-blue-900/20 cursor-pointer"
          >
            T+ Добавить текст
          </button>
        </div>

        <div className="text-gray-500 text-sm font-mono">
          9:16 • 1080p Preview
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-black">
        <div className="relative shadow-2xl shadow-black ring-1 ring-gray-800">
          <canvas ref={canvasRef} />
          <div className="pointer-events-none absolute inset-0 border border-white/5 mix-blend-overlay"></div>
        </div>
      </div>
    </div>
  );
};
