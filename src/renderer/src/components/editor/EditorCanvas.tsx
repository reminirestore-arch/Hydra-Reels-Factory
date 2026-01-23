// src/renderer/src/components/editor/EditorCanvas.tsx

import { useCallback, useEffect, useRef, useState, JSX } from 'react'
import * as fabric from 'fabric'
import { Button, ScrollShadow, Slider, Label } from '@heroui/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  MonitorPlay,
  Save,
  Type,
  X
} from 'lucide-react'
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

type OverlayText = fabric.Textbox | fabric.IText
type CanvasElementRole = 'overlay-background' | 'overlay-text' | 'frame'

interface CanvasElementNode {
  id: string
  label: string
  role: CanvasElementRole
  children?: CanvasElementNode[]
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
  const hostRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const domGenRef = useRef(0)

  const textRef = useRef<OverlayText | null>(null)
  const backgroundRef = useRef<fabric.Rect | null>(null)
  const linkRef = useRef({ attached: false, offsetX: 0, offsetY: 0, rotationOffset: 0 })
  const frameRef = useRef<fabric.FabricImage | null>(null)

  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(() => {
    const baseSettings = initialOverlaySettings ?? buildDefaultOverlaySettings()
    return {
      ...baseSettings,
      text: {
        ...baseSettings.text,
        align: baseSettings.text.align ?? 'center'
      },
      background: {
        ...baseSettings.background,
        radius: baseSettings.background.radius ?? 0
      }
    }
  })

  const [profileSettings, setProfileSettings] = useState<StrategyProfileSettings>(
    initialProfileSettings ?? createDefaultStrategy(strategyId).profileSettings
  )

  const resolveInitialTextValue = useCallback((): string => {
    if (!initialState || typeof initialState !== 'object') return 'Текст Рилса'

    const objects = (
      initialState as {
        objects?: Array<{ data?: { role?: string }; text?: string; type?: string }>
      }
    ).objects

    const textObject = objects?.find(
      (obj) =>
        obj.data?.role === 'overlay-text' ||
        obj.type === 'i-text' ||
        obj.type === 'textbox' ||
        obj.type === 'text'
    )

    return textObject?.text ?? 'Текст Рилса'
  }, [initialState])

  const [textValue, setTextValue] = useState<string>(resolveInitialTextValue)
  const [selectedRole, setSelectedRole] = useState<CanvasElementRole | null>(null)
  const [canvasElements, setCanvasElements] = useState<CanvasElementNode[]>([])
  const overlaySettingsRef = useRef(overlaySettings)

  const clampRadius = (radius: number, width: number, height: number): number =>
    Math.max(0, Math.min(radius, Math.min(width, height) / 2))

  const configureTextControls = useCallback((text: OverlayText): void => {
    text.set({ lockUniScaling: true })
  }, [])

  const refreshTextLayout = useCallback((text: OverlayText): void => {
    if ('initDimensions' in text) {
      ;(text as fabric.Textbox).initDimensions()
    }
    text.set({ dirty: true })
    text.setCoords()
  }, [])

  const updateTextValueFromCanvas = useCallback((): void => {
    if (!textRef.current) return
    setTextValue(textRef.current.text ?? '')
  }, [])

  const buildTextObject = useCallback(
    (textValueOverride?: string): fabric.Textbox =>
      new fabric.Textbox(textValueOverride ?? 'Текст Рилса', {
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        fontFamily: 'Arial',
        fill: overlaySettings.text.color,
        fontSize: overlaySettings.text.fontSize,
        fontWeight: 'bold',
        textAlign: overlaySettings.text.align,
        width: overlaySettings.background.width,
        originX: 'center',
        originY: 'center',
        editable: true,
        selectable: true,
        splitByGrapheme: false
      }),
    [
      overlaySettings.background.width,
      overlaySettings.text.align,
      overlaySettings.text.color,
      overlaySettings.text.fontSize
    ]
  )

