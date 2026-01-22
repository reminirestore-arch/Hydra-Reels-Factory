import { useEffect, useRef, useState, JSX } from 'react'
import * as fabric from 'fabric'
import { Button, ScrollShadow, Slider, Label } from '@heroui/react'
import { MonitorPlay, Save, Type, X } from 'lucide-react'
import { buildDefaultOverlaySettings, createDefaultStrategy } from '@shared/defaults'
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'

interface EditorCanvasProps {
  filePath: string
  strategyId: StrategyType
  initialState?: object
  initialOverlaySettings?: OverlaySettings
  initialProfileSettings?: StrategyProfileSettings
  onSave: (payload: {
    canvasState: object
    overlayDataUrl: string
    textData: string
    overlaySettings: OverlaySettings
    profileSettings: StrategyProfileSettings
  }) => void
  onClose: () => void
}

const CANVAS_WIDTH = 450
const CANVAS_HEIGHT = 800

const hexToRgba = (hex: string, opacity: number): string => {
  const cleanHex = hex.replace('#', '')
  const bigint = parseInt(cleanHex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export const EditorCanvas = ({
  filePath,
  strategyId,
  initialState,
  initialOverlaySettings,
  initialProfileSettings,
  onSave,
  onClose
}: EditorCanvasProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const textRef = useRef<fabric.IText | null>(null)
  const backgroundRef = useRef<fabric.Rect | null>(null)

  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(
    initialOverlaySettings ?? buildDefaultOverlaySettings()
  )
  const [profileSettings, setProfileSettings] = useState<StrategyProfileSettings>(
    initialProfileSettings ?? createDefaultStrategy(strategyId).profileSettings
  )

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

  const syncOverlayObjects = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    const objects = canvas.getObjects()
    const existingText = objects.find(
      (obj) => (obj as { data?: { role?: string } }).data?.role === 'overlay-text'
    )
    const existingBackground = objects.find(
      (obj) => (obj as { data?: { role?: string } }).data?.role === 'overlay-background'
    )

    if (existingText && existingText.type === 'i-text') {
      textRef.current = existingText as fabric.IText
    }

    if (existingBackground && existingBackground.type === 'rect') {
      backgroundRef.current = existingBackground as fabric.Rect
    }

    if (!backgroundRef.current) {
      const rect = new fabric.Rect({
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        width: overlaySettings.background.width,
        height: overlaySettings.background.height,
        originX: 'center',
        originY: 'center',
        fill: hexToRgba(overlaySettings.background.color, overlaySettings.background.opacity),
        rx: 12,
        ry: 12,
        selectable: true
      })
      rect.set({ data: { role: 'overlay-background' } })
      backgroundRef.current = rect
      canvas.add(rect)
    }

    if (!textRef.current) {
      const text = new fabric.IText('Текст Рилса', {
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        fontFamily: 'Arial',
        fill: overlaySettings.text.color,
        fontSize: overlaySettings.text.fontSize,
        fontWeight: 'bold',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        editable: true,
        selectable: true
      })
      text.set({ data: { role: 'overlay-text' } })
      textRef.current = text
      canvas.add(text)
    }

    if (backgroundRef.current && textRef.current) {
      canvas.bringObjectToFront(textRef.current)
    }

    applyOverlaySettings()
    canvas.requestRenderAll()
  }

  const applyOverlaySettings = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    if (textRef.current) {
      textRef.current.set({
        fontSize: overlaySettings.text.fontSize,
        fill: overlaySettings.text.color,
        textAlign: overlaySettings.text.align
      })
    }

    if (backgroundRef.current) {
      backgroundRef.current.set({
        width: overlaySettings.background.width,
        height: overlaySettings.background.height,
        fill: hexToRgba(overlaySettings.background.color, overlaySettings.background.opacity)
      })
    }

    canvas.requestRenderAll()
  }

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !initialState) return

    canvas.loadFromJSON(initialState, () => {
      syncOverlayObjects()
      canvas.requestRenderAll()
    })
  }, [initialState])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || initialState) return
    syncOverlayObjects()
  }, [initialState])

  useEffect(() => {
    applyOverlaySettings()
  }, [overlaySettings])

  const handleCenterText = (): void => {
    if (!backgroundRef.current || !textRef.current) return
    textRef.current.set({
      left: backgroundRef.current.left,
      top: backgroundRef.current.top,
      originX: 'center',
      originY: 'center'
    })
    fabricRef.current?.requestRenderAll()
  }

  const handleCenterBackground = (): void => {
    if (!backgroundRef.current) return
    backgroundRef.current.set({
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      originX: 'center',
      originY: 'center'
    })
    handleCenterText()
    fabricRef.current?.requestRenderAll()
  }

  const addText = (): void => {
    syncOverlayObjects()
    if (textRef.current) {
      fabricRef.current?.setActiveObject(textRef.current)
    }
  }

  const handleSave = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    const background = canvas.backgroundImage
    canvas.backgroundImage = null
    canvas.requestRenderAll()

    const overlayDataUrl = canvas.toDataURL({ format: 'png' })
    const canvasState = canvas.toJSON(['data'])

    canvas.backgroundImage = background
    canvas.requestRenderAll()

    const textData = canvas
      .getObjects()
      .filter((obj) => obj.type === 'i-text' || obj.type === 'text')
      .map((obj) => (obj as fabric.IText).text ?? '')
      .join(' ')
      .trim()

    onSave({
      canvasState,
      overlayDataUrl,
      textData,
      overlaySettings,
      profileSettings
    })
  }

  const profileConfig = (() => {
    switch (strategyId) {
      case 'IG1':
        return {
          key: 'focusStrength' as const,
          label: 'Сила фокуса',
          min: 0,
          max: 1,
          step: 0.05
        }
      case 'IG2':
        return {
          key: 'motionSpeed' as const,
          label: 'Динамика движения',
          min: 0.8,
          max: 1.3,
          step: 0.01
        }
      case 'IG3':
        return {
          key: 'contrast' as const,
          label: 'Контраст',
          min: 0.8,
          max: 1.5,
          step: 0.05
        }
      case 'IG4':
      default:
        return {
          key: 'grain' as const,
          label: 'Зерно',
          min: 0,
          max: 1,
          step: 0.05
        }
    }
  })()

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

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-gray-900 to-black">
          <div className="relative shadow-2xl shadow-black ring-1 ring-white/10">
            <canvas ref={canvasRef} />
            <div className="pointer-events-none absolute inset-0 border border-white/5 mix-blend-overlay"></div>
          </div>
        </div>

        <aside className="w-96 border-l border-white/10 bg-black/60">
          <ScrollShadow className="h-full p-6 space-y-6">
            <div className="space-y-3">
              <div className="text-xs text-default-500 font-bold uppercase tracking-wider">Тайминг текста</div>
              <Slider
                step={0.5}
                maxValue={15}
                minValue={0}
                value={overlaySettings.timing.startTime}
                onChange={(value) =>
                  setOverlaySettings((prev) => ({
                    ...prev,
                    timing: { ...prev.timing, startTime: value as number }
                  }))
                }
                className="w-full"
              >
                <div className="flex justify-between mb-1">
                  <Label className="text-xs font-medium text-default-600">Старт появления (сек)</Label>
                  <Slider.Output className="text-xs font-bold text-default-600" />
                </div>
                <Slider.Track className="bg-default-500/20 h-1">
                  <Slider.Fill className="bg-primary" />
                  <Slider.Thumb className="bg-primary size-3" />
                </Slider.Track>
              </Slider>

              <Slider
                step={0.5}
                maxValue={15}
                minValue={1}
                value={overlaySettings.timing.duration}
                onChange={(value) =>
                  setOverlaySettings((prev) => ({
                    ...prev,
                    timing: { ...prev.timing, duration: value as number }
                  }))
                }
                className="w-full"
              >
                <div className="flex justify-between mb-1">
                  <Label className="text-xs font-medium text-default-600">Длительность (сек)</Label>
                  <Slider.Output className="text-xs font-bold text-default-600" />
                </div>
                <Slider.Track className="bg-default-500/20 h-1">
                  <Slider.Fill className="bg-secondary" />
                  <Slider.Thumb className="bg-secondary size-3" />
                </Slider.Track>
              </Slider>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-default-500 font-bold uppercase tracking-wider">Текст</div>
              <Slider
                step={2}
                maxValue={96}
                minValue={18}
                value={overlaySettings.text.fontSize}
                onChange={(value) =>
                  setOverlaySettings((prev) => ({
                    ...prev,
                    text: { ...prev.text, fontSize: value as number }
                  }))
                }
                className="w-full"
              >
                <div className="flex justify-between mb-1">
                  <Label className="text-xs font-medium text-default-600">Размер</Label>
                  <Slider.Output className="text-xs font-bold text-default-600" />
                </div>
                <Slider.Track className="bg-default-500/20 h-1">
                  <Slider.Fill className="bg-warning" />
                  <Slider.Thumb className="bg-warning size-3" />
                </Slider.Track>
              </Slider>

              <div className="flex items-center justify-between text-xs text-default-600">
                <span className="font-medium">Цвет</span>
                <input
                  type="color"
                  value={overlaySettings.text.color}
                  onChange={(event) =>
                    setOverlaySettings((prev) => ({
                      ...prev,
                      text: { ...prev.text, color: event.target.value }
                    }))
                  }
                  className="h-8 w-16 rounded border border-white/10 bg-transparent"
                />
              </div>

              <Button size="sm" variant="flat" onPress={handleCenterText}>
                Центрировать внутри подложки
              </Button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-default-500 font-bold uppercase tracking-wider">Подложка</div>
              <Slider
                step={10}
                maxValue={600}
                minValue={120}
                value={overlaySettings.background.width}
                onChange={(value) =>
                  setOverlaySettings((prev) => ({
                    ...prev,
                    background: { ...prev.background, width: value as number }
                  }))
                }
                className="w-full"
              >
                <div className="flex justify-between mb-1">
                  <Label className="text-xs font-medium text-default-600">Ширина</Label>
                  <Slider.Output className="text-xs font-bold text-default-600" />
                </div>
                <Slider.Track className="bg-default-500/20 h-1">
                  <Slider.Fill className="bg-primary" />
                  <Slider.Thumb className="bg-primary size-3" />
                </Slider.Track>
              </Slider>

              <Slider
                step={10}
                maxValue={300}
                minValue={60}
                value={overlaySettings.background.height}
                onChange={(value) =>
                  setOverlaySettings((prev) => ({
                    ...prev,
                    background: { ...prev.background, height: value as number }
                  }))
                }
                className="w-full"
              >
                <div className="flex justify-between mb-1">
                  <Label className="text-xs font-medium text-default-600">Высота</Label>
                  <Slider.Output className="text-xs font-bold text-default-600" />
                </div>
                <Slider.Track className="bg-default-500/20 h-1">
                  <Slider.Fill className="bg-secondary" />
                  <Slider.Thumb className="bg-secondary size-3" />
                </Slider.Track>
              </Slider>

              <Slider
                step={0.05}
                maxValue={1}
                minValue={0}
                value={overlaySettings.background.opacity}
                onChange={(value) =>
                  setOverlaySettings((prev) => ({
                    ...prev,
                    background: { ...prev.background, opacity: value as number }
                  }))
                }
                className="w-full"
              >
                <div className="flex justify-between mb-1">
                  <Label className="text-xs font-medium text-default-600">Прозрачность</Label>
                  <Slider.Output className="text-xs font-bold text-default-600" />
                </div>
                <Slider.Track className="bg-default-500/20 h-1">
                  <Slider.Fill className="bg-warning" />
                  <Slider.Thumb className="bg-warning size-3" />
                </Slider.Track>
              </Slider>

              <div className="flex items-center justify-between text-xs text-default-600">
                <span className="font-medium">Цвет</span>
                <input
                  type="color"
                  value={overlaySettings.background.color}
                  onChange={(event) =>
                    setOverlaySettings((prev) => ({
                      ...prev,
                      background: { ...prev.background, color: event.target.value }
                    }))
                  }
                  className="h-8 w-16 rounded border border-white/10 bg-transparent"
                />
              </div>

              <Button size="sm" variant="flat" onPress={handleCenterBackground}>
                Центрировать на канве
              </Button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-default-500 font-bold uppercase tracking-wider">Параметры профиля</div>
              <Slider
                step={profileConfig.step}
                maxValue={profileConfig.max}
                minValue={profileConfig.min}
                value={profileSettings[profileConfig.key]}
                onChange={(value) =>
                  setProfileSettings((prev) => ({
                    ...prev,
                    [profileConfig.key]: value as number
                  }))
                }
                className="w-full"
              >
                <div className="flex justify-between mb-1">
                  <Label className="text-xs font-medium text-default-600">{profileConfig.label}</Label>
                  <Slider.Output className="text-xs font-bold text-default-600" />
                </div>
                <Slider.Track className="bg-default-500/20 h-1">
                  <Slider.Fill className="bg-success" />
                  <Slider.Thumb className="bg-success size-3" />
                </Slider.Track>
              </Slider>
            </div>
          </ScrollShadow>
        </aside>
      </div>
    </div>
  )
}
