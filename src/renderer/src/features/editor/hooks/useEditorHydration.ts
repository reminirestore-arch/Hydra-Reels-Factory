import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'
import {
  cloneCanvasState,
  canvasToJSON,
  OverlayText,
  mergeOverlaySettings,
  CANVAS_WIDTH,
  CANVAS_HEIGHT
} from '../utils/fabricHelpers'
import { OverlaySettings, StrategyProfileSettings } from '@shared/types'

// Локальный тип для ref, чтобы избежать проблем с deprecation в типах React
type MutableRef<T> = { current: T }

interface UseEditorHydrationProps {
  fabricRef: MutableRef<fabric.Canvas | null>
  isCanvasReadyRef: MutableRef<boolean>
  canvasInstance: fabric.Canvas | null
  filePath: string
  initialState?: object
  syncOverlayObjects: () => void
  ensureFrameImage: () => void
  frameImageRef: MutableRef<fabric.FabricImage | null>
  overlaySettings: OverlaySettings
  profileSettings: StrategyProfileSettings
  onSave: (payload: any) => void
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
}: UseEditorHydrationProps) => {
  const didHydrateRef = useRef(false)
  const lastHydrationRef = useRef<{ filePath: string; initialState: object | null }>({
    filePath,
    initialState: initialState ?? null
  })

  // Load Frame
  useEffect(() => {
    if (!canvasInstance || !filePath) return
    const canvas = canvasInstance

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
        if (!isCanvasReadyRef.current) return

        const img = await fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
        const scale = Math.max(CANVAS_WIDTH / img.width!, CANVAS_HEIGHT / img.height!)

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
        if (canvas.contextContainer && isCanvasReadyRef.current) {
          canvas.requestRenderAll()
        }
      } catch (err) {
        console.error('Ошибка загрузки кадра:', err)
      }
    }
    void loadFrame()
  }, [filePath, canvasInstance, isCanvasReadyRef, frameImageRef])

  // Hydrate JSON
  useEffect(() => {
    if (!canvasInstance) return
    const canvas = canvasInstance
    let isActive = true

    const finalizeHydration = (): void => {
      if (!isActive || !isCanvasReadyRef.current) return
      try {
        syncOverlayObjects()
        ensureFrameImage()
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
      let hydratedState: any = initialState
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

  const handleSave = () => {
    const canvas = fabricRef.current
    if (!canvas || !isCanvasReadyRef.current) return
    const bg = canvas.backgroundImage

    try {
      canvas.backgroundImage = undefined
      const exportScale = 1080 / CANVAS_WIDTH
      const overlayDataUrl = canvas.toDataURL({ format: 'png', multiplier: exportScale })
      const canvasState = cloneCanvasState(canvasToJSON(canvas, ['data']))

      const textData = canvas
        .getObjects()
        // ИСПРАВЛЕНО: fabric.Text -> fabric.FabricText
        .filter(
          (obj) =>
            (obj as any) instanceof fabric.IText ||
            (obj as any) instanceof fabric.Textbox ||
            (obj as any) instanceof fabric.FabricText
        )
        .map((obj) => (obj as OverlayText).text ?? '')
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
        canvas.backgroundImage = bg
        if (canvas.contextContainer) canvas.requestRenderAll()
      }
    }
  }

  return { handleSave }
}
