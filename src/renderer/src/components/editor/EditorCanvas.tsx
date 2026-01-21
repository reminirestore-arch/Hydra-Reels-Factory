import {JSX, useEffect, useRef, useState} from 'react';
import * as fabric from 'fabric';

export const EditorCanvas = (): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [canvasInstance, setCanvasInstance] = useState<fabric.Canvas | null>(null);

  useEffect(() => {
    // ГЛАВНОЕ ИСПРАВЛЕНИЕ ЗДЕСЬ:
    // Если канваса нет или он уже создан — сразу выходим.
    if (!canvasRef.current || fabricRef.current) return;

    // Инициализация
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800, // Временный фиксированный размер
      height: 600,
      backgroundColor: '#1a1a1a', // Темно-серый фон
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;
    setCanvasInstance(canvas);

    // Очистка
    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setCanvasInstance(null);
    };
  }, []);

  const addText = (): void => {
    if (!canvasInstance) return;

    const text = new fabric.IText('Привет!', {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fill: '#ffffff',
      fontSize: 40,
      fontWeight: 'bold',
      backgroundColor: '#000000',
      padding: 10,
      rx: 5,
      ry: 5,
    });

    canvasInstance.add(text);
    canvasInstance.setActiveObject(text);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Тулбар */}
      <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center px-4 shrink-0">
        <button
          onClick={addText}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-medium transition cursor-pointer"
        >
          + Текст
        </button>
      </div>

      {/* Область редактора */}
      <div className="flex-1 bg-gray-900 flex items-center justify-center p-8 overflow-hidden">
        <div className="shadow-2xl border border-gray-700">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
};
