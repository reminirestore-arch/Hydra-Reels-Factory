import * as fabric from 'fabric'
import { OverlaySettings } from '@shared/types'
import { buildDefaultOverlaySettings } from '@shared/defaults'
import { getRendererConfig } from '@shared/config/renderer'

// ВАЖНО: Регистрируем data как кастомное свойство для автоматической сериализации
// Это правильный способ в Fabric.js v6/v7 согласно официальной документации
// https://fabricjs.com/docs/using-custom-properties
if (fabric.FabricObject && typeof fabric.FabricObject.customProperties !== 'undefined') {
  const existingProps = fabric.FabricObject.customProperties || []
  if (!existingProps.includes('data')) {
    fabric.FabricObject.customProperties = [...existingProps, 'data']
  }
}

const config = getRendererConfig()
export const CANVAS_WIDTH = config.canvas.width
export const CANVAS_HEIGHT = config.canvas.height

export type OverlayText = fabric.Textbox | fabric.IText | fabric.Text
export type CanvasElementRole = 'overlay-background' | 'overlay-text' | 'frame'

export interface OverlayBlock {
  id: number
  background: fabric.Rect
  text: OverlayText
}

export type OverlayBlockDraft = Partial<OverlayBlock> & { id: number }

export interface CanvasElementNode {
  id: string
  label: string
  role: CanvasElementRole
  blockId?: number
  children?: CanvasElementNode[]
}

export const clampRadius = (radius: number, width: number, height: number): number =>
  Math.max(0, Math.min(radius, Math.min(width, height) / 2))

export const sanitizeCanvasObjects = (canvas: fabric.Canvas): void => {
  const anyCanvas = canvas as fabric.Canvas & {
    _objects?: Array<fabric.Object | undefined | null>
  }
  if (!Array.isArray(anyCanvas._objects)) return
  const safeObjects = anyCanvas._objects.filter((obj): obj is fabric.Object => Boolean(obj))
  if (safeObjects.length !== anyCanvas._objects.length) {
    anyCanvas._objects = safeObjects
  }
}

export const canvasToJSON = (canvas: fabric.Canvas): object => {
  sanitizeCanvasObjects(canvas)
  // ВАЖНО: Благодаря FabricObject.customProperties = ['data'], свойство data
  // теперь автоматически включается в сериализацию при toJSON(undefined)
  // Это правильный способ согласно документации Fabric.js v6/v7:
  // https://fabricjs.com/docs/using-custom-properties
  const toJSON = canvas.toJSON as unknown as (props?: string[]) => object
  // Передаем undefined, чтобы сохранить все стандартные свойства + кастомные (data)
  return toJSON.call(canvas, undefined)
}

export const cloneCanvasState = (state: object): object => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(state)
    } catch (error) {
      console.warn('Не удалось structuredClone для canvasState, fallback на JSON.', error)
    }
  }
  return JSON.parse(JSON.stringify(state)) as object
}

export const getObjectBoundingRect = (
  obj: fabric.Object
): ReturnType<fabric.Object['getBoundingRect']> => {
  obj.setCoords()
  return obj.getBoundingRect()
}

export const getEventTarget = <T extends fabric.Object = fabric.Object>(
  event: fabric.TEvent
): T | null => {
  const target = (event as fabric.TEvent & { target?: fabric.Object })?.target
  if (!target) return null
  return target as T
}

/**
 * Анимирует плавное исчезновение OverlayBlock (текст + подложка)
 * @param block - блок для анимации
 * @param fadeOutDuration - длительность исчезновения в миллисекундах
 * @param onComplete - колбэк, вызываемый после завершения анимации
 */
export const animateFadeOut = (
  block: OverlayBlock,
  fadeOutDuration: number,
  onComplete?: () => void
): void => {
  if (!block.background || !block.text) return

  const canvas = block.background.canvas || block.text.canvas
  if (!canvas) return

  const startOpacityBg = block.background.opacity ?? 1
  const startOpacityText = block.text.opacity ?? 1

  // Анимируем оба объекта одновременно используя fabric.util.animate
  const animations: Promise<void>[] = []

  // Анимация фона
  animations.push(
    new Promise<void>((resolve) => {
      try {
        fabric.util.animate({
          startValue: startOpacityBg,
          endValue: 0,
          duration: fadeOutDuration,
          onChange: (value: number) => {
            block.background.set('opacity', value)
            // Обновляем канву во время анимации
            if (canvas) {
              canvas.requestRenderAll()
            }
          },
          onComplete: () => {
            resolve()
          }
        })
      } catch (error) {
        console.warn('Error animating background:', error)
        resolve()
      }
    })
  )

  // Анимация текста
  animations.push(
    new Promise<void>((resolve) => {
      try {
        fabric.util.animate({
          startValue: startOpacityText,
          endValue: 0,
          duration: fadeOutDuration,
          onChange: (value: number) => {
            block.text.set('opacity', value)
            // Обновляем канву во время анимации
            if (canvas) {
              canvas.requestRenderAll()
            }
          },
          onComplete: () => {
            resolve()
          }
        })
      } catch (error) {
        console.warn('Error animating text:', error)
        resolve()
      }
    })
  )

  // Вызываем колбэк после завершения всех анимаций
  Promise.all(animations).then(() => {
    if (onComplete) {
      onComplete()
    }
  })
}

