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

// Локальный тип для ref
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
    // Ждем готовности канвы и наличия пути к файлу
    if (!canvasInstance || !filePath) return
    const canvas = canvasInstance

    const loadFrame = async (): Promise<void> => {
      try {
        console.log('[useEditorHydration] Requesting frame for:', filePath)
        const raw = await window.api.extractFrame(filePath)

        let imageUrl =
          raw && typeof raw === 'object' && 'ok' in (raw as any)
            ? (raw as any).ok
              ? (raw as any).data
              : null
            : (raw as any)

        if (!imageUrl || typeof imageUrl !== 'string') {
          console.warn('[useEditorHydration] Invalid image URL from extractFrame', raw)
          return
        }

        // --- FIX: Добавляем протокол file:// для локальных путей Windows/Unix, если его нет
        if (
          !imageUrl.startsWith('http') &&
          !imageUrl.startsWith('data:') &&
          !imageUrl.startsWith('file://')
        ) {
          // Если это Windows путь (C:\...), добавляем / перед ним для file:///
          if (imageUrl.includes(':\\')) {
            imageUrl = 'file:///' + imageUrl.replace(/\\/g, '/')
          } else {
            imageUrl = 'file://' + imageUrl
          }
        }

        console.log(
          '[useEditorHydration] Loading image from URL:',
          imageUrl.substring(0, 60) + '...'
        )

        // Создаем изображение
        const img = await fabric.FabricImage.fromURL(imageUrl)

        if (!img) {
          console.error('[useEditorHydration] Failed to create FabricImage from URL')
          return
        }

        // Вычисляем масштаб (Cover logic)
        const scaleX = CANVAS_WIDTH / img.width!
        const scaleY = CANVAS_HEIGHT / img.height!
        const scale = Math.max(scaleX, scaleY)

        img.set({
          left: CANVAS_WIDTH / 2,
          top: CANVAS_HEIGHT / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          selectable: false, // Фон не должен выделяться
          evented: false, // Фон не должен перехватывать события
          objectCaching: false
        })

        // Сохраняем ссылку и ставим фон
        ;(frameImageRef as any).current = img
        canvas.backgroundImage = img

        // Форсируем рендер
        if (canvas.contextContainer) {
          canvas.requestRenderAll()
          console.log('[useEditorHydration] Frame rendered successfully')
        }
      } catch (err) {
        console.error('[useEditorHydration] Error loading frame:', err)
      }
    }

    void loadFrame()
  }, [filePath, canvasInstance, frameImageRef])

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
      // Убираем фон перед сохранением JSON, чтобы он не попал в структуру объектов (если он вдруг там есть)
      canvas.backgroundImage = undefined

      const exportScale = 1080 / CANVAS_WIDTH
      // toDataURL с multiplier автоматически отрендерит все, включая фон (если бы он был image),
      // но для превью нам нужен чистый снимок.
      // ВАЖНО: Если мы хотим превью с фоном, надо вернуть bg перед toDataURL?
      // Нет, обычно превью оверлея - это прозрачный PNG с текстом.
      // Если вам нужно превью С ВИДЕО КАДРОМ, то нужно вернуть bg.
      // В текущей логике мы сохраняем прозрачный PNG оверлея.

      const overlayDataUrl = canvas.toDataURL({ format: 'png', multiplier: exportScale })
      const canvasState = cloneCanvasState(canvasToJSON(canvas, ['data']))

      const textData = canvas
        .getObjects()
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
