import { useCallback, useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { OverlaySettings } from '@shared/types'
import { buildDefaultOverlaySettings } from '@shared/defaults'
import {
  OverlayBlock,
  OverlayBlockDraft,
  CanvasElementNode,
  OverlayText,
  CanvasElementRole,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  clampRadius,
  getObjectBoundingRect,
  mergeOverlaySettings
} from '../utils/fabricHelpers'

// Локальный тип для ref
type MutableRef<T> = { current: T }

interface UseOverlayLogicProps {
  fabricRef: MutableRef<fabric.Canvas | null>
  isCanvasReadyRef: MutableRef<boolean>
  canvasInstance: fabric.Canvas | null
  overlaySettings: OverlaySettings
  setOverlaySettings: (s: OverlaySettings) => void
  initialState?: object
}

export const useOverlayLogic = ({
  fabricRef,
  isCanvasReadyRef,
  canvasInstance,
  overlaySettings,
  setOverlaySettings,
  initialState
}: UseOverlayLogicProps) => {
  const overlayMapRef = useRef<Map<number, OverlayBlock>>(new Map())
  const nextBlockIdRef = useRef(1)
  const syncingFromCanvasRef = useRef(false)
  const frameImageRef = useRef<fabric.FabricImage | null>(null)

  const overlaySettingsRef = useRef(overlaySettings)

  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const selectedBlockIdRef = useRef<number | null>(selectedBlockId)

  const [selectedRole, setSelectedRole] = useState<CanvasElementRole | null>(null)
  const [canvasElements, setCanvasElements] = useState<CanvasElementNode[]>([])

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
  const textValueRef = useRef(textValue)

  // Sync refs
  useEffect(() => {
    overlaySettingsRef.current = overlaySettings
  }, [overlaySettings])
  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId
  }, [selectedBlockId])
  useEffect(() => {
    textValueRef.current = textValue
  }, [textValue])

  // --- Helpers ---
  const getBlockId = useCallback((obj?: fabric.Object | null): number | null => {
    const blockId = (obj as { data?: { blockId?: number } })?.data?.blockId
    return typeof blockId === 'number' && Number.isFinite(blockId) ? blockId : null
  }, [])

  const getOverlayBlock = useCallback((blockId?: number | null): OverlayBlock | null => {
    if (!blockId) return null
    return overlayMapRef.current.get(blockId) ?? null
  }, [])

  const getFallbackBlockId = useCallback((): number | null => {
    const iterator = overlayMapRef.current.keys()
    const first = iterator.next()
    return first.done ? null : first.value
  }, [])

  const getActiveBlockId = useCallback(
    (): number | null => selectedBlockIdRef.current ?? getFallbackBlockId(),
    [getFallbackBlockId]
  )

  const configureTextControls = useCallback((text: OverlayText): void => {
    text.set({ lockUniScaling: true, objectCaching: false })
  }, [])

  const updateTextValueFromCanvas = useCallback((text: OverlayText): void => {
    setTextValue(text.text ?? '')
  }, [])

  const ensureFrameImage = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    const frame = frameImageRef.current
    if (!frame) return

    // Проверяем, установлен ли фон, и если нет или он другой - обновляем
    if (canvas.backgroundImage !== frame) {
      console.log('[useOverlayLogic] Restoring background image frame')
      canvas.set('backgroundImage', frame)
      if (canvas.contextContainer) canvas.requestRenderAll()
    }
  }, [fabricRef, isCanvasReadyRef])

  // --- Object Builders ---
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

  // --- Positioning Logic ---
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

  const syncTextWithBackground = useCallback(
    (background: fabric.Rect, text: OverlayText): void => {
      if (!background || !text) return
      const link = (text as any).data?.link
      if (!link) {
        updateLinkOffsets(background, text)
        return
      }

      background.setCoords()
      text.setCoords()

      const backgroundCenter = background.getCenterPoint()
      const angle = fabric.util.degreesToRadians(background.angle ?? 0)
      const offsetX = link.offsetX ?? 0
      const offsetY = link.offsetY ?? 0
      const rotationOffset = link.rotationOffset ?? 0

      const scaledX = offsetX * (background.scaleX ?? 1)
      const scaledY = offsetY * (background.scaleY ?? 1)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      const rotatedX = scaledX * cos - scaledY * sin
      const rotatedY = scaledX * sin + scaledY * cos

      text.set({
        left: backgroundCenter.x + rotatedX,
        top: backgroundCenter.y + rotatedY,
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
      const link = (text as any).data?.link
      if (link && typeof link.offsetX === 'number') {
        syncTextWithBackground(background, text)
        return true
      }
      return false
    },
    [syncTextWithBackground]
  )

  // --- Core Logic ---
  const createOverlayBlock = useCallback(
    (blockId: number, textValueOverride?: string): OverlayBlock => {
      const background = buildBackgroundObject()
      const text = buildTextObject(textValueOverride)
      background.set({ data: { role: 'overlay-background', blockId } })
      text.set({ data: { role: 'overlay-text', blockId } })
      configureTextControls(text)

      const canvas = fabricRef.current
      if (canvas && isCanvasReadyRef.current) {
        canvas.add(background)
        canvas.add(text)
        canvas.bringObjectToFront(text)
      }

      attachTextToBackground(background, text)
      clampTextToBackground(background, text)
      return { id: blockId, background, text }
    },
    [
      buildBackgroundObject,
      buildTextObject,
      configureTextControls,
      attachTextToBackground,
      clampTextToBackground,
      fabricRef,
      isCanvasReadyRef
    ]
  )

  const ensureRolesOnObjects = useCallback((canvas: fabric.Canvas): void => {
    const objects = canvas.getObjects()
    for (const obj of objects) {
      const anyObj = obj as any
      if (!anyObj.data) anyObj.data = {}
      if (
        !anyObj.data.role &&
        (obj instanceof fabric.IText ||
          obj instanceof fabric.Textbox ||
          obj instanceof fabric.FabricText)
      ) {
        anyObj.data.role = 'overlay-text'
      }
      if (!anyObj.data.role && obj instanceof fabric.Rect) {
        anyObj.data.role = 'overlay-background'
      }
    }
  }, [])

  const ensureOverlayIds = useCallback(
    (canvas: fabric.Canvas): void => {
      const objects = canvas.getObjects()
      const backgrounds = objects.filter((obj) => (obj as any).data?.role === 'overlay-background')
      const texts = objects.filter((obj) => (obj as any).data?.role === 'overlay-text')

      const existingIds = new Set<number>()
      ;[...backgrounds, ...texts].forEach((obj) => {
        const id = getBlockId(obj)
        if (id) existingIds.add(id)
      })

      let nextId = Math.max(0, ...existingIds) + 1
      const assignId = (obj: any, blockId: number) => {
        obj.data = { ...(obj.data ?? {}), blockId }
      }

      if (existingIds.size === 0 && (backgrounds.length > 0 || texts.length > 0)) {
        const count = Math.max(backgrounds.length, texts.length)
        for (let i = 0; i < count; i++) {
          const blockId = nextId++
          if (backgrounds[i]) assignId(backgrounds[i], blockId)
          if (texts[i]) assignId(texts[i], blockId)
        }
        nextBlockIdRef.current = nextId
        return
      }

      const missingBg = backgrounds.filter((o) => !getBlockId(o))
      const missingTx = texts.filter((o) => !getBlockId(o))
      const count = Math.max(missingBg.length, missingTx.length)
      for (let i = 0; i < count; i++) {
        const blockId = nextId++
        if (missingBg[i]) assignId(missingBg[i], blockId)
        if (missingTx[i]) assignId(missingTx[i], blockId)
      }
      nextBlockIdRef.current = Math.max(nextBlockIdRef.current, nextId)
    },
    [getBlockId]
  )

  const deriveOverlaySettingsFromBlock = useCallback((block: OverlayBlock): OverlaySettings => {
    const defaults = buildDefaultOverlaySettings()
    const { background, text } = block
    return mergeOverlaySettings({
      timing: overlaySettingsRef.current.timing,
      text: {
        ...overlaySettingsRef.current.text,
        fontSize: text.fontSize ?? defaults.text.fontSize,
        color: (text.fill as string) ?? defaults.text.color,
        align: (text.textAlign as any) ?? defaults.text.align
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
    if (!canvas || !isCanvasReadyRef.current) return
    ensureRolesOnObjects(canvas)
    ensureOverlayIds(canvas)

    const blocks = new Map<number, OverlayBlockDraft>()
    const objects = canvas.getObjects()
    for (const obj of objects) {
      const role = (obj as any).data?.role
      const blockId = getBlockId(obj)
      if (!blockId) continue

      const existing = blocks.get(blockId) ?? { id: blockId }
      if (role === 'overlay-background' && obj instanceof fabric.Rect) {
        blocks.set(blockId, { ...existing, id: blockId, background: obj })
      }
      if (
        role === 'overlay-text' &&
        (obj instanceof fabric.Textbox ||
          obj instanceof fabric.IText ||
          obj instanceof fabric.FabricText)
      ) {
        blocks.set(blockId, { ...existing, id: blockId, text: obj as OverlayText })
      }
    }

    const completeBlocks = [...blocks.entries()].filter(([, b]) => b.background && b.text) as Array<
      [number, OverlayBlock]
    >
    overlayMapRef.current = new Map(completeBlocks)

    const elements: CanvasElementNode[] = [{ id: 'frame', label: 'Кадр видео', role: 'frame' }]
    const sorted = [...overlayMapRef.current.values()].sort((a, b) => a.id - b.id)

    sorted.forEach((block, index) => {
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

    const activeBlock = getOverlayBlock(getActiveBlockId())
    if (activeBlock) {
      setOverlaySettings(deriveOverlaySettingsFromBlock(activeBlock))
      setTextValue(activeBlock.text.text ?? '')
    }
  }, [
    ensureRolesOnObjects,
    ensureOverlayIds,
    getBlockId,
    getOverlayBlock,
    getActiveBlockId,
    deriveOverlaySettingsFromBlock,
    setOverlaySettings,
    isCanvasReadyRef,
    fabricRef
  ])

  const applyOverlaySettings = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current || syncingFromCanvasRef.current) return
    const activeBlock = getOverlayBlock(getActiveBlockId())
    if (!activeBlock) return

    const d = buildDefaultOverlaySettings()
    const safe = mergeOverlaySettings(overlaySettingsRef.current)
    const { text, background } = activeBlock

    text.set({
      fontSize: safe.text.fontSize ?? d.text.fontSize,
      fill: safe.text.color ?? d.text.color,
      textAlign: safe.text.align ?? d.text.align
    })

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

    if (text.width! > bw) text.set({ width: bw })

    clampTextToBackground(background, text)
    attachTextToBackground(background, text)
    ensureFrameImage()
    if (canvas.contextContainer) canvas.requestRenderAll()
  }, [
    fabricRef,
    isCanvasReadyRef,
    getOverlayBlock,
    getActiveBlockId,
    clampTextToBackground,
    attachTextToBackground,
    ensureFrameImage
  ])

  const syncOverlayObjects = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    ensureRolesOnObjects(canvas)
    ensureOverlayIds(canvas)

    const objects = canvas.getObjects()
    objects.forEach((obj) => {
      const role = (obj as any).data?.role
      if (role === 'overlay-text') {
        obj.set({ objectCaching: false })
        if (obj instanceof fabric.Textbox) configureTextControls(obj)
      }
      if (role === 'overlay-background') obj.set({ objectCaching: false })
    })

    rebuildOverlayMap()

    // Handle empty canvas or initial load
    if (overlayMapRef.current.size === 0) {
      const hasText = objects.some((o) => o instanceof fabric.Textbox || o instanceof fabric.IText)
      if (!hasText) {
        const blockId = nextBlockIdRef.current++
        const block = createOverlayBlock(blockId, textValueRef.current)
        overlayMapRef.current.set(blockId, block)
        applyOverlaySettings()
      }
    } else if (!selectedBlockIdRef.current) {
      const first = Array.from(overlayMapRef.current.values())[0]
      if (first) {
        setSelectedBlockId(first.id)
        const settings = deriveOverlaySettingsFromBlock(first)
        setOverlaySettings(settings)
        setTextValue(first.text.text ?? '')

        syncingFromCanvasRef.current = true
        setTimeout(() => {
          syncingFromCanvasRef.current = false
        }, 50)
      }
    }

    for (const block of overlayMapRef.current.values()) {
      const restored = restoreLinkFromText(block.background, block.text)
      if (!restored) attachTextToBackground(block.background, block.text)
      clampTextToBackground(block.background, block.text)
      block.background.set({ selectable: true, evented: true, hasControls: true })
      block.text.set({ selectable: true, evented: true })
      canvas.bringObjectToFront(block.text)
    }

    ensureFrameImage()
    if (canvas.contextContainer && isCanvasReadyRef.current) canvas.requestRenderAll()
    rebuildOverlayMap()
  }, [
    fabricRef,
    ensureRolesOnObjects,
    ensureOverlayIds,
    rebuildOverlayMap,
    createOverlayBlock,
    applyOverlaySettings,
    deriveOverlaySettingsFromBlock,
    setOverlaySettings,
    restoreLinkFromText,
    attachTextToBackground,
    clampTextToBackground,
    ensureFrameImage,
    configureTextControls,
    isCanvasReadyRef
  ])

  // --- Public Actions ---
  const addText = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    const blockId = nextBlockIdRef.current++
    const block = createOverlayBlock(blockId)
    overlayMapRef.current.set(blockId, block)
    canvas.setActiveObject(block.text)
    setSelectedRole('overlay-text')
    setSelectedBlockId(blockId)
    ensureFrameImage()
    rebuildOverlayMap()
  }, [fabricRef, isCanvasReadyRef, createOverlayBlock, ensureFrameImage, rebuildOverlayMap])

  // --- Event Listeners ---
  useEffect(() => {
    if (!canvasInstance) return
    const canvas = canvasInstance

    const handleObjectMoving = (e: any) => {
      const target = e.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      const role = (target as any).data?.role
      if (role === 'overlay-background') syncTextWithBackground(block.background, block.text)
      if (role === 'overlay-text') {
        clampTextToBackground(block.background, block.text)
        attachTextToBackground(block.background, block.text)
      }
      canvas.requestRenderAll()
    }

    const handleTextChanged = (e: any) => {
      const target = e.target as OverlayText
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      updateTextValueFromCanvas(block.text)
      clampTextToBackground(block.background, block.text)
      attachTextToBackground(block.background, block.text)
    }

    const handleObjectScaling = (e: any) => {
      const target = e.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      const role = (target as any).data?.role
      if (role === 'overlay-background') syncTextWithBackground(block.background, block.text)
      if (role === 'overlay-text') {
        const t = block.text
        const s = (Math.abs(t.scaleX!) + Math.abs(t.scaleY!)) / 2
        t.set({ scaleX: s, scaleY: s })
        clampTextToBackground(block.background, block.text)
      }
    }

    const handleObjectRotating = (e: any) => {
      const target = e.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (block && (target as any).data?.role === 'overlay-background') {
        syncTextWithBackground(block.background, block.text)
      }
    }

    const handleObjectModified = (e: any) => {
      const target = e.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      const role = (target as any).data?.role

      if (role === 'overlay-text') {
        const t = block.text
        const s = ((t.scaleX ?? 1) + (t.scaleY ?? 1)) / 2
        const curSize = t.fontSize ?? overlaySettingsRef.current.text.fontSize
        const nextSize = Math.max(1, Math.round(curSize * s))
        t.set({ fontSize: nextSize, scaleX: 1, scaleY: 1 })
        t.setCoords()
        if (getActiveBlockId() === block.id) {
          setOverlaySettings({
            ...overlaySettingsRef.current,
            text: { ...overlaySettingsRef.current.text, fontSize: nextSize }
          })
        }
        clampTextToBackground(block.background, block.text)
        attachTextToBackground(block.background, block.text)
      }
      if (role === 'overlay-background') {
        const b = block.background
        const nw = Math.max(20, (b.width ?? 0) * (b.scaleX ?? 1))
        const nh = Math.max(20, (b.height ?? 0) * (b.scaleY ?? 1))
        b.set({ width: nw, height: nh, scaleX: 1, scaleY: 1 })
        const rad = clampRadius(overlaySettingsRef.current.background.radius ?? 0, nw, nh)
        b.set({ rx: rad, ry: rad })
        b.setCoords()
        if (getActiveBlockId() === block.id) {
          setOverlaySettings({
            ...overlaySettingsRef.current,
            background: { ...overlaySettingsRef.current.background, width: nw, height: nh }
          })
        }
        updateLinkOffsets(block.background, block.text)
        syncTextWithBackground(block.background, block.text)
        clampTextToBackground(block.background, block.text)
        attachTextToBackground(block.background, block.text)
      }
    }

    const handleSelection = () => {
      const active = canvas.getActiveObject()
      const role = (active as any)?.data?.role ?? null
      const blockId = getBlockId(active)
      setSelectedRole(role)
      setSelectedBlockId(blockId)
      if ((role === 'overlay-text' || role === 'overlay-background') && blockId) {
        const block = getOverlayBlock(blockId)
        if (block) {
          syncingFromCanvasRef.current = true
          setOverlaySettings(deriveOverlaySettingsFromBlock(block))
          setTextValue(block.text.text ?? '')
          setTimeout(() => {
            syncingFromCanvasRef.current = false
          }, 0)
        }
      }
    }

    const handleCleared = () => {
      setSelectedRole(null)
      setSelectedBlockId(null)
    }

    canvas.on('object:moving', handleObjectMoving)
    canvas.on('object:scaling', handleObjectScaling)
    canvas.on('object:rotating', handleObjectRotating)
    canvas.on('object:modified', handleObjectModified)
    canvas.on('text:changed', handleTextChanged)
    canvas.on('selection:created', handleSelection)
    canvas.on('selection:updated', handleSelection)
    canvas.on('selection:cleared', handleCleared)

    return () => {
      canvas.off('object:moving', handleObjectMoving)
      canvas.off('object:scaling', handleObjectScaling)
      canvas.off('object:rotating', handleObjectRotating)
      canvas.off('object:modified', handleObjectModified)
      canvas.off('text:changed', handleTextChanged)
      canvas.off('selection:created', handleSelection)
      canvas.off('selection:updated', handleSelection)
      canvas.off('selection:cleared', handleCleared)
    }
  }, [
    canvasInstance,
    getOverlayBlock,
    getBlockId,
    getActiveBlockId,
    syncTextWithBackground,
    clampTextToBackground,
    attachTextToBackground,
    updateTextValueFromCanvas,
    updateLinkOffsets,
    deriveOverlaySettingsFromBlock,
    setOverlaySettings
  ])

  // --- Alignment Helpers ---
  const alignTextInsideBackground = useCallback(
    (horizontal: 'left' | 'center' | 'right') => {
      const canvas = fabricRef.current
      if (!canvas || !isCanvasReadyRef.current) return
      const block = getOverlayBlock(getActiveBlockId())
      if (!block) return

      const { background, text } = block
      background.setCoords()
      text.setCoords()
      const rect = getObjectBoundingRect(background)
      const textW = text.getScaledWidth()
      const pad = 16

      let tx = rect.left + rect.width / 2
      if (horizontal === 'left') tx = rect.left + pad + textW / 2
      if (horizontal === 'right') tx = rect.left + rect.width - pad - textW / 2

      text.set({ left: tx, textAlign: horizontal, originX: 'center' })
      updateLinkOffsets(background, text)
      clampTextToBackground(background, text)
      canvas.requestRenderAll()
    },
    [
      fabricRef,
      isCanvasReadyRef,
      getOverlayBlock,
      getActiveBlockId,
      updateLinkOffsets,
      clampTextToBackground
    ]
  )

  const alignTextVertically = useCallback(
    (vertical: 'top' | 'center' | 'bottom') => {
      const canvas = fabricRef.current
      if (!canvas || !isCanvasReadyRef.current) return
      const block = getOverlayBlock(getActiveBlockId())
      if (!block) return

      const { background, text } = block
      background.setCoords()
      text.setCoords()
      const rect = getObjectBoundingRect(background)
      const textH = text.getScaledHeight()

      let ty = rect.top + rect.height / 2
      if (vertical === 'top') ty = rect.top + textH / 2
      if (vertical === 'bottom') ty = rect.top + rect.height - textH / 2

      text.set({ top: ty, originY: 'center' })
      clampTextToBackground(background, text)
      attachTextToBackground(background, text)
      ensureFrameImage()
      canvas.requestRenderAll()
    },
    [
      fabricRef,
      isCanvasReadyRef,
      getOverlayBlock,
      getActiveBlockId,
      clampTextToBackground,
      attachTextToBackground,
      ensureFrameImage
    ]
  )

  const handleCenterText = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    const block = getOverlayBlock(getActiveBlockId())
    if (!block) return
    block.text.set({
      left: block.background.left,
      top: block.background.top,
      originX: 'center',
      originY: 'center'
    })
    attachTextToBackground(block.background, block.text)
    canvas.requestRenderAll()
  }, [fabricRef, isCanvasReadyRef, getOverlayBlock, getActiveBlockId, attachTextToBackground])

  const handleCenterBackground = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      const canvas = fabricRef.current
      if (!canvas || !isCanvasReadyRef.current) return
      const block = getOverlayBlock(getActiveBlockId())
      if (!block) return
      if (axis === 'horizontal') block.background.set({ left: CANVAS_WIDTH / 2, originX: 'center' })
      else block.background.set({ top: CANVAS_HEIGHT / 2, originY: 'center' })

      block.background.setCoords()
      syncTextWithBackground(block.background, block.text)
      canvas.requestRenderAll()
    },
    [fabricRef, isCanvasReadyRef, getOverlayBlock, getActiveBlockId, syncTextWithBackground]
  )

  return {
    selectedBlockId,
    selectedRole,
    textValue,
    setTextValue,
    canvasElements,
    frameImageRef,

    // Actions
    addText,
    syncOverlayObjects,
    ensureFrameImage,
    applyOverlaySettings,

    // Alignment
    alignTextInsideBackground,
    alignTextVertically,
    handleCenterText,
    handleCenterBackground,

    // Exposed Refs/Helpers if needed
    getOverlayBlock
  }
}