/**
 * Анимирует плавное появление OverlayBlock (текст + подложка)
 * @param block - блок для анимации
 * @param fadeInDuration - длительность появления в миллисекундах
 * @param onComplete - колбэк, вызываемый после завершения анимации
 */
export const animateFadeIn = (
  block: OverlayBlock,
  fadeInDuration: number,
  onComplete?: () => void
): void => {
  if (!block.background || !block.text || fadeInDuration <= 0) {
    onComplete?.()
    return
  }

  const canvas = block.background.canvas || block.text.canvas
  if (!canvas) return

  const endOpacityBg = block.background.opacity ?? 1
  const endOpacityText = block.text.opacity ?? 1

  block.background.set({ opacity: 0 })
  block.text.set({ opacity: 0 })
  canvas.requestRenderAll()

  const animations: Promise<void>[] = []

  animations.push(
    new Promise<void>((resolve) => {
      try {
        fabric.util.animate({
          startValue: 0,
          endValue: endOpacityBg,
          duration: fadeInDuration,
          onChange: (value: number) => {
            block.background.set('opacity', value)
            if (canvas) canvas.requestRenderAll()
          },
          onComplete: () => resolve()
        })
      } catch (error) {
        console.warn('Error animating background fade in:', error)
        resolve()
      }
    })
  )

  animations.push(
    new Promise<void>((resolve) => {
      try {
        fabric.util.animate({
          startValue: 0,
          endValue: endOpacityText,
          duration: fadeInDuration,
          onChange: (value: number) => {
            block.text.set('opacity', value)
            if (canvas) canvas.requestRenderAll()
          },
          onComplete: () => resolve()
        })
      } catch (error) {
        console.warn('Error animating text fade in:', error)
        resolve()
      }
    })
  )

  Promise.all(animations).then(() => onComplete?.())
}

/**
 * Восстанавливает прозрачность OverlayBlock (текст + подложка) до исходных значений
 * @param block - блок для восстановления
 * @param backgroundOpacity - исходная прозрачность фона
 * @param textOpacity - исходная прозрачность текста
 */
export const restoreFadeOut = (
  block: OverlayBlock,
  backgroundOpacity: number,
  textOpacity: number
): void => {
  block.background.set({ opacity: backgroundOpacity })
  block.text.set({ opacity: textOpacity })
  const canvas = block.background.canvas
  if (canvas) {
    canvas.requestRenderAll()
  }
}

export const mergeOverlaySettings = (incoming?: OverlaySettings): OverlaySettings => {
  const d = buildDefaultOverlaySettings()
  return {
    timing: {
      ...d.timing,
      ...(incoming?.timing ?? {}),
      fadeOutDuration: incoming?.timing?.fadeOutDuration ?? d.timing.fadeOutDuration ?? 500,
      fadeInDuration: incoming?.timing?.fadeInDuration ?? d.timing.fadeInDuration ?? 500
    },
    text: {
      ...d.text,
      ...(incoming?.text ?? {}),
      align: (incoming?.text?.align ?? d.text.align ?? 'center') as 'left' | 'center' | 'right',
      verticalAlign: (incoming?.text?.verticalAlign ?? d.text.verticalAlign ?? 'center') as
        | 'top'
        | 'center'
        | 'bottom',
      contentAlign: (incoming?.text?.contentAlign ?? d.text.contentAlign ?? 'center') as
        | 'left'
        | 'center'
        | 'right',
      color: incoming?.text?.color ?? d.text.color,
      fontSize: incoming?.text?.fontSize ?? d.text.fontSize,
      fontWeight: incoming?.text?.fontWeight ?? d.text.fontWeight
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
