import { useEffect, useRef, MutableRefObject } from 'react'
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

interface UseEditorHydrationProps {
  fabricRef: MutableRefObject<fabric.Canvas | null>
  isCanvasReadyRef: MutableRefObject<boolean>
  filePath: string
  initialState?: object
  syncOverlayObjects: () => void
  ensureFrameImage: () => void
  frameImageRef: MutableRefObject<fabric.FabricImage | null>
  overlaySettings: OverlaySettings
  profileSettings: StrategyProfileSettings
  onSave: (payload: any) => void
}

export const useEditorHydration = ({
  fabricRef,
  isCanvasReadyRef,
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
    const canvas = fabricRef.current
    if (!canvas || !filePath) return

    const loadFrame = async (): Promise<void> => {
      if (!isCanvasReadyRef.current) return
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
  }, [filePath, fabricRef, isCanvasReadyRef, frameImageRef])

  // Hydrate JSON
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    let isActive = true

    const finalizeHydration = (): void => {
      if (!isActive || !isCanvasReadyRef.current) return
      try {
        syncOverlayObjects()
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
  }, [filePath, initialState, fabricRef, isCanvasReadyRef, syncOverlayObjects])

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
        .filter(
          (obj) =>
            obj instanceof fabric.IText ||
            obj instanceof fabric.Textbox ||
            obj instanceof fabric.Text
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
