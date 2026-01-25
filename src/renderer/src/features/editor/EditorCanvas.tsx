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
const clampRadius = (radius: number, width: number, height: number): number =>
  Math.max(0, Math.min(radius, Math.min(width, height) / 2))
const sanitizeCanvasObjects = (canvas: fabric.Canvas): void => {
  const anyCanvas = canvas as fabric.Canvas & {
    _objects?: Array<fabric.Object | undefined | null>
  }
  if (!Array.isArray(anyCanvas._objects)) return
  const safeObjects = anyCanvas._objects.filter(
    (obj): obj is fabric.Object => Boolean(obj)
  )
  if (safeObjects.length !== anyCanvas._objects.length) {
    anyCanvas._objects = safeObjects
  }
}

const canvasToJSON = (canvas: fabric.Canvas, extraProps: string[] = []): object => {
  sanitizeCanvasObjects(canvas)
  const uniqueProps = new Set<string>(['data', ...extraProps])
  const toJSON = canvas.toJSON as unknown as (props?: string[]) => object
  return toJSON.call(canvas, Array.from(uniqueProps))
}

const cloneCanvasState = (state: object): object => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(state)
    } catch (error) {
      console.warn('Не удалось structuredClone для canvasState, fallback на JSON.', error)
    }
  }

  return JSON.parse(JSON.stringify(state)) as object
}

/**
 * Fabric: bounding boxes can be stale if coords weren't recalculated.
 * Always call `obj.setCoords()` before relying on the result.
 */
const getObjectBoundingRect = (
  obj: fabric.Object
): ReturnType<fabric.Object['getBoundingRect']> => {
  obj.setCoords()
  return obj.getBoundingRect()
}

type OverlayText = fabric.Textbox | fabric.IText | fabric.Text
type CanvasElementRole = 'overlay-background' | 'overlay-text' | 'frame'
interface OverlayBlock {
  id: number
  background: fabric.Rect
  text: OverlayText
}

type OverlayBlockDraft = Partial<OverlayBlock> & { id: number }

interface CanvasElementNode {
  id: string
  label: string
  role: CanvasElementRole
  blockId?: number
  children?: CanvasElementNode[]
}

