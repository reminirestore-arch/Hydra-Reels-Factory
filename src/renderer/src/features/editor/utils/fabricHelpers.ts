import * as fabric from 'fabric'
import { OverlaySettings } from '@shared/types'
import { buildDefaultOverlaySettings } from '@shared/defaults'

export const CANVAS_WIDTH = 450
export const CANVAS_HEIGHT = 800

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

export const canvasToJSON = (canvas: fabric.Canvas, extraProps: string[] = []): object => {
  sanitizeCanvasObjects(canvas)
  const uniqueProps = new Set<string>([
    'data',
    'id',
    'role',
    'lockUniScaling',
    'selectable',
    'evented',
    ...extraProps
  ])
  const toJSON = canvas.toJSON as unknown as (props?: string[]) => object
  return toJSON.call(canvas, Array.from(uniqueProps))
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

export const mergeOverlaySettings = (incoming?: OverlaySettings): OverlaySettings => {
  const d = buildDefaultOverlaySettings()
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
