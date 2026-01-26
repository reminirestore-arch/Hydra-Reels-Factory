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
  getEventTarget,
  mergeOverlaySettings
} from '../utils/fabricHelpers'
import {
  getBlockId,
  ensureOverlayIds,
  ensureRolesOnObjects
} from './overlay/overlayCanvasIds'
import {
  attachTextToBackground,
  clampTextToBackground,
  restoreLinkFromText,
  syncTextWithBackground,
  updateLinkOffsets
} from './overlay/overlayGeometry'
import {
  buildBackgroundObject,
  buildTextObject,
  configureTextControls
} from './overlay/overlayObjectFactories'
import {
  deriveOverlaySettingsFromBlock,
  overlaySettingsEqual
} from './overlay/overlaySettings'

// Локальный тип для ref
type MutableRef<T> = { current: T }

const getFabricImageSource = (image?: fabric.FabricImage | null): string | undefined =>
  image?.getSrc?.()

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
  const selectedRoleRef = useRef<CanvasElementRole | null>(selectedRole)
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
    selectedRoleRef.current = selectedRole
  }, [selectedRole])

  const setSelectedBlockIdIfChanged = useCallback((next: number | null) => {
    if (selectedBlockIdRef.current !== next) {
      setSelectedBlockId(next)
    }
  }, [])

  const setSelectedRoleIfChanged = useCallback((next: CanvasElementRole | null) => {
    if (selectedRoleRef.current !== next) {
      setSelectedRole(next)
    }
  }, [])
  useEffect(() => {
    textValueRef.current = textValue
  }, [textValue])

  const setTextValueIfChanged = useCallback((next: string) => {
    if (textValueRef.current !== next) {
      setTextValue(next)
    }
  }, [])

  // --- Helpers ---
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

  const updateTextValueFromCanvas = useCallback((text: OverlayText): void => {
    const next = text.text ?? ''
    if (textValueRef.current !== next) {
      setTextValue(next)
    }
  }, [])

  const ensureFrameImage = useCallback(
    (imageUrl?: string): void => {
      const canvas = fabricRef.current
      if (!canvas || !isCanvasReadyRef.current) return
      const frame = frameImageRef.current
      if (!frame) return

      const current = canvas.backgroundImage as fabric.FabricImage | undefined
      const shouldReplace =
        !current ||
        current !== frame ||
        (imageUrl && getFabricImageSource(current) !== imageUrl)

      if (shouldReplace) {
        console.log('[useOverlayLogic] Restoring background image frame')
        canvas.backgroundVpt = false
        canvas.backgroundImage = frame
        if (canvas.contextContainer) canvas.requestRenderAll()
      }
    },
    [fabricRef, isCanvasReadyRef]
  )

  const setOverlaySettingsIfChanged = useCallback(
    (next: OverlaySettings) => {
      const prev = overlaySettingsRef.current
      if (!overlaySettingsEqual(prev, next)) {
        setOverlaySettings(next)
      }
    },
    [overlaySettingsEqual, setOverlaySettings]
  )

  const getOverlaySettingsFromBlock = useCallback(
    (block: OverlayBlock): OverlaySettings => {
      return deriveOverlaySettingsFromBlock(block, overlaySettingsRef)
    },
    []
  )

  // --- Object Builders ---
  const buildTextObjectWithSettings = useCallback(
    (textValueOverride?: string): fabric.Textbox => {
      return buildTextObject(overlaySettingsRef.current, textValueOverride)
    },
    []
  )

  const buildBackgroundObjectWithSettings = useCallback((): fabric.Rect => {
    return buildBackgroundObject(overlaySettingsRef.current)
  }, [])

  // --- Core Logic ---
  const createOverlayBlock = useCallback(
    (blockId: number, textValueOverride?: string): OverlayBlock => {
      const background = buildBackgroundObjectWithSettings()
      const text = buildTextObjectWithSettings(textValueOverride)
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
      buildBackgroundObjectWithSettings,
      buildTextObjectWithSettings,
      attachTextToBackground,
      clampTextToBackground,
      fabricRef,
      isCanvasReadyRef
    ]
  )

  const rebuildOverlayMap = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    ensureRolesOnObjects(canvas)
    ensureOverlayIds(canvas, nextBlockIdRef)

    const blocks = new Map<number, OverlayBlockDraft>()
    const objects = canvas.getObjects()
    for (const obj of objects) {
      const role = obj.data?.role
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

    const completeBlocks = Array.from(blocks.entries()).filter(([, b]) => b.background && b.text) as Array<
      [number, OverlayBlock]
    >
    overlayMapRef.current = new Map(completeBlocks)

    const elements: CanvasElementNode[] = [{ id: 'frame', label: 'Кадр видео', role: 'frame' }]
    const sorted = Array.from(overlayMapRef.current.values()).sort((a, b) => a.id - b.id)

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
      setOverlaySettingsIfChanged(getOverlaySettingsFromBlock(activeBlock))
      setTextValueIfChanged(activeBlock.text.text ?? '')
    }
  }, [
    ensureRolesOnObjects,
    ensureOverlayIds,
    getBlockId,
    getOverlayBlock,
    getActiveBlockId,
    getOverlaySettingsFromBlock,
    setOverlaySettingsIfChanged,
    setTextValueIfChanged,
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
    ensureOverlayIds(canvas, nextBlockIdRef)

    const objects = canvas.getObjects()
    objects.forEach((obj) => {
      const role = obj.data?.role
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
        setSelectedBlockIdIfChanged(first.id)
        const settings = getOverlaySettingsFromBlock(first)
        setOverlaySettingsIfChanged(settings)
        setTextValueIfChanged(first.text.text ?? '')

        syncingFromCanvasRef.current = true
        setTimeout(() => {
          syncingFromCanvasRef.current = false
        }, 50)
      }
    }

    for (const block of Array.from(overlayMapRef.current.values())) {
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
    getOverlaySettingsFromBlock,
    setOverlaySettingsIfChanged,
    setTextValueIfChanged,
    restoreLinkFromText,
    attachTextToBackground,
    clampTextToBackground,
    ensureFrameImage,
    configureTextControls,
    isCanvasReadyRef,
    setSelectedBlockIdIfChanged
  ])

  // --- Public Actions ---
  const addText = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    const blockId = nextBlockIdRef.current++
    const block = createOverlayBlock(blockId)
    overlayMapRef.current.set(blockId, block)
    canvas.setActiveObject(block.text)
    setSelectedRoleIfChanged('overlay-text')
    setSelectedBlockIdIfChanged(blockId)
    ensureFrameImage()
    rebuildOverlayMap()
  }, [
    fabricRef,
    isCanvasReadyRef,
    createOverlayBlock,
    ensureFrameImage,
    rebuildOverlayMap,
    setSelectedRoleIfChanged,
    setSelectedBlockIdIfChanged
  ])

  // --- Event Listeners ---
  useEffect(() => {
    if (!canvasInstance) return
    const canvas = canvasInstance

    const handleObjectMoving = (e: fabric.TEvent) => {
      const target = getEventTarget<fabric.Object>(e)
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      const role = target.data?.role
      if (role === 'overlay-background') syncTextWithBackground(block.background, block.text)
      if (role === 'overlay-text') {
        clampTextToBackground(block.background, block.text)
        attachTextToBackground(block.background, block.text)
      }
      canvas.requestRenderAll()
    }

    const handleTextChanged = (e: any) => {
      const target = getEventTarget<OverlayText>(e)
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      updateTextValueFromCanvas(block.text)
      clampTextToBackground(block.background, block.text)
      attachTextToBackground(block.background, block.text)
    }

    const handleObjectScaling = (e: fabric.TEvent) => {
      const target = getEventTarget<fabric.Object>(e)
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      const role = target.data?.role
      if (role === 'overlay-background') syncTextWithBackground(block.background, block.text)
      if (role === 'overlay-text') {
        const t = block.text
        const s = (Math.abs(t.scaleX!) + Math.abs(t.scaleY!)) / 2
        t.set({ scaleX: s, scaleY: s })
        clampTextToBackground(block.background, block.text)
      }
    }

    const handleObjectRotating = (e: fabric.TEvent) => {
      const target = getEventTarget<fabric.Object>(e)
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (block && target.data?.role === 'overlay-background') {
        syncTextWithBackground(block.background, block.text)
      }
    }

    const handleObjectModified = (e: any) => {
      const target = getEventTarget<fabric.Object>(e)
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      const role = target.data?.role

      if (role === 'overlay-text') {
        const t = block.text
        const s = ((t.scaleX ?? 1) + (t.scaleY ?? 1)) / 2
        const curSize = t.fontSize ?? overlaySettingsRef.current.text.fontSize
        const nextSize = Math.max(1, Math.round(curSize * s))
        t.set({ fontSize: nextSize, scaleX: 1, scaleY: 1 })
        t.setCoords()
        if (getActiveBlockId() === block.id) {
          setOverlaySettingsIfChanged({
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
          setOverlaySettingsIfChanged({
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
      const role = active?.data?.role ?? null
      const blockId = getBlockId(active)
      setSelectedRoleIfChanged(role)
      setSelectedBlockIdIfChanged(blockId)
      if ((role === 'overlay-text' || role === 'overlay-background') && blockId) {
        const block = getOverlayBlock(blockId)
        if (block) {
          syncingFromCanvasRef.current = true
          setOverlaySettingsIfChanged(getOverlaySettingsFromBlock(block))
          setTextValueIfChanged(block.text.text ?? '')
          setTimeout(() => {
            syncingFromCanvasRef.current = false
          }, 0)
        }
      }
    }

    const handleCleared = () => {
      setSelectedRoleIfChanged(null)
      setSelectedBlockIdIfChanged(null)
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
    getOverlaySettingsFromBlock,
    setOverlaySettingsIfChanged,
    setSelectedRoleIfChanged,
    setSelectedBlockIdIfChanged,
    setTextValueIfChanged
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
