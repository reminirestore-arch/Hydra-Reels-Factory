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
  mergeOverlaySettings,
  animateFadeOut,
  animateFadeIn,
  restoreFadeOut
} from '@features/editor/utils/fabricHelpers'
import { getBlockId, ensureOverlayIds, ensureRolesOnObjects } from './overlay/overlayCanvasIds'
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
import { deriveOverlaySettingsFromBlock, overlaySettingsEqual } from './overlay/overlaySettings'
import { defaultOverlayTiming } from '@shared/domain/overlayTiming'

// Локальный тип для ref
type MutableRef<T> = { current: T }

type AlignmentOverride = {
  link: { offsetX: number; offsetY: number; rotationOffset?: number }
  horizontalAlignRelativeToBg?: 'left' | 'center' | 'right'
  verticalAlignRelativeToBg?: 'top' | 'center' | 'bottom'
}

type BackgroundOverride = {
  angle?: number
  left?: number
  top?: number
}

const getFabricImageSource = (image?: fabric.FabricImage | null): string | undefined =>
  image?.getSrc?.()

interface UseOverlayLogicProps {
  fabricRef: MutableRef<fabric.Canvas | null>
  isCanvasReadyRef: MutableRef<boolean>
  canvasInstance: fabric.Canvas | null
  overlaySettings: OverlaySettings
  setOverlaySettings: (s: OverlaySettings) => void
  initialState?: object
  videoDuration?: number
}

