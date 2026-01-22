import { useEffect, useRef, useState, ChangeEvent, JSX } from 'react'
import * as fabric from 'fabric'
import { Button } from '@heroui/react'
import { Upload, Type, MonitorPlay } from 'lucide-react'

export const EditorCanvas = (): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  // Используем state только для хранения факта инициализации, если нужно ре-рендерить UI
  const [, setCanvasInstance] = useState<fabric.Canvas | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const CANVAS_WIDTH = 450
  const CANVAS_HEIGHT = 800

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#111',
      // В v7 preserveObjectStacking по умолчанию true, но можно оставить для явности
      preserveObjectStacking: true,
      selection: true
    })

    fabricRef.current = canvas
    setCanvasInstance(canvas)

    return () => {
      // dispose() в v6/v7 возвращает Promise, обрабатываем его
      canvas.dispose().catch((e) => console.error('Ошибка очистки канваса:', e))
      fabricRef.current = null
      setCanvasInstance(null)
    }
  }, [])

  // Обработчик выбора файла
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    // Используем ref вместо state для работы с логикой канваса
    const canvas = fabricRef.current
    if (!file || !canvas) return

    const filePath = window.api.getFilePath(file)

    console.log('Выбран файл:', file.name)
    console.log('Путь к файлу (safe):', filePath)

    let imageUrl = ''

    try {
      if (file.type.startsWith('video/')) {
        console.log('Запрашиваю кадр для:', filePath)
        imageUrl = await window.api.extractFrame(filePath)
      } else {
        imageUrl = URL.createObjectURL(file)
      }

      // Добавление картинки на холст
      const img = await fabric.FabricImage.fromURL(imageUrl)

      const scaleX = CANVAS_WIDTH / img.width!
      const scaleY = CANVAS_HEIGHT / img.height!
      const scale = Math.max(scaleX, scaleY)

      img.set({
        // originX/Y по умолчанию 'center' в v7, явно указывать не нужно
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        scaleX: scale,
        scaleY: scale
      })

      // Мутируем объект канваса через ref, а не через state
      canvas.backgroundImage = img
      canvas.requestRenderAll()
    } catch (err) {
      console.error('Ошибка:', err)
      alert('Не удалось обработать файл: ' + err)
    }
  }

  const addText = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    const text = new fabric.IText('Текст Рилса', {
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      // originX/Y удалены, так как 'center' теперь дефолт
      fontFamily: 'Arial',
      fill: '#ffffff',
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      backgroundColor: '#000000',
      padding: 12,
      rx: 8,
      ry: 8,
      editable: true
    })

    canvas.add(text)
    canvas.setActiveObject(text)
  }

  return (
    <div className="flex flex-col h-full w-full bg-black/95">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*"
        className="hidden"
      />

      {/* Верхняя панель инструментов */}
      <div className="h-16 bg-black/50 border-b border-white/10 flex items-center justify-between px-6 shrink-0 backdrop-blur-md">
        <div className="flex gap-3">
          {/* Кнопка загрузки */}
          <Button
            size="sm"
            variant="primary"
            onPress={() => fileInputRef.current?.click()}
            className="font-medium"
          >
            <Upload size={16} />
            Загрузить файл
          </Button>

          {/* Кнопка добавления текста */}
          <Button
            size="sm"
            variant="primary" // или "shadow" если вернули, но solid надежнее для v3
            onPress={addText}
            className="font-medium shadow-lg shadow-primary/20"
          >
            <Type size={16} />
            Добавить текст
          </Button>
        </div>

        <div className="text-default-500 text-xs font-mono flex items-center gap-2">
          <MonitorPlay size={14} />
          9:16 • 1080p Preview
        </div>
      </div>

      {/* Область канваса */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-gray-900 to-black">
        <div className="relative shadow-2xl shadow-black ring-1 ring-white/10">
          <canvas ref={canvasRef} />
          {/* Оверлей для эффекта "экрана" */}
          <div className="pointer-events-none absolute inset-0 border border-white/5 mix-blend-overlay"></div>
        </div>
      </div>
    </div>
  )
}