const mergeOverlaySettings = (incoming?: OverlaySettings): OverlaySettings => {
  const d = buildDefaultOverlaySettings()

  // Важно: глубокий merge, чтобы не потерять nested поля (color/opacity и т.п.)
  return {
    timing: {
      ...d.timing,
      ...(incoming?.timing ?? {})
    },
    text: {
      ...d.text,
      ...(incoming?.text ?? {}),
      align: (incoming?.text?.align ?? d.text.align ?? 'center') as 'left' | 'center' | 'right',
      color: incoming?.text?.color ?? d.text.color,
      fontSize: incoming?.text?.fontSize ?? d.text.fontSize
    },
    background: {
      ...d.background,
      ...(incoming?.background ?? {}),
      color: incoming?.background?.color ?? d.background.color,
      opacity: incoming?.background?.opacity ?? d.background.opacity,
      width: incoming?.background?.width ?? d.background.width,
      height: incoming?.background?.height ?? d.background.height,
      radius: incoming?.background?.radius ?? d.background.radius
    }
  }
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

  const frameImageRef = useRef<fabric.FabricImage | null>(null)
  const syncingFromCanvasRef = useRef(false)
  const overlayMapRef = useRef<Map<number, OverlayBlock>>(new Map())
  const nextBlockIdRef = useRef(1)

  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(() =>
    mergeOverlaySettings(initialOverlaySettings)
  )

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
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [canvasElements, setCanvasElements] = useState<CanvasElementNode[]>([])
  const overlaySettingsRef = useRef(overlaySettings)
  const selectedBlockIdRef = useRef<number | null>(selectedBlockId)
  const textValueRef = useRef(textValue)
  const didHydrateRef = useRef(false)
  const lastHydrationRef = useRef<{ filePath: string; initialState: object | null }>({
    filePath,
    initialState: initialState ?? null
  })

  const getBlockId = (obj?: fabric.Object | null): number | null => {
    const blockId = (obj as { data?: { blockId?: number } })?.data?.blockId
    return typeof blockId === 'number' && Number.isFinite(blockId) ? blockId : null
  }

  const getOverlayBlock = (blockId?: number | null): OverlayBlock | null => {
    if (!blockId) return null
    return overlayMapRef.current.get(blockId) ?? null
  }

  const getFallbackBlockId = (): number | null => {
    const iterator = overlayMapRef.current.keys()
    const first = iterator.next()
    return first.done ? null : first.value
  }

  const getActiveBlockId = (): number | null =>
    selectedBlockIdRef.current ?? getFallbackBlockId()

  const configureTextControls = useCallback((text: OverlayText): void => {
    text.set({
      lockUniScaling: true,
      objectCaching: false
    })
  }, [])

  const updateTextValueFromCanvas = useCallback((text: OverlayText): void => {
    setTextValue(text.text ?? '')
  }, [])

  const ensureFrameImage = useCallback((): void => {
    const canvas = fabricRef.current
    const frame = frameImageRef.current
    if (!canvas || !frame) return
    if (canvas.backgroundImage !== frame) {
      canvas.backgroundImage = frame
      canvas.requestRenderAll()
    }
  }, [])

  const buildTextObject = useCallback((textValueOverride?: string): fabric.Textbox => {
    const settings = overlaySettingsRef.current
    return new fabric.Textbox(textValueOverride ?? 'Текст Рилса', {
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      fontFamily: 'Arial',
      fill: settings.text.color,
      fontSize: settings.text.fontSize,
      fontWeight: 'bold',
      textAlign: settings.text.align,
      width: settings.background.width,
      originX: 'center',
      originY: 'center',
      editable: true,
      selectable: true,
      splitByGrapheme: false,
      objectCaching: false
    })
  }, [])

  const buildBackgroundObject = useCallback((): fabric.Rect => {
    const settings = overlaySettingsRef.current
    const bw = settings.background.width
    const bh = settings.background.height
    const radius = clampRadius(settings.background.radius ?? 0, bw, bh)

    return new fabric.Rect({
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      width: bw,
      height: bh,
      originX: 'center',
      originY: 'center',
      fill: settings.background.color,
      opacity: settings.background.opacity,
      rx: radius,
      ry: radius,
      evented: true,
      selectable: true,
      hasControls: true,
      lockRotation: false,
      lockScalingX: false,
      lockScalingY: false,
      objectCaching: false
    })
  }, [])

  const clampTextToBackground = useCallback((background: fabric.Rect, text: OverlayText): void => {
    if (!background || !text) return

    background.setCoords()
    text.setCoords()

    const backgroundBounds = getObjectBoundingRect(background)
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

  const updateLinkOffsets = useCallback((background: fabric.Rect, text: OverlayText): void => {
    if (!background || !text) return

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

    const anyText = text as any
    anyText.data = {
      ...(anyText.data ?? {}),
      link: {
        offsetX: localX / (background.scaleX ?? 1),
        offsetY: localY / (background.scaleY ?? 1),
        rotationOffset: (text.angle ?? 0) - (background.angle ?? 0)
      }
    }
  }, [])

  const attachTextToBackground = useCallback(
    (background: fabric.Rect, text: OverlayText): void => {
      updateLinkOffsets(background, text)
    },
    [updateLinkOffsets]
  )

  const createOverlayBlock = useCallback(
    (blockId: number, textValueOverride?: string): OverlayBlock => {
      const background = buildBackgroundObject()
      const text = buildTextObject(textValueOverride)
      background.set({ data: { role: 'overlay-background', blockId } })
      text.set({ data: { role: 'overlay-text', blockId } })
      configureTextControls(text)

      const canvas = fabricRef.current
      if (canvas) {
        canvas.add(background)
        canvas.add(text)
        canvas.bringObjectToFront(text)
      }

      attachTextToBackground(background, text)
      clampTextToBackground(background, text)
      return { id: blockId, background, text }
    },
    [
      attachTextToBackground,
      clampTextToBackground,
      buildBackgroundObject,
      buildTextObject,
      configureTextControls
    ]
  )

  const syncTextWithBackground = useCallback(
    (background: fabric.Rect, text: OverlayText): void => {
      if (!background || !text) return
      const link = (text as any).data?.link as
        | { offsetX?: number; offsetY?: number; rotationOffset?: number }
        | undefined

      if (
        !link ||
        typeof link.offsetX !== 'number' ||
        typeof link.offsetY !== 'number' ||
        typeof link.rotationOffset !== 'number'
      ) {
        updateLinkOffsets(background, text)
      }

      const nextLink = (text as any).data?.link as
        | { offsetX?: number; offsetY?: number; rotationOffset?: number }
        | undefined
      if (!nextLink) return

      background.setCoords()
      text.setCoords()

      const backgroundCenter = background.getCenterPoint()
      const angle = fabric.util.degreesToRadians(background.angle ?? 0)

      const offsetX = nextLink.offsetX ?? 0
      const offsetY = nextLink.offsetY ?? 0
      const rotationOffset = nextLink.rotationOffset ?? 0
      const scaledX = offsetX * (background.scaleX ?? 1)
      const scaledY = offsetY * (background.scaleY ?? 1)

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
        angle: (background.angle ?? 0) + rotationOffset,
        originX: 'center',
        originY: 'center'
      })
      text.setCoords()
    },
    [updateLinkOffsets]
  )

  const restoreLinkFromText = useCallback(
    (background: fabric.Rect, text: OverlayText): boolean => {
      const link = (text as any).data?.link as
        | { offsetX?: number; offsetY?: number; rotationOffset?: number }
        | undefined

      if (
        typeof link?.offsetX === 'number' &&
        Number.isFinite(link.offsetX) &&
        typeof link?.offsetY === 'number' &&
        Number.isFinite(link.offsetY) &&
        typeof link?.rotationOffset === 'number' &&
        Number.isFinite(link.rotationOffset)
      ) {
        syncTextWithBackground(background, text)
        return true
      }

      return false
    },
    [syncTextWithBackground]
  )

  useEffect(() => {
    overlaySettingsRef.current = overlaySettings
  }, [overlaySettings])

  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId
  }, [selectedBlockId])

  useEffect(() => {
    textValueRef.current = textValue
  }, [textValue])

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
      enableRetinaScaling: false
    })

    const wrapper = (canvas as any).wrapperEl as HTMLDivElement | undefined
    if (wrapper) wrapper.style.touchAction = 'none'

    overlayMapRef.current = new Map()
    nextBlockIdRef.current = 1

    const canUseCanvas = (): boolean => {
      const liveCanvas = fabricRef.current === canvas
      const hasElements = Boolean((canvas as any).lowerCanvasEl && (canvas as any).upperCanvasEl)
      return liveCanvas && hasElements
    }

    requestAnimationFrame(() => {
      if (!canUseCanvas()) return
      canvas.calcOffset()
      const ensureOffset = (): void => {
        if (!canUseCanvas()) return
        canvas.calcOffset()
      }
      canvas.on('mouse:down', ensureOffset)
      canvas.requestRenderAll()
    })

    fabricRef.current = canvas

    return () => {
      if (fabricRef.current === canvas) fabricRef.current = null
      canvas.off()

      const stillMine = domGenRef.current === myGen
      try {
        canvas.dispose()
      } finally {
        if (stillMine) host.replaceChildren()
      }
    }
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    const host = hostRef.current
    if (!canvas || !host) return

    const canUseCanvas = (): boolean => {
      const liveCanvas = fabricRef.current === canvas
      const hasElements = Boolean((canvas as any).lowerCanvasEl && (canvas as any).upperCanvasEl)
      return liveCanvas && hasElements
    }

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!canUseCanvas()) return
        canvas.calcOffset()
        canvas.requestRenderAll()
      })
    })

    ro.observe(host)

    requestAnimationFrame(() => {
      if (!canUseCanvas()) return
      canvas.calcOffset()
      canvas.requestRenderAll()
    })

    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !filePath) return

    const loadFrame = async (): Promise<void> => {
      try {
        const raw = await window.api.extractFrame(filePath)
        const imageUrl =
          raw && typeof raw === 'object' && 'ok' in (raw as any)
            ? (raw as any).ok
              ? (raw as any).data
              : null
            : (raw as any)
        if (!imageUrl || typeof imageUrl !== 'string') return

        const img = await fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })

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

        frameImageRef.current = img
        canvas.backgroundImage = img
        canvas.requestRenderAll()
      } catch (err) {
        console.error('Ошибка загрузки кадра:', err)
      }
    }

    void loadFrame()
  }, [filePath])

  const applyOverlaySettings = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (syncingFromCanvasRef.current) return

    const activeBlock = getOverlayBlock(getActiveBlockId())
    if (!activeBlock) return

    // “Safe” страховка, даже если кто-то подсунет кривые settings
    const d = buildDefaultOverlaySettings()
    const safe: OverlaySettings = mergeOverlaySettings(overlaySettingsRef.current)

    const { text, background } = activeBlock

    text.set({
      fontSize: safe.text.fontSize ?? d.text.fontSize,
      fill: safe.text.color ?? d.text.color,
      textAlign: safe.text.align ?? d.text.align
    })
    text.setCoords()

    const bw = safe.background.width ?? d.background.width
    const bh = safe.background.height ?? d.background.height
    const radius = clampRadius(safe.background.radius ?? 0, bw, bh)

    background.set({
      width: bw,
      height: bh,
      fill: safe.background.color ?? d.background.color,
      opacity: safe.background.opacity ?? d.background.opacity,
      rx: radius,
      ry: radius
    })
    background.setCoords()

    // keep user's textbox width, but never exceed background width
    if (typeof text.width === 'number' && text.width > bw) {
      text.set({ width: bw })
      text.setCoords()
    }

    clampTextToBackground(background, text)
    attachTextToBackground(background, text)
    ensureFrameImage()
    canvas.requestRenderAll()
  }, [attachTextToBackground, clampTextToBackground, ensureFrameImage])

  const ensureRolesOnObjects = (canvas: fabric.Canvas): void => {
    const objects = canvas.getObjects()
    for (const obj of objects) {
      const anyObj = obj as any
      if (!anyObj.data) anyObj.data = {}

      // если это текст, но role отсутствует — ставим
      if (
        !anyObj.data.role &&
        (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text')
      ) {
        anyObj.data.role = 'overlay-text'
      }

      // если это rect, но role отсутствует — ставим
      if (!anyObj.data.role && obj.type === 'rect') {
        anyObj.data.role = 'overlay-background'
      }
    }
  }

  /**
   * Overlay architecture: every text + background pair shares a numeric blockId.
   * We persist blockId + link offsets in object.data so load/save round-trips are lossless.
   */
  const ensureOverlayIds = (canvas: fabric.Canvas): void => {
    const objects = canvas.getObjects()
    const backgrounds = objects.filter(
      (obj) => (obj as { data?: { role?: string } }).data?.role === 'overlay-background'
    )
    const texts = objects.filter(
      (obj) => (obj as { data?: { role?: string } }).data?.role === 'overlay-text'
    )

    const existingIds = new Set<number>()
    for (const obj of [...backgrounds, ...texts]) {
      const blockId = getBlockId(obj)
      if (blockId) existingIds.add(blockId)
    }

    let nextId = Math.max(0, ...existingIds) + 1
    const assignId = (obj: fabric.Object, blockId: number): void => {
      const anyObj = obj as any
      anyObj.data = { ...(anyObj.data ?? {}), blockId }
    }

    if (existingIds.size === 0 && (backgrounds.length > 0 || texts.length > 0)) {
      const pairCount = Math.max(backgrounds.length, texts.length)
      for (let i = 0; i < pairCount; i += 1) {
        const blockId = nextId++
        if (backgrounds[i]) assignId(backgrounds[i], blockId)
        if (texts[i]) assignId(texts[i], blockId)
      }
      nextBlockIdRef.current = nextId
      return
    }

    const missingBackgrounds = backgrounds.filter((obj) => !getBlockId(obj))
    const missingTexts = texts.filter((obj) => !getBlockId(obj))

    const pairCount = Math.max(missingBackgrounds.length, missingTexts.length)
    for (let i = 0; i < pairCount; i += 1) {
      const blockId = nextId++
      if (missingBackgrounds[i]) assignId(missingBackgrounds[i], blockId)
      if (missingTexts[i]) assignId(missingTexts[i], blockId)
    }

    nextBlockIdRef.current = Math.max(nextBlockIdRef.current, nextId)
  }

  const deriveOverlaySettingsFromBlock = useCallback((block: OverlayBlock): OverlaySettings => {
    const defaults = buildDefaultOverlaySettings()
    const background = block.background
    const text = block.text

    return mergeOverlaySettings({
      timing: overlaySettingsRef.current.timing,
      text: {
        ...overlaySettingsRef.current.text,
        fontSize: text.fontSize ?? defaults.text.fontSize,
        color: (text.fill as string) ?? defaults.text.color,
        align: (text.textAlign as 'left' | 'center' | 'right') ?? defaults.text.align
      },
      background: {
        ...overlaySettingsRef.current.background,
        width: background.width ?? defaults.background.width,
        height: background.height ?? defaults.background.height,
        radius: background.rx ?? defaults.background.radius,
        color: (background.fill as string) ?? defaults.background.color,
        opacity: background.opacity ?? defaults.background.opacity
      }
    })
  }, [])

  const rebuildOverlayMap = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    ensureRolesOnObjects(canvas)
    ensureOverlayIds(canvas)

    const blocks = new Map<number, OverlayBlockDraft>()
    const objects = canvas.getObjects()
    for (const obj of objects) {
      const role = (obj as { data?: { role?: CanvasElementRole } }).data?.role
      const blockId = getBlockId(obj)
      if (!blockId) continue

      const existing = blocks.get(blockId) ?? ({ id: blockId } as OverlayBlockDraft)
      if (role === 'overlay-background' && obj.type === 'rect') {
        blocks.set(blockId, { ...existing, id: blockId, background: obj as fabric.Rect })
      }
      if (
        role === 'overlay-text' &&
        (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')
      ) {
        blocks.set(blockId, { ...existing, id: blockId, text: obj as OverlayText })
      }
    }

    const completeBlocks = [...blocks.entries()].filter(
      ([, block]) => block.background && block.text
    ) as Array<[number, OverlayBlock]>

    overlayMapRef.current = new Map(completeBlocks)

    const elements: CanvasElementNode[] = [{ id: 'frame', label: 'Кадр видео', role: 'frame' }]
    const sortedBlocks = [...overlayMapRef.current.values()].sort((a, b) => a.id - b.id)
    sortedBlocks.forEach((block, index) => {
      elements.push({
        id: `overlay-background-${block.id}`,
        label: `Подложка ${index + 1}`,
        role: 'overlay-background',
        blockId: block.id,
        children: [
          {
            id: `overlay-text-${block.id}`,
            label: `Текст ${index + 1}`,
            role: 'overlay-text',
            blockId: block.id
          }
        ]
      })
    })
    setCanvasElements(elements)

    const fallbackBlock = getOverlayBlock(getActiveBlockId())
    if (fallbackBlock) {
      setOverlaySettings(deriveOverlaySettingsFromBlock(fallbackBlock))
      setTextValue(fallbackBlock.text.text ?? '')
    }
  }, [deriveOverlaySettingsFromBlock])

  const syncOverlayObjects = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    ensureRolesOnObjects(canvas)
    ensureOverlayIds(canvas)

    const objects = canvas.getObjects()
    const textObjects = objects.filter(
      (obj) => (obj as { data?: { role?: string } }).data?.role === 'overlay-text'
    )

    for (const obj of textObjects) {
      if (obj.type === 'i-text' || obj.type === 'text') {
        const legacyText = obj as fabric.IText | fabric.Text
        const blockId = getBlockId(legacyText) ?? nextBlockIdRef.current++
        const upgradedText = buildTextObject(legacyText.text ?? 'Текст Рилса')

        upgradedText.set({
          left: legacyText.left,
          top: legacyText.top,
          angle: legacyText.angle,
          fill: legacyText.fill,
          fontSize: legacyText.fontSize,
          fontWeight: legacyText.fontWeight,
          textAlign: overlaySettingsRef.current.text.align,
          objectCaching: false,
          data: { ...(legacyText as any).data, role: 'overlay-text', blockId }
        })

        canvas.remove(legacyText)
        canvas.add(upgradedText)
      } else if (obj.type === 'textbox') {
        const tb = obj as fabric.Textbox
        ;(tb as any).data = { ...(tb as any).data, role: 'overlay-text' }
        tb.set({ objectCaching: false })
        configureTextControls(tb)
      }
    }

    rebuildOverlayMap()

    // If nothing is selected yet (e.g. right after loading), pick the first block
    // so UI controls (alignment, etc.) have a stable target.
    if (!selectedBlockIdRef.current) {
      const first = Array.from(overlayMapRef.current.values())[0]
      if (first) {
        setSelectedBlockId(first.id)
        setOverlaySettings(deriveOverlaySettingsFromBlock(first))
        setTextValue(first.text.text ?? '')
      }
    }

    if (overlayMapRef.current.size === 0) {
      const blockId = nextBlockIdRef.current++
      const block = createOverlayBlock(blockId, textValueRef.current)
      overlayMapRef.current.set(blockId, block)
    }

    for (const block of overlayMapRef.current.values()) {
      const restored = restoreLinkFromText(block.background, block.text)
      if (!restored) {
        attachTextToBackground(block.background, block.text)
      }
      clampTextToBackground(block.background, block.text)
      block.background.set({ selectable: true, evented: true, hasControls: true })
      block.text.set({ selectable: true, evented: true })
      canvas.bringObjectToFront(block.text)
    }

    applyOverlaySettings()
    ensureFrameImage()
    canvas.requestRenderAll()
    rebuildOverlayMap()
  }, [
    applyOverlaySettings,
    attachTextToBackground,
    buildTextObject,
    clampTextToBackground,
    configureTextControls,
    createOverlayBlock,
    ensureFrameImage,
    rebuildOverlayMap,
    restoreLinkFromText,
    deriveOverlaySettingsFromBlock
  ])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    let isActive = true

    const canUseCanvas = (): boolean => {
      const liveCanvas = fabricRef.current === canvas
      const hasElements = Boolean((canvas as any).lowerCanvasEl && (canvas as any).upperCanvasEl)
      return liveCanvas && hasElements
    }

    const finalizeHydration = (): void => {
      if (!canUseCanvas()) return
      // важное место: гарантируем роли, иначе дальше любая логика будет “плыть”
      ensureRolesOnObjects(canvas)
      syncOverlayObjects()
      ensureFrameImage()
      canvas.requestRenderAll()
    }

    const lastHydration = lastHydrationRef.current
    const initialStateRef = initialState ?? null
    if (lastHydration.filePath !== filePath || lastHydration.initialState !== initialStateRef) {
      lastHydrationRef.current = { filePath, initialState: initialStateRef }
      didHydrateRef.current = false
    }

    if (didHydrateRef.current) {
      return () => {
        isActive = false
      }
    }
    didHydrateRef.current = true

    if (initialState) {
      if (!canUseCanvas()) {
        return () => {
          isActive = false
        }
      }
      let usedPromise = false
      let hydratedState: object = initialState
      try {
        hydratedState = cloneCanvasState(initialState)
      } catch (error) {
        console.warn('Не удалось подготовить canvasState для загрузки.', error)
      }

      try {
        const maybePromise = canvas.loadFromJSON(hydratedState, () => {
          if (!usedPromise) finalizeHydration()
        })
        usedPromise = Boolean((maybePromise as Promise<void> | undefined)?.then)
        if (usedPromise) {
          void (maybePromise as Promise<void>)
            .then(() => {
              finalizeHydration()
            })
            .catch((err) => {
              if (!isActive || !canUseCanvas()) return
              console.error('Ошибка восстановления канвы:', err)
              syncOverlayObjects()
            })
        }
      } catch (err) {
        console.error('Ошибка запуска восстановления канвы:', err)
        syncOverlayObjects()
      }
      return () => {
        isActive = false
      }
    }

    syncOverlayObjects()
    return () => {
      isActive = false
    }
  }, [ensureFrameImage, filePath, initialState, syncOverlayObjects])

  useEffect(() => {
    applyOverlaySettings()
  }, [applyOverlaySettings, overlaySettings])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const handleObjectMoving = (event: any): void => {
      const target = event.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return

      const role = (target as { data?: { role?: CanvasElementRole } }).data?.role
      if (role === 'overlay-background') {
        syncTextWithBackground(block.background, block.text)
      }

      if (role === 'overlay-text') {
        clampTextToBackground(block.background, block.text)
        attachTextToBackground(block.background, block.text)
      }

      canvas.requestRenderAll()
    }

    const handleTextChanged = (event: any): void => {
      const target = (event as any)?.target as OverlayText | undefined
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      updateTextValueFromCanvas(block.text)
      clampTextToBackground(block.background, block.text)
      attachTextToBackground(block.background, block.text)
    }

    const handleObjectScaling = (event: any): void => {
      const target = event.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return

      const role = (target as { data?: { role?: CanvasElementRole } }).data?.role
      if (role === 'overlay-background') {
        syncTextWithBackground(block.background, block.text)
      }

      if (role === 'overlay-text') {
        const text = block.text
        const scaleX = text.scaleX ?? 1
        const scaleY = text.scaleY ?? 1
        const uniformScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2
        text.set({ scaleX: uniformScale, scaleY: uniformScale })
        text.setCoords()
        clampTextToBackground(block.background, block.text)
      }
    }

    const handleObjectRotating = (event: any): void => {
      const target = event.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      const role = (target as { data?: { role?: CanvasElementRole } }).data?.role
      if (role === 'overlay-background') {
        syncTextWithBackground(block.background, block.text)
      }
    }

    const handleObjectModified = (event: any): void => {
      const target = event.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return

      const role = (target as { data?: { role?: CanvasElementRole } }).data?.role

      if (role === 'overlay-text') {
        const text = block.text
        const scale = ((text.scaleX ?? 1) + (text.scaleY ?? 1)) / 2
        const currentFontSize = text.fontSize ?? overlaySettingsRef.current.text.fontSize
        const nextFontSize = Math.max(1, Math.round(currentFontSize * scale))

        text.set({
          fontSize: nextFontSize,
          scaleX: 1,
          scaleY: 1
        })
        text.setCoords()

        if (getActiveBlockId() === block.id) {
          setOverlaySettings((prev) => ({
            ...prev,
            text: { ...prev.text, fontSize: nextFontSize }
          }))
        }

        clampTextToBackground(block.background, block.text)
        attachTextToBackground(block.background, block.text)
      }

      if (role === 'overlay-background') {
        const background = block.background
        const nextWidth = Math.max(20, (background.width ?? 0) * (background.scaleX ?? 1))
        const nextHeight = Math.max(20, (background.height ?? 0) * (background.scaleY ?? 1))

        background.set({
          width: nextWidth,
          height: nextHeight,
          scaleX: 1,
          scaleY: 1
        })

        const radius = clampRadius(
          overlaySettingsRef.current.background.radius ?? 0,
          nextWidth,
          nextHeight
        )
        background.set({ rx: radius, ry: radius })
        background.setCoords()

        if (getActiveBlockId() === block.id) {
          setOverlaySettings((prev) => ({
            ...prev,
            background: {
              ...prev.background,
              width: nextWidth,
              height: nextHeight
            }
          }))
        }

        updateLinkOffsets(block.background, block.text)
        syncTextWithBackground(block.background, block.text)
        clampTextToBackground(block.background, block.text)
        attachTextToBackground(block.background, block.text)
      }
    }

    const handleSelection = (): void => {
      const active = canvas.getActiveObject()
      const role = (active as { data?: { role?: CanvasElementRole } })?.data?.role ?? null
      const blockId = getBlockId(active)
      setSelectedRole(role)
      setSelectedBlockId(blockId)

      if (role === 'overlay-text' || role === 'overlay-background') {
        const block = getOverlayBlock(blockId)
        if (block) {
          syncingFromCanvasRef.current = true
          setOverlaySettings(deriveOverlaySettingsFromBlock(block))
          setTextValue(block.text.text ?? '')
          // allow the next user-driven change to propagate back to canvas
          setTimeout(() => {
            syncingFromCanvasRef.current = false
          }, 0)
        }
      }
    }
    const handleSelectionCleared = (): void => {
      setSelectedRole(null)
      setSelectedBlockId(null)
    }

    canvas.on('object:moving', handleObjectMoving as any)
    canvas.on('object:scaling', handleObjectScaling as any)
    canvas.on('object:rotating', handleObjectRotating as any)
    canvas.on('object:modified', handleObjectModified as any)
    canvas.on('text:changed', handleTextChanged as any)
    canvas.on('selection:created', handleSelection)
    canvas.on('selection:updated', handleSelection)
    canvas.on('selection:cleared', handleSelectionCleared as any)

    return () => {
      canvas.off('object:moving', handleObjectMoving as any)
      canvas.off('object:scaling', handleObjectScaling as any)
      canvas.off('object:rotating', handleObjectRotating as any)
      canvas.off('object:modified', handleObjectModified as any)
      canvas.off('text:changed', handleTextChanged as any)
      canvas.off('selection:created', handleSelection)
      canvas.off('selection:updated', handleSelection)
      canvas.off('selection:cleared', handleSelectionCleared as any)
    }
  }, [
    attachTextToBackground,
    clampTextToBackground,
    deriveOverlaySettingsFromBlock,
    syncTextWithBackground,
    updateLinkOffsets,
    updateTextValueFromCanvas
  ])

  const alignTextInsideBackground = (horizontal: 'left' | 'center' | 'right'): void => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (syncingFromCanvasRef.current) return

    const activeBlock = getOverlayBlock(getActiveBlockId())
    if (!activeBlock) return

    const background = activeBlock.background
    const text = activeBlock.text

    background.setCoords()
    text.setCoords()

    const rect = getObjectBoundingRect(background)
    const backgroundCenter = background.getCenterPoint()

    // Keep the text anchored via link offsets. Don't switch originX to left/right,
    // otherwise subsequent syncTextWithBackground will pull it back to center.
    const padding = 16
    const textW = text.getScaledWidth()
    const currentCenter = text.getCenterPoint()

    let targetCenterX = backgroundCenter.x
    if (horizontal === 'left') targetCenterX = rect.left + padding + textW / 2
    if (horizontal === 'right') targetCenterX = rect.left + rect.width - padding - textW / 2

    text.set({
      originX: 'center',
      left: targetCenterX,
      top: currentCenter.y,
      textAlign: horizontal
    })
    updateLinkOffsets(background, text)
    clampTextToBackground(background, text)
    canvas.requestRenderAll()
  }

  const alignTextVertically = (vertical: 'top' | 'center' | 'bottom'): void => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (syncingFromCanvasRef.current) return

    const activeBlock = getOverlayBlock(getActiveBlockId())
    if (!activeBlock) return

    const background = activeBlock.background
    const text = activeBlock.text

    background.setCoords()
    text.setCoords()

    const backgroundCenter = background.getCenterPoint()
    const bgRect = getObjectBoundingRect(background)
    const textHeight = text.getScaledHeight()
    const halfText = textHeight / 2

    const targetY =
      vertical === 'top'
        ? bgRect.top + halfText
        : vertical === 'bottom'
          ? bgRect.top + bgRect.height - halfText
          : backgroundCenter.y

    text.set({ top: targetY, originY: 'center' })
    text.setCoords()

    clampTextToBackground(background, text)
    attachTextToBackground(background, text)
    ensureFrameImage()
    canvas.requestRenderAll()
  }

  const handleCenterText = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (syncingFromCanvasRef.current) return

    const activeBlock = getOverlayBlock(getActiveBlockId())
    if (!activeBlock) return

    activeBlock.text.set({
      left: activeBlock.background.left,
      top: activeBlock.background.top,
      angle: activeBlock.background.angle ?? 0,
      originX: 'center',
      originY: 'center'
    })
    attachTextToBackground(activeBlock.background, activeBlock.text)
    ensureFrameImage()
    canvas.requestRenderAll()
  }

  const handleCenterBackgroundHorizontal = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (syncingFromCanvasRef.current) return

    const activeBlock = getOverlayBlock(getActiveBlockId())
    if (!activeBlock) return

    activeBlock.background.set({ left: CANVAS_WIDTH / 2, originX: 'center' })
    activeBlock.background.setCoords()
    syncTextWithBackground(activeBlock.background, activeBlock.text)
    ensureFrameImage()
    canvas.requestRenderAll()
  }

  const handleCenterBackgroundVertical = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (syncingFromCanvasRef.current) return

    const activeBlock = getOverlayBlock(getActiveBlockId())
    if (!activeBlock) return

    activeBlock.background.set({ top: CANVAS_HEIGHT / 2, originY: 'center' })
    activeBlock.background.setCoords()
    syncTextWithBackground(activeBlock.background, activeBlock.text)
    ensureFrameImage()
    canvas.requestRenderAll()
  }

  const addText = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return
    const blockId = nextBlockIdRef.current++
    const block = createOverlayBlock(blockId)
    overlayMapRef.current.set(blockId, block)
    canvas.setActiveObject(block.text)
    setSelectedRole('overlay-text')
    setSelectedBlockId(blockId)
    ensureFrameImage()
    rebuildOverlayMap()
  }

  const handleSave = (): void => {
    const canvas = fabricRef.current
    if (!canvas) return

    const bg = canvas.backgroundImage ?? undefined
    try {
      canvas.backgroundImage = undefined
      canvas.requestRenderAll()

      const exportScale = 1080 / CANVAS_WIDTH
      const overlayDataUrl = canvas.toDataURL({ format: 'png', multiplier: exportScale })
      const canvasState = cloneCanvasState(canvasToJSON(canvas, ['data']))

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
        overlaySettings: mergeOverlaySettings(overlaySettings), // <- сохраняем “полные” настройки
        profileSettings
      })
    } finally {
      canvas.backgroundImage = bg
      ensureFrameImage()
      canvas.requestRenderAll()
    }
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
                        setSelectedRole('frame')
                        setSelectedBlockId(null)
                        return
                      }
                      const block = getOverlayBlock(element.blockId)
                      const target =
                        element.role === 'overlay-background' ? block?.background : block?.text
                      if (target) {
                        target.setCoords()
                        fabricRef.current?.setActiveObject(target)
                        fabricRef.current?.calcOffset()
                        fabricRef.current?.requestRenderAll()
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                      selectedRole === element.role &&
                      (element.role === 'frame' || selectedBlockId === element.blockId)
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
                            const block = getOverlayBlock(child.blockId)
                            if (child.role === 'overlay-text' && block?.text) {
                              block.text.setCoords()
                              fabricRef.current?.setActiveObject(block.text)
                              fabricRef.current?.calcOffset()
                              fabricRef.current?.requestRenderAll()
                            }
                          }}
                          className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${
                            selectedRole === child.role && selectedBlockId === child.blockId
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
                    const block = getOverlayBlock(getActiveBlockId())
                    if (block) {
                      block.text.set({ text: nextValue })
                      clampTextToBackground(block.background, block.text)
                      attachTextToBackground(block.background, block.text)
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
