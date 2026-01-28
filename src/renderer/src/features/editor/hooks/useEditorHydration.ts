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
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'
import type { OverlaySavePayload } from '@features/editor/types'
import { apiClient } from '@api/apiClient'

// Локальный тип для ref
type MutableRef<T> = { current: T }

const getFabricImageSource = (image?: fabric.FabricImage | null): string | undefined =>
  image?.getSrc?.() ?? (image as unknown as { src?: string } | null)?.src

interface UseEditorHydrationProps {
  fabricRef: MutableRef<fabric.Canvas | null>
  isCanvasReadyRef: MutableRef<boolean>
  canvasInstance: fabric.Canvas | null
  filePath: string
  strategyId: StrategyType
  initialState?: object
  syncOverlayObjects: () => void
  ensureFrameImage: (imageUrl?: string) => void
  frameImageRef: MutableRef<fabric.FabricImage | null>
  setIsHydrating: (value: boolean) => void
  overlaySettings: OverlaySettings
  profileSettings: StrategyProfileSettings
  onSave: (payload: OverlaySavePayload) => void
}

export const useEditorHydration = ({
  fabricRef,
  isCanvasReadyRef,
  canvasInstance,
  filePath,
  strategyId,
  initialState,
  syncOverlayObjects,
  ensureFrameImage,
  frameImageRef,
  setIsHydrating,
  overlaySettings,
  profileSettings,
  onSave
}: UseEditorHydrationProps): { handleSave: () => void } => {
  const didHydrateRef = useRef(false)
  const lastHydrationRef = useRef<{ filePath: string; initialState: object | null }>({
    filePath,
    initialState: initialState ?? null
  })
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to load frame with strategy
  const loadFrameWithStrategy = async (
    path: string,
    strategy: StrategyType,
    canvas: fabric.Canvas,
    isActiveRef: { current: boolean },
    currentProfileSettings?: StrategyProfileSettings
  ): Promise<void> => {
    try {
      console.log('[Frontend] Requesting frame for:', path, 'with strategy:', strategy, 'profileSettings:', currentProfileSettings)
      let imageUrl = await apiClient.extractFrame(path, strategy, undefined, currentProfileSettings)
      if (!isActiveRef.current) return

      if (!imageUrl || typeof imageUrl !== 'string') {
        console.warn('[Frontend] Invalid image URL from extractFrame', imageUrl)
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
      if (!isActiveRef.current) return

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

  // Load Frame on mount or when filePath/strategyId changes
  useEffect(() => {
    if (!canvasInstance || !filePath) return
    const canvas = canvasInstance
    const isActiveRef = { current: true }

    void loadFrameWithStrategy(filePath, strategyId, canvas, isActiveRef, profileSettings)

    return () => {
      isActiveRef.current = false
    }
  }, [filePath, strategyId, canvasInstance, ensureFrameImage, frameImageRef, profileSettings])

  // Update frame when profile settings change (with debounce)
  useEffect(() => {
    if (!canvasInstance || !filePath || !isCanvasReadyRef.current) return

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce frame update to avoid too many requests
    debounceTimerRef.current = setTimeout(() => {
      const canvas = canvasInstance
      const isActiveRef = { current: true }

      const updateFrame = async (): Promise<void> => {
        try {
          console.log('[Frontend] Updating frame with new profile settings:', profileSettings)
          await loadFrameWithStrategy(filePath, strategyId, canvas, isActiveRef, profileSettings)
        } catch (err) {
          if (isActiveRef.current) {
            console.error('[Frontend] Error updating frame:', err)
          }
        }
      }

      void updateFrame()
    }, 300) // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [profileSettings, filePath, strategyId, canvasInstance, isCanvasReadyRef, ensureFrameImage, frameImageRef])

  // Hydrate JSON
  useEffect(() => {
    if (!canvasInstance) return
    const canvas = canvasInstance
    let isActive = true

    const finalizeHydration = (): void => {
      if (!isActive || !isCanvasReadyRef.current) return
      try {
        console.log('[Frontend] Finalizing hydration...')
        // ВАЖНО: Восстанавливаем ширину текста ДО вызова syncOverlayObjects
        // чтобы переносы строк пересчитались с правильной шириной
        // Используем проверку по типу объекта, так как role может еще не быть установлен
        const objects = canvas.getObjects()
        objects.forEach((obj) => {
          // Проверяем по типу объекта, так как role может еще не быть установлен
          if (obj instanceof fabric.Textbox || obj instanceof fabric.IText || obj instanceof fabric.FabricText) {
            const textData = obj.data as { savedWidth?: number; savedHeight?: number; role?: string }
            if (textData?.savedWidth != null && textData.savedWidth > 0) {
              const currentWidth = obj.width ?? 0
              const textLinesBefore = obj instanceof fabric.Textbox ? obj.textLines?.length ?? 0 : 0
              if (Math.abs(currentWidth - textData.savedWidth) > 0.1) {
                console.log('[Hydration] Restoring width BEFORE syncOverlayObjects:', {
                  current: currentWidth,
                  saved: textData.savedWidth,
                  text: obj instanceof fabric.Textbox ? obj.text?.substring(0, 20) : 'N/A',
                  textLinesBefore
                })
                if (obj instanceof fabric.Textbox) {
                  obj.set({ width: textData.savedWidth })
                  obj.initDimensions()
                  obj.setCoords()
                  const textLinesAfter = obj.textLines?.length ?? 0
                  console.log('[Hydration] After restore width:', {
                    width: obj.width,
                    textLinesAfter
                  })
                } else {
                  obj.set({ width: textData.savedWidth })
                  obj.setCoords()
                }
              } else {
                // Ширина совпадает, но проверяем переносы строк
                if (obj instanceof fabric.Textbox) {
                  const textLines = obj.textLines?.length ?? 0
                  if (textLines > 1) {
                    console.log('[Hydration] Width is correct but text has multiple lines, forcing recalc:', {
                      width: obj.width,
                      textLines,
                      text: obj.text?.substring(0, 20)
                    })
                    // Принудительно пересчитываем переносы строк
                    obj.initDimensions()
                    obj.setCoords()
                    const textLinesAfter = obj.textLines?.length ?? 0
                    console.log('[Hydration] After force recalc:', {
                      width: obj.width,
                      textLinesAfter
                    })
                  }
                }
              }
            }
          }
        })
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
      // Устанавливаем флаг гидратации, чтобы предотвратить применение настроек во время восстановления
      setIsHydrating(true)
      let hydratedState: object = initialState
      try {
        hydratedState = cloneCanvasState(initialState)
      } catch (error) {
        console.warn('Clone error:', error)
      }

      // ВАЖНО: Обрабатываем JSON ДО передачи в loadFromJSON
      // Fabric.js reviver может не вызываться для объектов в массиве objects
      // Поэтому мы вручную проходим по массиву objects и исправляем width
      console.log('[Hydration] Processing JSON before loadFromJSON, state type:', typeof hydratedState, 'is object:', typeof hydratedState === 'object')
      
      if (typeof hydratedState === 'object' && hydratedState !== null) {
        const state = hydratedState as Record<string, unknown>
        const objects = state.objects
        console.log('[Hydration] Objects array found:', Array.isArray(objects), 'length:', Array.isArray(objects) ? objects.length : 'N/A')
        
        if (Array.isArray(objects)) {
          let textboxCount = 0
          objects.forEach((obj, index) => {
            if (typeof obj === 'object' && obj !== null) {
              const objRecord = obj as Record<string, unknown>
              const objType = objRecord.type
              const hasData = objRecord.data && typeof objRecord.data === 'object'
              
              // Логируем ВСЕ объекты для отладки
              console.log(`[Hydration] Object at index ${index}:`, {
                type: objType,
                hasData,
                dataKeys: hasData && objRecord.data && typeof objRecord.data === 'object' ? Object.keys(objRecord.data) : [],
                currentWidth: objRecord.width,
                text: typeof objRecord.text === 'string' ? objRecord.text.substring(0, 20) : 'N/A',
                savedWidth: hasData && objRecord.data && typeof objRecord.data === 'object' ? (objRecord.data as { savedWidth?: number }).savedWidth : undefined
              })
              
              // Проверяем тип textbox (может быть 'textbox' или 'Textbox')
              const isTextbox = objType === 'textbox' || objType === 'Textbox'
              if (isTextbox) {
                textboxCount++
                const hasSavedWidth = hasData && objRecord.data && typeof objRecord.data === 'object' && 'savedWidth' in objRecord.data
                const currentWidth = typeof objRecord.width === 'number' ? objRecord.width : 0
                
                // ВАЖНО: Используем savedWidth из data, если он есть, иначе используем текущую ширину из JSON
                // Это нужно, так как ширина в JSON уже правильная, но Fabric.js может пересчитать переносы строк неправильно
                const targetWidth = hasSavedWidth && objRecord.data && typeof objRecord.data === 'object' 
                  ? (objRecord.data as { savedWidth?: number }).savedWidth ?? currentWidth
                  : currentWidth
                
                if (targetWidth > 0 && Math.abs(currentWidth - targetWidth) > 0.01) {
                  // Ширина отличается - устанавливаем правильную ширину
                  const oldWidth = objRecord.width
                  objRecord.width = targetWidth
                  console.log('[Hydration] Restoring text width in JSON BEFORE loadFromJSON:', {
                    index,
                    oldWidth,
                    newWidth: targetWidth,
                    source: hasSavedWidth ? 'savedWidth from data' : 'current width from JSON',
                    text: typeof objRecord.text === 'string' ? objRecord.text.substring(0, 20) : 'N/A'
                  })
                } else if (currentWidth > 0) {
                  // Ширина уже правильная, но нужно убедиться, что она установлена явно
                  // Это помогает Fabric.js правильно пересчитать переносы строк
                  objRecord.width = currentWidth
                  console.log('[Hydration] Ensuring text width in JSON BEFORE loadFromJSON:', {
                    index,
                    width: currentWidth,
                    text: typeof objRecord.text === 'string' ? objRecord.text.substring(0, 20) : 'N/A'
                  })
                }
                
                // Также устанавливаем высоту, если есть savedHeight
                if (hasSavedWidth && objRecord.data && typeof objRecord.data === 'object') {
                  const data = objRecord.data as { savedHeight?: number }
                  if (data.savedHeight != null && data.savedHeight > 0) {
                    objRecord.height = data.savedHeight
                  }
                }
              }
            } else {
              console.log(`[Hydration] Object at index ${index} is not an object:`, typeof obj, obj)
            }
          })
          console.log('[Hydration] Total textboxes found:', textboxCount)
        } else {
          console.log('[Hydration] Objects is not an array:', typeof objects)
        }
      } else {
        console.log('[Hydration] State is not an object or is null')
      }

      console.log('[Hydration] Calling loadFromJSON...')
      canvas
        .loadFromJSON(hydratedState)
        .then(() => {
          console.log('[Hydration] loadFromJSON completed')
          if (fabricRef.current === canvas && isCanvasReadyRef.current) {
            console.log('[Hydration] Canvas is ready, processing objects...')
            // ВАЖНО: Восстанавливаем ширину и пересчитываем переносы строк СРАЗУ после loadFromJSON
            // Используем проверку по типу объекта, так как role может еще не быть установлен
            const objects = canvas.getObjects()
            console.log('[Hydration] Total objects on canvas:', objects.length)
            // ВАЖНО: Сохраняем ширину из JSON перед загрузкой, так как data может потеряться
            const savedWidthsFromJSON = new Map<number, number>()
            if (typeof hydratedState === 'object' && hydratedState !== null) {
              const state = hydratedState as { objects?: Array<Record<string, unknown>> }
              if (Array.isArray(state.objects)) {
                state.objects.forEach((obj, index) => {
                  if (typeof obj === 'object' && obj !== null && obj.type === 'textbox') {
                    const objRecord = obj as Record<string, unknown>
                    const hasData = objRecord.data && typeof objRecord.data === 'object'
                    const data = hasData ? (objRecord.data as { savedWidth?: number }) : null
                    const savedWidth = data?.savedWidth ?? objRecord.width as number
                    if (savedWidth && savedWidth > 0) {
                      savedWidthsFromJSON.set(index, savedWidth)
                      console.log(`[Hydration] Saved width from JSON for textbox ${index}:`, savedWidth)
                    }
                  }
                })
              }
            }
            
            objects.forEach((obj, index) => {
              // Проверяем по типу объекта, так как role может еще не быть установлен
              if (obj instanceof fabric.Textbox || obj instanceof fabric.IText || obj instanceof fabric.FabricText) {
                const textData = obj.data as { savedWidth?: number; savedHeight?: number; role?: string }
                const currentWidth = obj.width ?? 0
                const textLinesBefore = obj instanceof fabric.Textbox ? obj.textLines?.length ?? 0 : 0
                
                // Получаем сохраненную ширину из JSON или из data
                const savedWidth = textData?.savedWidth ?? savedWidthsFromJSON.get(index) ?? currentWidth
                
                console.log(`[Hydration] Object ${index} (Textbox) on canvas:`, {
                  type: obj.type,
                  hasData: !!obj.data,
                  hasSavedWidth: textData?.savedWidth != null,
                  savedWidthFromData: textData?.savedWidth,
                  savedWidthFromJSON: savedWidthsFromJSON.get(index),
                  finalSavedWidth: savedWidth,
                  currentWidth,
                  textLines: textLinesBefore,
                  text: obj instanceof fabric.Textbox ? obj.text?.substring(0, 20) : 'N/A'
                })
                
                // ВАЖНО: Если текст переносится на несколько строк, принудительно пересчитываем переносы строк
                // Это нужно, так как переносы могли быть пересчитаны с неправильной шириной при загрузке
                if (obj instanceof fabric.Textbox && textLinesBefore > 1) {
                  console.log('[Hydration] Text wrapped, forcing recalc with saved width:', {
                    currentWidth,
                    savedWidth,
                    textLines: textLinesBefore,
                    text: obj.text?.substring(0, 20)
                  })
                  
                  // ВАЖНО: Используем подход с установкой ширины через set и принудительным пересчетом
                  // Сначала устанавливаем очень большую ширину, чтобы текст был в одну строку
                  const LARGE_WIDTH = 3000
                  obj.set({ width: LARGE_WIDTH })
                  obj.initDimensions()
                  
                  // Теперь устанавливаем правильную ширину
                  obj.set({ width: savedWidth })
                  obj.initDimensions()
                  obj.setCoords()
                  
                  // ВАЖНО: Принудительно перерисовываем canvas, чтобы обновить отображение текста
                  const canvas = obj.canvas
                  if (canvas) {
                    canvas.renderAll()
                  }
                  
                  const textLinesAfter = obj.textLines?.length ?? 0
                  console.log('[Hydration] After force recalc:', {
                    width: obj.width,
                    textLines: textLinesAfter
                  })
                } else if (savedWidth > 0 && Math.abs(currentWidth - savedWidth) > 0.1) {
                  // Ширина не совпадает - восстанавливаем
                  console.log('[Hydration] Width mismatch, restoring:', {
                    current: currentWidth,
                    saved: savedWidth,
                    textLinesBefore
                  })
                  if (obj instanceof fabric.Textbox) {
                    obj.set({ width: savedWidth })
                    obj.initDimensions()
                    obj.setCoords()
                    const textLinesAfter = obj.textLines?.length ?? 0
                    console.log('[Hydration] After restore:', {
                      width: obj.width,
                      textLines: textLinesAfter
                    })
                  } else {
                    obj.set({ width: savedWidth })
                    obj.setCoords()
                  }
                }
                
                if (textData?.savedHeight != null && textData.savedHeight > 0) {
                  const currentHeight = obj.height ?? 0
                  if (Math.abs(currentHeight - textData.savedHeight) > 0.1) {
                    obj.set({ height: textData.savedHeight })
                    obj.setCoords()
                  }
                }
              }
            })
            finalizeHydration()
            // Сбрасываем флаг гидратации после завершения восстановления
            setTimeout(() => {
              setIsHydrating(false)
            }, 100)
          }
        })
        .catch((err) => {
          if (!isCanvasReadyRef.current) return
          console.error('Ошибка восстановления канвы:', err)
          finalizeHydration()
          // Сбрасываем флаг гидратации даже при ошибке
          setTimeout(() => {
            setIsHydrating(false)
          }, 100)
        })

      return () => {
        isActive = false
        setIsHydrating(false)
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

      // Сохраняем размеры текста в data перед сохранением
      // ВАЖНО: Сохраняем базовую ширину (width), которая используется для переносов строк
      // Fabric.js сохраняет width в JSON как базовую ширину (без scale)
      // Поэтому мы тоже сохраняем базовую ширину, а не ширину с учетом scale
      const objects = canvas.getObjects()
      objects.forEach((obj) => {
        if (
          obj.data?.role === 'overlay-text' &&
          (obj instanceof fabric.Textbox || obj instanceof fabric.IText || obj instanceof fabric.FabricText)
        ) {
          // Сохраняем базовую ширину (width) - это то, что используется для переносов строк
          // НЕ умножаем на scale, так как в JSON уже сохраняется базовая ширина
          const currentWidth = obj.width ?? 0
          const currentHeight = obj.height ?? 0
          
          // Логируем для отладки
          if (obj instanceof fabric.Textbox) {
            const textLines = obj.textLines?.length ?? 0
            console.log('[Save] Saving text dimensions:', {
              text: obj.text?.substring(0, 20),
              width: currentWidth,
              height: currentHeight,
              textLines,
              scaleX: obj.scaleX,
              scaleY: obj.scaleY
            })
          }
          
          obj.set({
            data: {
              ...(obj.data ?? {}),
              savedWidth: currentWidth,
              savedHeight: currentHeight
            }
          })
        }
      })

      const exportScale = 1080 / CANVAS_WIDTH
      const overlayDataUrl = canvas.toDataURL({ format: 'png', multiplier: exportScale })

      // ВАЖНО: После сохранения размеров в data, нужно убедиться, что width в JSON правильная
      // Проверяем и исправляем width в объектах перед сохранением в JSON
      objects.forEach((obj) => {
        if (
          obj.data?.role === 'overlay-text' &&
          (obj instanceof fabric.Textbox || obj instanceof fabric.IText || obj instanceof fabric.FabricText)
        ) {
          const textData = obj.data as { savedWidth?: number }
          // Если сохраненная ширина отличается от текущей, исправляем
          if (textData?.savedWidth != null && textData.savedWidth > 0) {
            const currentWidth = obj.width ?? 0
            if (Math.abs(currentWidth - textData.savedWidth) > 0.1) {
              console.log('[Save] Fixing width before JSON save:', {
                current: currentWidth,
                saved: textData.savedWidth,
                text: obj instanceof fabric.Textbox ? obj.text?.substring(0, 20) : 'N/A'
              })
              // Устанавливаем правильную ширину перед сохранением в JSON
              obj.set({ width: textData.savedWidth })
              if (obj instanceof fabric.Textbox) {
                obj.initDimensions()
              }
            }
          }
        }
      })

      // Исключаем лишнее из JSON
      const canvasState = cloneCanvasState(canvasToJSON(canvas, ['data', 'id', 'role']))
      
      // ВАЖНО: Проверяем, что savedWidth действительно сохранился в JSON
      const stateCheck = canvasState as { objects?: Array<Record<string, unknown>> }
      if (Array.isArray(stateCheck.objects)) {
        stateCheck.objects.forEach((obj, index) => {
          if (obj.type === 'textbox' && obj.data && typeof obj.data === 'object') {
            const data = obj.data as { savedWidth?: number; role?: string }
            console.log(`[Save] Checking object ${index} in JSON:`, {
              type: obj.type,
              hasSavedWidth: 'savedWidth' in data,
              savedWidth: data.savedWidth,
              role: data.role,
              width: obj.width
            })
          }
        })
      }

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
