import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'
import {
  cloneCanvasState,
  canvasToJSON,
  OverlayText,
  mergeOverlaySettings,
  CANVAS_WIDTH,
  CANVAS_HEIGHT
} from '@features/editor/utils/fabricHelpers'
import { OverlaySettings, StrategyProfileSettings } from '@shared/types'
import type { OverlaySavePayload } from '@features/editor/types'

// Локальный тип для ref
type MutableRef<T> = { current: T }

type FrameResponse = { ok: boolean; data?: unknown }

const isFrameResponse = (value: unknown): value is FrameResponse =>
  typeof value === 'object' && value !== null && 'ok' in value

const extractImageUrl = (raw: unknown): string | null => {
  if (isFrameResponse(raw)) {
    if (!raw.ok) return null
    return typeof raw.data === 'string' ? raw.data : null
  }
  return typeof raw === 'string' ? raw : null
}

const getFabricImageSource = (image?: fabric.FabricImage | null): string | undefined =>
  image?.getSrc?.() ?? (image as unknown as { src?: string } | null)?.src

interface UseEditorHydrationProps {
  fabricRef: MutableRef<fabric.Canvas | null>
  isCanvasReadyRef: MutableRef<boolean>
  canvasInstance: fabric.Canvas | null
  filePath: string
  initialState?: object
  syncOverlayObjects: () => void
  ensureFrameImage: (imageUrl?: string) => void
  frameImageRef: MutableRef<fabric.FabricImage | null>
  overlaySettings: OverlaySettings
  profileSettings: StrategyProfileSettings
  onSave: (payload: OverlaySavePayload) => void
}

export const useEditorHydration = ({
  fabricRef,
  isCanvasReadyRef,
  canvasInstance,
  filePath,
  initialState,
  syncOverlayObjects,
  ensureFrameImage,
  frameImageRef,
  overlaySettings,
  profileSettings,
  onSave
}: UseEditorHydrationProps): { handleSave: () => void } => {
  const didHydrateRef = useRef(false)
  const lastHydrationRef = useRef<{ filePath: string; initialState: object | null }>({
    filePath,
    initialState: initialState ?? null
  })

  // Load Frame
  useEffect(() => {
    if (!canvasInstance || !filePath) return
    const canvas = canvasInstance
    let isActive = true

    const loadFrame = async (): Promise<void> => {
      try {
        console.log('[Frontend] Requesting frame for:', filePath)
        const raw = await window.api.extractFrame(filePath)
        if (!isActive) return

        let imageUrl = extractImageUrl(raw)

        if (!imageUrl || typeof imageUrl !== 'string') {
          console.warn('[Frontend] Invalid image URL from extractFrame', raw)
          return
        }

        if (
          !imageUrl.startsWith('data:') &&
          !imageUrl.startsWith('http') &&
          !imageUrl.startsWith('file://')
        ) {
          if (imageUrl.includes(':\\')) {
            imageUrl = 'file:///' + imageUrl.replace(/\\/g, '/')
          } else {
            imageUrl = 'file://' + imageUrl
          }
        }

        console.log('[Frontend] Frame data received. Length:', imageUrl.length)

        const existingFrame = frameImageRef.current
        const existingSrc = getFabricImageSource(existingFrame)

        if (existingFrame && existingSrc === imageUrl) {
          ensureFrameImage(imageUrl)
          canvas.requestRenderAll()
          return
        }

        const imgEl = await fabric.util.loadImage(imageUrl, { crossOrigin: 'anonymous' })
        if (!isActive) return

        if (!imgEl || !(imgEl instanceof HTMLImageElement)) {
          console.error('[Frontend] Failed to load HTMLImageElement for frame', imgEl)
          return
        }

        const img = new fabric.FabricImage(imgEl)
        if (!img.width || !img.height) {
          console.error('[Frontend] Failed to init FabricImage or dim is 0', img)
          return
        }

        console.log(`[Frontend] Image loaded: ${img.width}x${img.height}`)

        const scaleX = CANVAS_WIDTH / img.width
        const scaleY = CANVAS_HEIGHT / img.height
        const scale = Math.max(scaleX, scaleY)

        img.set({
          left: CANVAS_WIDTH / 2,
          top: CANVAS_HEIGHT / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          objectCaching: false,
          excludeFromExport: true
        })

        frameImageRef.current = img
        canvas.backgroundVpt = false
        canvas.backgroundImage = img
        ensureFrameImage(imageUrl)
        canvas.requestRenderAll()

        console.log('[Frontend] Background image set successfully')
      } catch (err) {
        console.error('[Frontend] Error loading frame:', err)
      }
    }

    void loadFrame()

    return () => {
      isActive = false
    }
  }, [filePath, canvasInstance, ensureFrameImage, frameImageRef])

  // Hydrate JSON
  useEffect(() => {
    if (!canvasInstance) return
    const canvas = canvasInstance
    let isActive = true

    const finalizeHydration = (): void => {
      if (!isActive || !isCanvasReadyRef.current) return
      try {
        console.log('[Frontend] Finalizing hydration...')
        syncOverlayObjects()
        // Обязательно восстанавливаем фон, если JSON его стер
        ensureFrameImage()
        canvas.requestRenderAll()
      } catch (e) {
        console.error('Error in syncOverlayObjects:', e)
      }
    }

    const last = lastHydrationRef.current
    const initRef = initialState ?? null
    if (last.filePath !== filePath || last.initialState !== initRef) {
      lastHydrationRef.current = { filePath, initialState: initRef }
      didHydrateRef.current = false
    }

    if (didHydrateRef.current)
      return () => {
        isActive = false
      }
    didHydrateRef.current = true

    if (initialState) {
      console.log('[Frontend] Hydrating JSON state...')
      let hydratedState: object = initialState
      try {
        hydratedState = cloneCanvasState(initialState)
      } catch (error) {
        console.warn('Clone error:', error)
      }

      canvas
        .loadFromJSON(hydratedState)
        .then(() => {
          if (fabricRef.current === canvas && isCanvasReadyRef.current) finalizeHydration()
        })
        .catch((err) => {
          if (!isCanvasReadyRef.current) return
          console.error('Ошибка восстановления канвы:', err)
          finalizeHydration()
        })

      return () => {
        isActive = false
      }
    }

    finalizeHydration()
    return () => {
      isActive = false
    }
  }, [
    filePath,
    initialState,
    canvasInstance,
    isCanvasReadyRef,
    syncOverlayObjects,
    ensureFrameImage,
    fabricRef
  ])

  const handleSave = (): void => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    const bg = canvas.backgroundImage

    try {
      // Убираем фон перед сохранением
      canvas.backgroundImage = undefined

      const exportScale = 1080 / CANVAS_WIDTH
      const overlayDataUrl = canvas.toDataURL({ format: 'png', multiplier: exportScale })

      // Исключаем лишнее из JSON
      const canvasState = cloneCanvasState(canvasToJSON(canvas, ['data', 'id', 'role']))

      const textData = canvas
        .getObjects()
        .filter(
          (obj): obj is OverlayText =>
            obj instanceof fabric.IText ||
            obj instanceof fabric.Textbox ||
            obj instanceof fabric.FabricText
        )
        .map((obj) => obj.text ?? '')
        .join(' ')
        .trim()

      onSave({
        canvasState,
        overlayDataUrl,
        textData,
        overlaySettings: mergeOverlaySettings(overlaySettings),
        profileSettings
      })
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      if (bg) {
        // Восстанавливаем фон
        canvas.backgroundImage = bg
        canvas.requestRenderAll()
      }
    }
  }

  return { handleSave }
}
