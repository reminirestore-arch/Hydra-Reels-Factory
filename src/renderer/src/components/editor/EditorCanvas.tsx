import { useEffect, useRef, JSX } from 'react'
import * as fabric from 'fabric'
import { Button } from '@heroui/react'
import { Type, MonitorPlay, Save, X } from 'lucide-react'

interface EditorCanvasProps {
  filePath: string
  initialState?: object
  onSave: (payload: { canvasState: object; overlayDataUrl: string; textData: string }) => void
  onClose: () => void
}

const CANVAS_WIDTH = 450
const CANVAS_HEIGHT = 800

export const EditorCanvas = ({ filePath, initialState, onSave, onClose }: EditorCanvasProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true
    })

    fabricRef.current = canvas

    return () => {
      canvas.dispose().catch((e) => console.error('Ошибка очистки канваса:', e))
      fabricRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !filePath) return

    const loadFrame = async (): Promise<void> => {
      try {
        const imageUrl = await window.api.extractFrame(filePath)
        if (!imageUrl) return

        const img = await fabric.FabricImage.fromURL(imageUrl)
        const scaleX = CANVAS_WIDTH / img.width!
        const scaleY = CANVAS_HEIGHT / img.height!
        const scale = Math.max(scaleX, scaleY)

        img.set({
          left: CANVAS_WIDTH / 2,
          top: CANVAS_HEIGHT / 2,
          scaleX: scale,
          scaleY: scale
        })

        canvas.backgroundImage = img
        canvas.requestRenderAll()
      } catch (err) {
        console.error('Ошибка загрузки кадра:', err)
      }
    }

    void loadFrame()
  }, [filePath])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !initialState) return

    canvas.loadFromJSON(initialState, () => {
      canvas.requestRenderAll()
    })
  }, [initialState])

  const addText = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    const text = new fabric.IText('Текст Рилса', {
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
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

  const handleSave = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    const background = canvas.backgroundImage
    canvas.backgroundImage = null
    canvas.requestRenderAll()

    const overlayDataUrl = canvas.toDataURL({ format: 'png' })
    const canvasState = canvas.toJSON()

    canvas.backgroundImage = background
    canvas.requestRenderAll()

    const textData = canvas
      .getObjects()
      .filter((obj) => obj.type === 'i-text' || obj.type === 'text')
      .map((obj) => (obj as fabric.IText).text ?? '')
      .join(' ')
      .trim()

    onSave({ canvasState, overlayDataUrl, textData })
  }

  return (
    <div className="flex flex-col h-full w-full bg-black/95">
      <div className="h-16 bg-black/50 border-b border-white/10 flex items-center justify-between px-6 shrink-0 backdrop-blur-md">
        <div className="flex gap-3">
          <Button size="sm" variant="primary" onPress={addText} className="font-medium shadow-lg shadow-primary/20">
            <Type size={16} />
            Добавить текст
          </Button>
        </div>

        <div className="text-default-500 text-xs font-mono flex items-center gap-2">
          <MonitorPlay size={14} />
          9:16 • 1080p Preview
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="flat" onPress={onClose} className="font-medium">
            <X size={16} />
            Закрыть
          </Button>
          <Button size="sm" variant="solid" onPress={handleSave} className="font-medium bg-success text-black">
            <Save size={16} />
            Сохранить
          </Button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-gray-900 to-black">
        <div className="relative shadow-2xl shadow-black ring-1 ring-white/10">
          <canvas ref={canvasRef} />
          <div className="pointer-events-none absolute inset-0 border border-white/5 mix-blend-overlay"></div>
        </div>
      </div>
    </div>
  )
}