export const useOverlayLogic = ({
  fabricRef,
  isCanvasReadyRef,
  canvasInstance,
  overlaySettings,
  setOverlaySettings,
  initialState,
  videoDuration
}: UseOverlayLogicProps): {
  selectedBlockId: number | null
  selectedRole: CanvasElementRole | null
  textValue: string
  setTextValue: (val: string) => void
  canvasElements: CanvasElementNode[]
  frameImageRef: MutableRef<fabric.FabricImage | null>
  addText: () => void
  duplicateOverlayBlock: () => void
  removeOverlayBlock: (blockId: number) => void
  syncOverlayObjects: () => void
  ensureFrameImage: (imageUrl?: string) => void
  applyOverlaySettings: () => void
  alignText: (options: {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'center' | 'bottom'
  }) => void
  handleCenterText: () => void
  handleCenterBackground: (direction: 'horizontal' | 'vertical') => void
  getOverlayBlock: (id?: number | null) => OverlayBlock | null
  animateFadeOutBlock: (blockId?: number | null) => void
  animateFadeInBlock: (blockId?: number | null) => void
  setIsHydrating: (value: boolean) => void
} => {
  const overlayMapRef = useRef<Map<number, OverlayBlock>>(new Map())
  const nextBlockIdRef = useRef(1)
  const syncingFromCanvasRef = useRef(false)
  const isHydratingRef = useRef(false)
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
        !current || current !== frame || (imageUrl && getFabricImageSource(current) !== imageUrl)

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
    [setOverlaySettings]
  )

  const getOverlaySettingsFromBlock = useCallback((block: OverlayBlock): OverlaySettings => {
    return deriveOverlaySettingsFromBlock(block, overlaySettingsRef)
  }, [])

  // --- Object Builders ---
  const buildTextObjectWithSettings = useCallback(
    (
      settings: OverlaySettings,
      textValueOverride?: string,
      textWidthOverride?: number,
      textHeightOverride?: number
    ): fabric.Textbox => {
      return buildTextObject(settings, textValueOverride, textWidthOverride, textHeightOverride)
    },
    []
  )

  const buildBackgroundObjectWithSettings = useCallback(
    (settings: OverlaySettings): fabric.Rect => {
      return buildBackgroundObject(settings)
    },
    []
  )

  // --- Core Logic ---
  const createOverlayBlock = useCallback(
    (
      blockId: number,
      textValueOverride?: string,
      textWidthOverride?: number,
      textHeightOverride?: number,
      alignmentOverride?: AlignmentOverride,
      backgroundOverride?: BackgroundOverride,
      settingsOverride?: OverlaySettings
    ): OverlayBlock => {
      // Используем переданные настройки или дефолтные, если не переданы
      const settings = settingsOverride ?? buildDefaultOverlaySettings()
      const background = buildBackgroundObjectWithSettings(settings)
      const text = buildTextObjectWithSettings(
        settings,
        textValueOverride,
        textWidthOverride,
        textHeightOverride
      )
      background.set({
        data: {
          role: 'overlay-background',
          blockId
        }
      })
      text.set({ data: { role: 'overlay-text', blockId } })
      configureTextControls(text)

      const canvas = fabricRef.current
      if (canvas && isCanvasReadyRef.current) {
        canvas.add(background)
        canvas.add(text)
        canvas.bringObjectToFront(text)
      }

      if (backgroundOverride) {
        const bgUpdates: { angle?: number; left?: number; top?: number } = {}
        if (typeof backgroundOverride.angle === 'number') bgUpdates.angle = backgroundOverride.angle
        if (typeof backgroundOverride.left === 'number') bgUpdates.left = backgroundOverride.left
        if (typeof backgroundOverride.top === 'number') bgUpdates.top = backgroundOverride.top
        if (Object.keys(bgUpdates).length > 0) {
          background.set(bgUpdates)
          background.setCoords()
        }
      }

      if (alignmentOverride?.link && typeof alignmentOverride.link.offsetX === 'number') {
        text.set({
          data: {
            ...(text.data ?? {}),
            link: alignmentOverride.link,
            ...(alignmentOverride.horizontalAlignRelativeToBg != null && {
              horizontalAlignRelativeToBg: alignmentOverride.horizontalAlignRelativeToBg
            }),
            ...(alignmentOverride.verticalAlignRelativeToBg != null && {
              verticalAlignRelativeToBg: alignmentOverride.verticalAlignRelativeToBg
            })
          }
        })
        syncTextWithBackground(background, text)
      }
      attachTextToBackground(background, text)
      clampTextToBackground(background, text)
      return { id: blockId, background, text }
    },
    [buildBackgroundObjectWithSettings, buildTextObjectWithSettings, fabricRef, isCanvasReadyRef]
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

    const completeBlocks = Array.from(blocks.entries()).filter(
      ([, b]) => b.background && b.text
    ) as Array<[number, OverlayBlock]>
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

    // Применяем настройки только если блок действительно выбран (не используем fallback)
    // Это предотвращает применение настроек к неправильному блоку при снятии выделения или удалении
    if (selectedBlockIdRef.current !== null) {
      const activeBlock = getOverlayBlock(selectedBlockIdRef.current)
      if (activeBlock) {
        setOverlaySettingsIfChanged(getOverlaySettingsFromBlock(activeBlock))
        setTextValueIfChanged(activeBlock.text.text ?? '')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!canvas || !isCanvasReadyRef.current || syncingFromCanvasRef.current || isHydratingRef.current) return

    // Применяем настройки только если блок действительно выбран (не используем fallback)
    // Это предотвращает применение настроек к неправильному блоку при снятии выделения
    if (selectedBlockIdRef.current === null) return

    const activeBlock = getOverlayBlock(selectedBlockIdRef.current)
    if (!activeBlock) return

    const d = buildDefaultOverlaySettings()
    const safe = mergeOverlaySettings(overlaySettingsRef.current)
    const { text, background } = activeBlock

    // Сохраняем текущие размеры текста перед применением настроек
    const currentTextWidth = text.width
    const currentTextHeight = text.height

    text.set({
      fontSize: safe.text.fontSize ?? d.text.fontSize,
      fill: safe.text.color ?? d.text.color,
      fontWeight: safe.text.fontWeight ?? d.text.fontWeight,
      textAlign: safe.text.contentAlign ?? d.text.contentAlign ?? 'center'
    })

    // Восстанавливаем размеры текста, если они были установлены
    // Это важно для сохранения правильных размеров после восстановления из JSON
    if (currentTextWidth != null && currentTextWidth > 0) {
      text.set({ width: currentTextWidth })
    }
    if (currentTextHeight != null && currentTextHeight > 0) {
      text.set({ height: currentTextHeight })
    }

    const bw = safe.background.width ?? d.background.width
    const bh = safe.background.height ?? d.background.height
    const radius = clampRadius(safe.background.radius ?? 0, bw, bh)

    const currentData = background.data ?? {}
    const currentBlockData = currentData as {
      role?: string
      blockId?: number
    }

    background.set({
      width: bw,
      height: bh,
      fill: safe.background.color ?? d.background.color,
      opacity: safe.background.opacity ?? d.background.opacity,
      rx: radius,
      ry: radius,
      data: {
        ...currentData,
        role: currentBlockData.role ?? 'overlay-background',
        blockId: currentBlockData.blockId
      }
    })

    // Ограничиваем ширину текста только если она превышает ширину фона
    // Но не перезаписываем, если размер был сохранен из JSON
    if (currentTextWidth == null || currentTextWidth <= 0) {
      if (text.width! > bw) text.set({ width: bw })
    } else if (currentTextWidth > bw) {
      text.set({ width: bw })
    }

    clampTextToBackground(background, text)
    attachTextToBackground(background, text)
    ensureFrameImage()
    if (canvas.contextContainer) canvas.requestRenderAll()
  }, [fabricRef, isCanvasReadyRef, getOverlayBlock, ensureFrameImage])

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

    if (!selectedBlockIdRef.current) {
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
      // Восстанавливаем сохраненные размеры текста из data, если они есть
      // Это важно для правильного восстановления размеров после загрузки из JSON
      const textData = block.text.data as {
        savedWidth?: number
        savedHeight?: number
        role?: string
        blockId?: number
        link?: unknown
        horizontalAlignRelativeToBg?: string
        verticalAlignRelativeToBg?: string
      }
      if (textData?.savedWidth != null && textData.savedWidth > 0) {
        // Для Textbox важно установить ширину и пересчитать переносы строк
        if (block.text instanceof fabric.Textbox) {
          block.text.set({ width: textData.savedWidth })
          // Принудительно пересчитываем переносы строк с правильной шириной
          block.text.initDimensions()
        } else {
          block.text.set({ width: textData.savedWidth })
        }
      }
      if (textData?.savedHeight != null && textData.savedHeight > 0) {
        block.text.set({ height: textData.savedHeight })
      }

      const restored = restoreLinkFromText(block.background, block.text)
      if (!restored) attachTextToBackground(block.background, block.text)
      clampTextToBackground(block.background, block.text)
      block.background.set({ selectable: true, evented: true, hasControls: true })
      block.text.set({ selectable: true, evented: true })
      canvas.bringObjectToFront(block.text)
    }

    ensureFrameImage()
    if (canvas.contextContainer && isCanvasReadyRef.current) canvas.requestRenderAll()
    // rebuildOverlayMap уже был вызван выше, не нужно вызывать дважды
  }, [
    fabricRef,
    rebuildOverlayMap,
    getOverlaySettingsFromBlock,
    setOverlaySettingsIfChanged,
    setTextValueIfChanged,
    ensureFrameImage,
    isCanvasReadyRef,
    setSelectedBlockIdIfChanged
  ])

  // --- Public Actions ---
  const addText = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    const blockId = nextBlockIdRef.current++
    const baseSettings = buildDefaultOverlaySettings()
    const timing = defaultOverlayTiming(videoDuration)
    const defaultSettings: OverlaySettings = {
      ...baseSettings,
      timing: { ...baseSettings.timing, ...timing }
    }
    const block = createOverlayBlock(
      blockId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      defaultSettings
    )
    overlayMapRef.current.set(blockId, block)
    canvas.setActiveObject(block.text)
    setSelectedRoleIfChanged('overlay-text')
    setSelectedBlockIdIfChanged(blockId)
    setOverlaySettingsIfChanged(defaultSettings)
    ensureFrameImage()
    rebuildOverlayMap()
  }, [
    fabricRef,
    isCanvasReadyRef,
    videoDuration,
    createOverlayBlock,
    ensureFrameImage,
    rebuildOverlayMap,
    setSelectedRoleIfChanged,
    setSelectedBlockIdIfChanged,
    setOverlaySettingsIfChanged
  ])

  const duplicateOverlayBlock = useCallback((): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    const selectedId = selectedBlockIdRef.current
    if (selectedId == null) return
    const sourceBlock = getOverlayBlock(selectedId)
    if (!sourceBlock) return

    const blockId = nextBlockIdRef.current++
    const sourceText = sourceBlock.text.text ?? undefined
    // Получаем базовую ширину, учитывая scale если он не равен 1
    const baseWidth = sourceBlock.text.width ?? 0
    const scaleX = sourceBlock.text.scaleX ?? 1
    const sourceTextWidth = baseWidth > 0 ? baseWidth * scaleX : sourceBlock.text.getScaledWidth()
    // Получаем базовую высоту, учитывая scale если он не равен 1
    const baseHeight = sourceBlock.text.height ?? 0
    const scaleY = sourceBlock.text.scaleY ?? 1
    const sourceTextHeight =
      baseHeight > 0 ? baseHeight * scaleY : sourceBlock.text.getScaledHeight()

    let alignmentOverride: AlignmentOverride | undefined
    if (sourceBlock.text?.data) {
      const d = sourceBlock.text.data as {
        link?: { offsetX: number; offsetY: number; rotationOffset?: number }
        horizontalAlignRelativeToBg?: 'left' | 'center' | 'right'
        verticalAlignRelativeToBg?: 'top' | 'center' | 'bottom'
      }
      if (d.link && typeof d.link.offsetX === 'number') {
        alignmentOverride = {
          link: d.link,
          ...(d.horizontalAlignRelativeToBg != null && {
            horizontalAlignRelativeToBg: d.horizontalAlignRelativeToBg
          }),
          ...(d.verticalAlignRelativeToBg != null && {
            verticalAlignRelativeToBg: d.verticalAlignRelativeToBg
          })
        }
      }
    }

    const backgroundOverride: BackgroundOverride = {
      angle: sourceBlock.background.angle ?? 0,
      left:
        typeof sourceBlock.background.left === 'number' ? sourceBlock.background.left : undefined,
      top: typeof sourceBlock.background.top === 'number' ? sourceBlock.background.top : undefined
    }

    // При дублировании используем настройки из исходного блока
    const sourceSettings = getOverlaySettingsFromBlock(sourceBlock)
    const block = createOverlayBlock(
      blockId,
      sourceText,
      sourceTextWidth,
      sourceTextHeight,
      alignmentOverride,
      backgroundOverride,
      sourceSettings
    )
    overlayMapRef.current.set(blockId, block)
    canvas.setActiveObject(block.text)
    setSelectedRoleIfChanged('overlay-text')
    setSelectedBlockIdIfChanged(blockId)
    // Обновляем настройки UI на настройки дублированного блока
    setOverlaySettingsIfChanged(sourceSettings)
    setTextValueIfChanged(block.text.text ?? '')
    ensureFrameImage()
    rebuildOverlayMap()
  }, [
    fabricRef,
    isCanvasReadyRef,
    getOverlayBlock,
    getOverlaySettingsFromBlock,
    createOverlayBlock,
    ensureFrameImage,
    rebuildOverlayMap,
    setSelectedRoleIfChanged,
    setSelectedBlockIdIfChanged,
    setOverlaySettingsIfChanged,
    setTextValueIfChanged
  ])

  const removeOverlayBlock = useCallback(
    (blockId: number): void => {
      const canvas = fabricRef.current
      if (!canvas || !isCanvasReadyRef.current) return
      const block = getOverlayBlock(blockId)
      if (!block) return

      // Запоминаем, был ли удаляемый блок выбран
      const wasSelected = selectedBlockIdRef.current === blockId

      // Удаляем объекты с канвы
      canvas.remove(block.background)
      canvas.remove(block.text)

      // Удаляем из карты
      overlayMapRef.current.delete(blockId)

      // Если удаляемый блок был выбран, сбрасываем выбор ДО обновления карты
      // Это важно, чтобы rebuildOverlayMap не применял настройки к другому блоку
      if (wasSelected) {
        setSelectedRoleIfChanged(null)
        setSelectedBlockIdIfChanged(null)
        canvas.discardActiveObject()
      }

      // Обновляем карту и канву
      // rebuildOverlayMap проверит selectedBlockIdRef.current и не применит настройки,
      // если выбор был сброшен
      rebuildOverlayMap()
      canvas.requestRenderAll()
    },
    [
      fabricRef,
      isCanvasReadyRef,
      getOverlayBlock,
      rebuildOverlayMap,
      setSelectedRoleIfChanged,
      setSelectedBlockIdIfChanged
    ]
  )

  // --- Event Listeners ---
  useEffect(() => {
    if (!canvasInstance) return
    const canvas = canvasInstance
    syncOverlayObjects()

    const handleObjectMoving = (e: fabric.TEvent): void => {
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

    const handleTextChanged = (e: { target: OverlayText }): void => {
      const target = e.target
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (!block) return
      updateTextValueFromCanvas(block.text)
      // Обновляем сохраненные размеры в data при изменении текста
      const currentWidth = block.text.width
      const currentHeight = block.text.height
      if (currentWidth != null && currentHeight != null) {
        block.text.set({
          data: {
            ...(block.text.data ?? {}),
            savedWidth: currentWidth,
            savedHeight: currentHeight
          }
        })
      }
      clampTextToBackground(block.background, block.text)
      attachTextToBackground(block.background, block.text)
    }

    const handleObjectScaling = (e: fabric.TEvent): void => {
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

    const handleObjectRotating = (e: fabric.TEvent): void => {
      const target = getEventTarget<fabric.Object>(e)
      if (!target) return
      const block = getOverlayBlock(getBlockId(target))
      if (block && target.data?.role === 'overlay-background') {
        syncTextWithBackground(block.background, block.text)
      }
    }

    const handleObjectModified = (e: fabric.ModifiedEvent<fabric.TPointerEvent>): void => {
      const target = (e.target ?? (e as unknown as { target?: fabric.Object })?.target) as
        | fabric.Object
        | undefined
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
        // Обновляем сохраненные размеры в data после изменения размера шрифта
        const currentWidth = t.width
        const currentHeight = t.height
        if (currentWidth != null && currentHeight != null) {
          t.set({
            data: {
              ...(t.data ?? {}),
              savedWidth: currentWidth,
              savedHeight: currentHeight
            }
          })
        }
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

    const handleSelection = (): void => {
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

    const handleCleared = (): void => {
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
    syncOverlayObjects,
    getOverlayBlock,
    getActiveBlockId,
    updateTextValueFromCanvas,
    getOverlaySettingsFromBlock,
    setOverlaySettingsIfChanged,
    setSelectedRoleIfChanged,
    setSelectedBlockIdIfChanged,
    setTextValueIfChanged
  ])

  // --- Alignment Helpers ---
  const alignText = useCallback(
    (options: {
      horizontal?: 'left' | 'center' | 'right'
      vertical?: 'top' | 'center' | 'bottom'
    }) => {
      const canvas = fabricRef.current
      if (!canvas || !isCanvasReadyRef.current) return
      const block = getOverlayBlock(getActiveBlockId())
      if (!block) return

      // Если не указано ни одно из выравниваний, ничего не делаем
      if (options.horizontal == null && options.vertical == null) return

      const { background, text } = block
      background.setCoords()
      text.setCoords()
      const rect = getObjectBoundingRect(background)
      
      // Получаем текущие значения выравнивания из data или используем 'center' по умолчанию
      const currentData = text.data as {
        horizontalAlignRelativeToBg?: 'left' | 'center' | 'right'
        verticalAlignRelativeToBg?: 'top' | 'center' | 'bottom'
      } | undefined
      
      const horizontal = options.horizontal ?? currentData?.horizontalAlignRelativeToBg ?? 'center'
      const vertical = options.vertical ?? currentData?.verticalAlignRelativeToBg ?? 'center'

      const updates: Parameters<typeof text.set>[0] = {
        data: {
          ...(text.data ?? {}),
          ...(options.horizontal != null && { horizontalAlignRelativeToBg: horizontal }),
          ...(options.vertical != null && { verticalAlignRelativeToBg: vertical })
        }
      }

      // Вычисляем и применяем горизонтальное выравнивание только если оно указано
      if (options.horizontal != null) {
        const textW = text.getScaledWidth()
        const pad = 16
        let tx = rect.left + rect.width / 2 // center по умолчанию
        if (horizontal === 'left') {
          tx = rect.left + pad + textW / 2
        } else if (horizontal === 'right') {
          tx = rect.left + rect.width - pad - textW / 2
        }
        updates.left = tx
        updates.originX = 'center'
      }

      // Вычисляем и применяем вертикальное выравнивание только если оно указано
      if (options.vertical != null) {
        const textH = text.getScaledHeight()
        let ty = rect.top + rect.height / 2 // center по умолчанию
        if (vertical === 'top') {
          ty = rect.top + textH / 2
        } else if (vertical === 'bottom') {
          ty = rect.top + rect.height - textH / 2
        }
        updates.top = ty
        updates.originY = 'center'
      }

      text.set(updates)
      
      // Обновляем связи и ограничения
      updateLinkOffsets(background, text)
      clampTextToBackground(background, text)
      attachTextToBackground(background, text)
      ensureFrameImage()
      canvas.requestRenderAll()
    },
    [fabricRef, isCanvasReadyRef, getOverlayBlock, getActiveBlockId, ensureFrameImage]
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
  }, [fabricRef, isCanvasReadyRef, getOverlayBlock, getActiveBlockId])

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
    [fabricRef, isCanvasReadyRef, getOverlayBlock, getActiveBlockId]
  )

  const animateFadeOutBlock = useCallback(
    (blockId?: number | null): void => {
      const block = getOverlayBlock(blockId ?? selectedBlockIdRef.current)
      if (!block) return

      const fadeOutDuration = overlaySettingsRef.current.timing.fadeOutDuration ?? 500
      const originalBgOpacity = block.background.opacity ?? 1
      const originalTextOpacity = block.text.opacity ?? 1

      animateFadeOut(block, fadeOutDuration, () => {
        // После завершения анимации восстанавливаем прозрачность
        restoreFadeOut(block, originalBgOpacity, originalTextOpacity)
      })
    },
    [getOverlayBlock]
  )

  const animateFadeInBlock = useCallback(
    (blockId?: number | null): void => {
      const block = getOverlayBlock(blockId ?? selectedBlockIdRef.current)
      if (!block) return

      const fadeInDuration = overlaySettingsRef.current.timing.fadeInDuration ?? 500
      animateFadeIn(block, fadeInDuration)
    },
    [getOverlayBlock]
  )

  const setIsHydrating = useCallback((value: boolean): void => {
    isHydratingRef.current = value
  }, [])

  return {
    selectedBlockId,
    selectedRole,
    textValue,
    setTextValue,
    canvasElements,
    frameImageRef,

    // Actions
    addText,
    duplicateOverlayBlock,
    removeOverlayBlock,
    syncOverlayObjects,
    ensureFrameImage,
    applyOverlaySettings,

    // Alignment
    alignText,
    handleCenterText,
    handleCenterBackground,

    // Exposed Refs/Helpers if needed
    getOverlayBlock,
    animateFadeOutBlock,
    animateFadeInBlock,
    setIsHydrating
  }
}