  const clampTextToBackground = useCallback((): void => {
    if (!backgroundRef.current || !textRef.current) return

    const backgroundBounds = backgroundRef.current.getBoundingRect(true, true)
    const text = textRef.current

    const textWidth = text.getScaledWidth()
    const textHeight = text.getScaledHeight()

    const centerX = backgroundBounds.left + backgroundBounds.width / 2
    const centerY = backgroundBounds.top + backgroundBounds.height / 2

    const minX = backgroundBounds.left + textWidth / 2
    const maxX = backgroundBounds.left + backgroundBounds.width - textWidth / 2
    const minY = backgroundBounds.top + textHeight / 2
    const maxY = backgroundBounds.top + backgroundBounds.height - textHeight / 2

    const nextLeft = Math.min(Math.max(text.left ?? centerX, minX), maxX)
    const nextTop = Math.min(Math.max(text.top ?? centerY, minY), maxY)

    text.set({
      left: Number.isFinite(nextLeft) ? nextLeft : centerX,
      top: Number.isFinite(nextTop) ? nextTop : centerY
    })
    text.setCoords()
  }, [])

  const updateLinkOffsets = useCallback((): void => {
    if (!backgroundRef.current || !textRef.current) return

    const background = backgroundRef.current
    const text = textRef.current

    background.setCoords()
    text.setCoords()

    const backgroundCenter = background.getCenterPoint()
    const textCenter = text.getCenterPoint()

    const angle = fabric.util.degreesToRadians(background.angle ?? 0)
    const dx = textCenter.x - backgroundCenter.x
    const dy = textCenter.y - backgroundCenter.y

    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)

    const localX = dx * cos - dy * sin
    const localY = dx * sin + dy * cos

    linkRef.current.offsetX = localX / (background.scaleX ?? 1)
    linkRef.current.offsetY = localY / (background.scaleY ?? 1)
    linkRef.current.rotationOffset = (text.angle ?? 0) - (background.angle ?? 0)
  }, [])

  const attachTextToBackground = useCallback((): void => {
    linkRef.current.attached = true
    updateLinkOffsets()
  }, [updateLinkOffsets])

  const syncTextWithBackground = useCallback((): void => {
    if (!backgroundRef.current || !textRef.current || !linkRef.current.attached) return

    const background = backgroundRef.current
    const text = textRef.current

    const backgroundCenter = background.getCenterPoint()
    const angle = fabric.util.degreesToRadians(background.angle ?? 0)

    const scaledX = linkRef.current.offsetX * (background.scaleX ?? 1)
    const scaledY = linkRef.current.offsetY * (background.scaleY ?? 1)

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const rotatedX = scaledX * cos - scaledY * sin
    const rotatedY = scaledX * sin + scaledY * cos

    const targetCenter = new fabric.Point(
      backgroundCenter.x + rotatedX,
      backgroundCenter.y + rotatedY
    )

    text.set({
      left: targetCenter.x,
      top: targetCenter.y,
      angle: (background.angle ?? 0) + linkRef.current.rotationOffset,
      originX: 'center',
      originY: 'center'
    })
    text.setCoords()
  }, [])

  useEffect(() => {
    overlaySettingsRef.current = overlaySettings
  }, [overlaySettings])

  // ---------- Fabric canvas mount/unmount ----------
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (fabricRef.current) return

    const myGen = ++domGenRef.current

    host.replaceChildren()

    const el = document.createElement('canvas')
    el.width = CANVAS_WIDTH
    el.height = CANVAS_HEIGHT
    el.style.width = `${CANVAS_WIDTH}px`
    el.style.height = `${CANVAS_HEIGHT}px`
    host.appendChild(el)

    const canvas = new fabric.Canvas(el, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true,
      // В Electron + React это часто самый стабильный вариант (без рассинхрона pointer coords)
      enableRetinaScaling: false
    })

    const wrapper = (canvas as any).wrapperEl as HTMLDivElement | undefined
    if (wrapper) wrapper.style.touchAction = 'none'

    textRef.current = null
    backgroundRef.current = null
    linkRef.current = { attached: false, offsetX: 0, offsetY: 0, rotationOffset: 0 }

    requestAnimationFrame(() => {
      canvas.calcOffset()
      const ensureOffset = (): void => {
        canvas.calcOffset()
      }
      canvas.on('mouse:down', ensureOffset)
      canvas.requestRenderAll()
    })

    fabricRef.current = canvas

    return () => {
      if (fabricRef.current === canvas) fabricRef.current = null
      canvas.off()

      void canvas.dispose().finally(() => {
        const stillMine = domGenRef.current === myGen
        if (stillMine) host.replaceChildren()
      })
    }
  }, [])

  // Recalc offsets on host resize
  useEffect(() => {
    const canvas = fabricRef.current
    const host = hostRef.current
    if (!canvas || !host) return

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        canvas.calcOffset()
        canvas.requestRenderAll()
      })
    })

    ro.observe(host)

    requestAnimationFrame(() => {
      canvas.calcOffset()
      canvas.requestRenderAll()
    })

    return () => ro.disconnect()
  }, [])

  // ---------- Load preview frame ----------
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !filePath) return

    let cancelled = false

    // For now we always preview the very first frame (t=0).
    // If later you add a playhead/timeline, you can pass that here instead.
    const atSeconds = 0

    // маленький debounce, чтобы не спамить ffmpeg при перетаскивании слайдера
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const imageUrl = await window.api.extractFrame(filePath, strategyId, atSeconds)
          if (cancelled || !imageUrl) return

          const img = await fabric.FabricImage.fromURL(imageUrl)
          const scaleX = CANVAS_WIDTH / img.width!
          const scaleY = CANVAS_HEIGHT / img.height!
          const scale = Math.max(scaleX, scaleY)

          img.set({
            left: CANVAS_WIDTH / 2,
            top: CANVAS_HEIGHT / 2,
            originX: 'center',
            originY: 'center',
            scaleX: scale,
            scaleY: scale
          })

          frameRef.current = img
          canvas.backgroundImage = img
          canvas.requestRenderAll()
        } catch (err) {
          console.error('Ошибка загрузки кадра:', err)
        }
      })()
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [filePath, strategyId])

  // ---------- Apply overlay settings ----------
  const applyOverlaySettings = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    if (!canvas.backgroundImage && frameRef.current) {
      canvas.backgroundImage = frameRef.current
    }

    if (textRef.current) {
      textRef.current.set({
        fontSize: overlaySettings.text.fontSize,
        fill: overlaySettings.text.color,
        textAlign: overlaySettings.text.align,
        width: overlaySettings.background.width
      })
      refreshTextLayout(textRef.current)
    }

    if (backgroundRef.current) {
      const radius = clampRadius(
        overlaySettings.background.radius ?? 0,
        overlaySettings.background.width,
        overlaySettings.background.height
      )
      backgroundRef.current.set({
        width: overlaySettings.background.width,
        height: overlaySettings.background.height,
        fill: overlaySettings.background.color,
        opacity: overlaySettings.background.opacity,
        rx: radius,
        ry: radius
      })
      backgroundRef.current.setCoords()
    }

    clampTextToBackground()
    attachTextToBackground()
    canvas.requestRenderAll()
  }, [
    attachTextToBackground,
    clampTextToBackground,
    overlaySettings.background.color,
    overlaySettings.background.height,
    overlaySettings.background.opacity,
    overlaySettings.background.radius,
    overlaySettings.background.width,
    overlaySettings.text.align,
    overlaySettings.text.color,
    overlaySettings.text.fontSize
  ])

  const syncOverlayObjects = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    // refs могут остаться от старого инстанса — чистим, если canvas не совпадает
    if (textRef.current && (textRef.current as any).canvas !== canvas) textRef.current = null
    if (backgroundRef.current && (backgroundRef.current as any).canvas !== canvas)
      backgroundRef.current = null
    if ((linkRef.current?.attached ?? false) && (!textRef.current || !backgroundRef.current)) {
      linkRef.current = { attached: false, offsetX: 0, offsetY: 0, rotationOffset: 0 }
    }

    const objects = canvas.getObjects()
    const existingText = objects.find((obj) => {
      const role = (obj as { data?: { role?: string } }).data?.role
      return (
        role === 'overlay-text' ||
        obj.type === 'i-text' ||
        obj.type === 'textbox' ||
        obj.type === 'text'
      )
    })
    const existingBackground = objects.find((obj) => {
      const role = (obj as { data?: { role?: string } }).data?.role
      return role === 'overlay-background' || obj.type === 'rect'
    })

    if (
      existingText &&
      (existingText.type === 'i-text' || existingText.type === 'textbox' || existingText.type === 'text')
    ) {
      if (!(existingText as { data?: { role?: string } }).data?.role) {
        existingText.set({ data: { role: 'overlay-text' } })
      }
      if (existingText.type === 'i-text' || existingText.type === 'text') {
        const legacyText = existingText as fabric.IText
        const upgradedText = buildTextObject(legacyText.text ?? 'Текст Рилса')
        upgradedText.set({
          left: legacyText.left,
          top: legacyText.top,
          angle: legacyText.angle,
          fill: legacyText.fill,
          fontSize: legacyText.fontSize,
          fontWeight: legacyText.fontWeight,
          textAlign: overlaySettings.text.align
        })
        upgradedText.set({ data: { role: 'overlay-text' } })
        canvas.remove(legacyText)
        canvas.add(upgradedText)
        textRef.current = upgradedText
      } else {
        textRef.current = existingText as fabric.Textbox
      }
      configureTextControls(textRef.current)
      textRef.current.set({ selectable: true, evented: true })
    }

    if (existingBackground && existingBackground.type === 'rect') {
      if (!(existingBackground as { data?: { role?: string } }).data?.role) {
        existingBackground.set({ data: { role: 'overlay-background' } })
      }
      backgroundRef.current = existingBackground as fabric.Rect
      backgroundRef.current.set({ selectable: true, evented: true, hasControls: true })
    }

    if (!backgroundRef.current) {
      const radius = clampRadius(
        overlaySettings.background.radius ?? 0,
        overlaySettings.background.width,
        overlaySettings.background.height
      )
      const rect = new fabric.Rect({
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        width: overlaySettings.background.width,
        height: overlaySettings.background.height,
        originX: 'center',
        originY: 'center',
        fill: overlaySettings.background.color,
        opacity: overlaySettings.background.opacity,
        rx: radius,
        ry: radius,
        evented: true,
        selectable: true,
        hasControls: true,
        lockRotation: false,
        lockScalingX: false,
        lockScalingY: false
      })
      rect.set({ data: { role: 'overlay-background' } })
      backgroundRef.current = rect
      canvas.add(rect)
    }

    if (!textRef.current) {
      const text = buildTextObject()
      text.set({ data: { role: 'overlay-text' } })
      configureTextControls(text)
      textRef.current = text
      canvas.add(text)
    }

    if (backgroundRef.current && textRef.current) {
      canvas.bringObjectToFront(textRef.current)
    }

    attachTextToBackground()
    applyOverlaySettings()
    canvas.requestRenderAll()

    const elements: CanvasElementNode[] = [{ id: 'frame', label: 'Кадр видео', role: 'frame' }]
    if (backgroundRef.current) {
      elements.push({
        id: 'overlay-background',
        label: 'Подложка',
        role: 'overlay-background',
        children: textRef.current
          ? [{ id: 'overlay-text', label: 'Текст', role: 'overlay-text' }]
          : []
      })
    }
    setCanvasElements(elements)
  }, [
    applyOverlaySettings,
    attachTextToBackground,
    buildTextObject,
    configureTextControls,
    overlaySettings.background.color,
    overlaySettings.background.height,
    overlaySettings.background.opacity,
    overlaySettings.background.radius,
    overlaySettings.background.width,
    overlaySettings.text.align
  ])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !initialState) return

    const preservedBackground = canvas.backgroundImage

    canvas.loadFromJSON(initialState, () => {
      canvas.backgroundImage = preservedBackground ?? frameRef.current
      syncOverlayObjects()
      canvas.requestRenderAll()
    })
  }, [initialState, syncOverlayObjects])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || initialState) return
    syncOverlayObjects()
  }, [initialState, syncOverlayObjects])

  useEffect(() => {
    applyOverlaySettings()
  }, [applyOverlaySettings])

  // ---------- Fabric event handlers ----------
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const handleObjectMoving = (event: fabric.IEvent<MouseEvent>): void => {
      const target = event.target
      if (!target) return

      if (target === backgroundRef.current) {
        syncTextWithBackground()
      }

      if (target === textRef.current && backgroundRef.current) {
        clampTextToBackground()
        attachTextToBackground()
      }

      canvas.requestRenderAll()
    }

    const handleTextChanged = (): void => {
      updateTextValueFromCanvas()
      clampTextToBackground()
      attachTextToBackground()
    }

    const handleObjectScaling = (event: fabric.IEvent<MouseEvent>): void => {
      const target = event.target
      if (!target) return

      if (target === backgroundRef.current) {
        syncTextWithBackground()
      }

      if (target === textRef.current) {
        const text = textRef.current
        if (!text) return

        const scaleX = text.scaleX ?? 1
        const scaleY = text.scaleY ?? 1
        const uniformScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2

        text.set({ scaleX: uniformScale, scaleY: uniformScale })
        text.setCoords()
        clampTextToBackground()
      }
    }

    const handleObjectRotating = (event: fabric.IEvent<MouseEvent>): void => {
      const target = event.target
      if (!target) return
      if (target === backgroundRef.current) {
        syncTextWithBackground()
      }
    }

    const handleObjectModified = (event: fabric.IEvent<MouseEvent>): void => {
      const target = event.target
      if (!target) return

      if (target === textRef.current && textRef.current) {
        const text = textRef.current
        const scale = ((text.scaleX ?? 1) + (text.scaleY ?? 1)) / 2
        const currentFontSize = text.fontSize ?? overlaySettingsRef.current.text.fontSize
        const nextFontSize = Math.max(1, Math.round(currentFontSize * scale))

        text.set({ fontSize: nextFontSize, scaleX: 1, scaleY: 1 })
        text.setCoords()

        setOverlaySettings((prev) => ({
          ...prev,
          text: { ...prev.text, fontSize: nextFontSize }
        }))

        clampTextToBackground()
        attachTextToBackground()
      }

      if (target === backgroundRef.current && backgroundRef.current) {
        const background = backgroundRef.current
        const nextWidth = Math.max(20, (background.width ?? 0) * (background.scaleX ?? 1))
        const nextHeight = Math.max(20, (background.height ?? 0) * (background.scaleY ?? 1))

        background.set({ width: nextWidth, height: nextHeight, scaleX: 1, scaleY: 1 })

        const radius = clampRadius(
          overlaySettingsRef.current.background.radius ?? 0,
          nextWidth,
          nextHeight
        )
        background.set({ rx: radius, ry: radius })
        background.setCoords()

        setOverlaySettings((prev) => ({
          ...prev,
          background: { ...prev.background, width: nextWidth, height: nextHeight }
        }))

        if (linkRef.current.attached) {
          updateLinkOffsets()
          syncTextWithBackground()
        }

        clampTextToBackground()
        attachTextToBackground()
      }
    }

    const handleSelection = (): void => {
      const active = canvas.getActiveObject()
      const role = (active as { data?: { role?: CanvasElementRole } })?.data?.role ?? null
      setSelectedRole(role)
    }

    const handleSelectionCleared = (): void => {
      setSelectedRole(null)
    }

    canvas.on('object:moving', handleObjectMoving)
    canvas.on('object:scaling', handleObjectScaling)
    canvas.on('object:rotating', handleObjectRotating)
    canvas.on('object:modified', handleObjectModified)
    canvas.on('text:changed', handleTextChanged)
    canvas.on('selection:created', handleSelection)
    canvas.on('selection:updated', handleSelection)
    canvas.on('selection:cleared', handleSelectionCleared)

    return () => {
      canvas.off('object:moving', handleObjectMoving)
      canvas.off('object:scaling', handleObjectScaling)
      canvas.off('object:rotating', handleObjectRotating)
      canvas.off('object:modified', handleObjectModified)
      canvas.off('text:changed', handleTextChanged)
      canvas.off('selection:created', handleSelection)
      canvas.off('selection:updated', handleSelection)
      canvas.off('selection:cleared', handleSelectionCleared)
    }
  }, [
    attachTextToBackground,
    clampTextToBackground,
    syncTextWithBackground,
    updateLinkOffsets,
    updateTextValueFromCanvas
  ])

  // ---------- UI actions ----------
  const alignTextInsideBackground = (horizontal: 'left' | 'center' | 'right'): void => {
    if (!backgroundRef.current || !textRef.current) return

    const background = backgroundRef.current
    const text = textRef.current

    background.setCoords()
    const backgroundCenter = background.getCenterPoint()

    text.set({
      left: backgroundCenter.x,
      originX: 'center',
      textAlign: horizontal,
      width: background.getScaledWidth()
    })
    refreshTextLayout(text)

    clampTextToBackground()
    attachTextToBackground()
    fabricRef.current?.requestRenderAll()
  }

  const alignTextVertically = (vertical: 'top' | 'center' | 'bottom'): void => {
    if (!backgroundRef.current || !textRef.current) return

    const background = backgroundRef.current
    const text = textRef.current

    background.setCoords()
    const backgroundCenter = background.getCenterPoint()
    const backgroundHeight = background.getScaledHeight()
    const textHeight = text.getScaledHeight()
    const halfSpace = Math.max(0, (backgroundHeight - textHeight) / 2)

    const offset = vertical === 'top' ? -halfSpace : vertical === 'bottom' ? halfSpace : 0

    text.set({
      top: backgroundCenter.y + offset,
      originY: 'center'
    })
    refreshTextLayout(text)

    clampTextToBackground()
    attachTextToBackground()
    fabricRef.current?.requestRenderAll()
  }

  const handleCenterText = (): void => {
    if (!backgroundRef.current || !textRef.current) return
    textRef.current.set({
      left: backgroundRef.current.left,
      top: backgroundRef.current.top,
      angle: backgroundRef.current.angle ?? 0,
      originX: 'center',
      originY: 'center'
    })
    linkRef.current.rotationOffset = 0
    attachTextToBackground()
    fabricRef.current?.requestRenderAll()
  }

  const handleCenterBackgroundHorizontal = (): void => {
    if (!backgroundRef.current) return
    backgroundRef.current.set({ left: CANVAS_WIDTH / 2, originX: 'center' })
    backgroundRef.current.setCoords()
    syncTextWithBackground()
    fabricRef.current?.requestRenderAll()
  }

  const handleCenterBackgroundVertical = (): void => {
    if (!backgroundRef.current) return
    backgroundRef.current.set({ top: CANVAS_HEIGHT / 2, originY: 'center' })
    backgroundRef.current.setCoords()
    syncTextWithBackground()
    fabricRef.current?.requestRenderAll()
  }

  const addText = (): void => {
    syncOverlayObjects()
    if (textRef.current) fabricRef.current?.setActiveObject(textRef.current)
  }

  const handleSave = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    const background = canvas.backgroundImage
    canvas.backgroundImage = null
    canvas.requestRenderAll()

    const exportScale = 1080 / CANVAS_WIDTH
    const overlayDataUrl = canvas.toDataURL({ format: 'png', multiplier: exportScale })
    const canvasState = canvas.toJSON(['data'])

    canvas.backgroundImage = background
    canvas.requestRenderAll()

    const textData = canvas
      .getObjects()
      .filter((obj) => obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox')
      .map((obj) => (obj as OverlayText).text ?? '')
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
        return { key: 'focusStrength' as const, label: 'Сила фокуса', min: 0, max: 1, step: 0.05 }
      case 'IG2':
        return {
          key: 'motionSpeed' as const,
          label: 'Динамика движения',
          min: 0.8,
          max: 1.3,
          step: 0.01
        }
      case 'IG3':
        return { key: 'contrast' as const, label: 'Контраст', min: 0.8, max: 1.5, step: 0.05 }
      case 'IG4':
      default:
        return { key: 'grain' as const, label: 'Зерно', min: 0, max: 1, step: 0.05 }
    }
  })()

  return (
    <div className="flex flex-col h-full w-full bg-black/95">
      <div className="h-16 bg-black/50 border-b border-white/10 flex items-center justify-between px-6 shrink-0 backdrop-blur-md">
        <div className="flex gap-3">
          <Button
            size="sm"
            variant="primary"
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

        <div className="flex gap-2">
          <Button size="sm" variant="flat" onPress={onClose} className="font-medium">
            <X size={16} />
            Закрыть
          </Button>
          <Button
            size="sm"
            variant="solid"
            onPress={handleSave}
            className="font-medium bg-success text-black"
          >
            <Save size={16} />
            Сохранить
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="w-60 border-r border-white/10 bg-black/60">
          <ScrollShadow className="h-full p-4 space-y-4">
            <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
              Элементы канвы
            </div>
            <div className="space-y-2 text-sm text-default-300">
              {canvasElements.map((element) => (
                <div key={element.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (element.role === 'frame') {
                        fabricRef.current?.discardActiveObject()
                        fabricRef.current?.requestRenderAll()
                        return
                      }

                      const target =
                        element.role === 'overlay-background'
                          ? backgroundRef.current
                          : textRef.current
                      if (target) {
                        target.setCoords()
                        fabricRef.current?.setActiveObject(target)
                        fabricRef.current?.calcOffset()
                        fabricRef.current?.requestRenderAll()
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                      selectedRole === element.role
                        ? 'bg-primary/20 text-primary'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <span>{element.label}</span>
                    {element.children && element.children.length > 0 ? (
                      <span className="text-xs text-default-500">Группа</span>
                    ) : null}
                  </button>

                  {element.children && element.children.length > 0 ? (
                    <div className="ml-4 space-y-2">
                      {element.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            if (child.role === 'overlay-text' && textRef.current) {
                              textRef.current.setCoords()
                              fabricRef.current?.setActiveObject(textRef.current)
                              fabricRef.current?.calcOffset()
                              fabricRef.current?.requestRenderAll()
                            }
                          }}
                          className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${
                            selectedRole === child.role
                              ? 'bg-primary/15 text-primary'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollShadow>
        </aside>

        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-gray-900 to-black">
          <div className="relative shadow-2xl shadow-black ring-1 ring-white/10">
            <div
              ref={hostRef}
              className="relative"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            />
            <div className="pointer-events-none absolute inset-0 border border-white/5 mix-blend-overlay"></div>
          </div>
        </div>

        <aside className="w-96 border-l border-white/10 bg-black/60">
          <ScrollShadow className="h-full p-6 space-y-6">
            <div className="space-y-3">
              <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
                Тайминг текста
              </div>

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
                  <Label className="text-xs font-medium text-default-600">
                    Старт появления (сек)
                  </Label>
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
              <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
                Текст
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-default-600">Содержание</Label>
                <input
                  type="text"
                  value={textValue}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setTextValue(nextValue)
                    if (textRef.current) {
                      textRef.current.set({ text: nextValue })
                      clampTextToBackground()
                      attachTextToBackground()
                      fabricRef.current?.requestRenderAll()
                    }
                  }}
                  className="h-9 w-full rounded border border-white/10 bg-black/40 px-3 text-sm text-default-200 focus:border-primary/60 focus:outline-none"
                />
              </div>

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

              <div className="flex items-center justify-between text-xs text-default-600">
                <span className="font-medium">Выравнивание</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={overlaySettings.text.align === 'left' ? 'solid' : 'flat'}
                    onPress={() => {
                      setOverlaySettings((prev) => ({
                        ...prev,
                        text: { ...prev.text, align: 'left' }
                      }))
                      alignTextInsideBackground('left')
                    }}
                    className="min-w-9"
                  >
                    <AlignLeft size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant={overlaySettings.text.align === 'center' ? 'solid' : 'flat'}
                    onPress={() => {
                      setOverlaySettings((prev) => ({
                        ...prev,
                        text: { ...prev.text, align: 'center' }
                      }))
                      alignTextInsideBackground('center')
                    }}
                    className="min-w-9"
                  >
                    <AlignCenter size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant={overlaySettings.text.align === 'right' ? 'solid' : 'flat'}
                    onPress={() => {
                      setOverlaySettings((prev) => ({
                        ...prev,
                        text: { ...prev.text, align: 'right' }
                      }))
                      alignTextInsideBackground('right')
                    }}
                    className="min-w-9"
                  >
                    <AlignRight size={14} />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-default-600">
                <span className="font-medium">Вертикаль</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="flat" onPress={() => alignTextVertically('top')}>
                    <AlignVerticalJustifyStart size={14} />
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => alignTextVertically('center')}>
                    <AlignVerticalJustifyCenter size={14} />
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => alignTextVertically('bottom')}>
                    <AlignVerticalJustifyEnd size={14} />
                  </Button>
                </div>
              </div>

              <Button size="sm" variant="flat" onPress={handleCenterText}>
                Центрировать внутри подложки
              </Button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
                Подложка
              </div>

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
                step={2}
                maxValue={80}
                minValue={0}
                value={overlaySettings.background.radius}
                onChange={(value) =>
                  setOverlaySettings((prev) => ({
                    ...prev,
                    background: { ...prev.background, radius: value as number }
                  }))
                }
                className="w-full"
              >
                <div className="flex justify-between mb-1">
                  <Label className="text-xs font-medium text-default-600">Скругление</Label>
                  <Slider.Output className="text-xs font-bold text-default-600" />
                </div>
                <Slider.Track className="bg-default-500/20 h-1">
                  <Slider.Fill className="bg-primary" />
                  <Slider.Thumb className="bg-primary size-3" />
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

              <div className="flex gap-2">
                <Button size="sm" variant="flat" onPress={handleCenterBackgroundHorizontal}>
                  Центр по горизонтали
                </Button>
                <Button size="sm" variant="flat" onPress={handleCenterBackgroundVertical}>
                  Центр по вертикали
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
                Параметры профиля
              </div>

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
                  <Label className="text-xs font-medium text-default-600">
                    {profileConfig.label}
                  </Label>
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
