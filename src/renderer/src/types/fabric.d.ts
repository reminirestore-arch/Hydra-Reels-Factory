import type { CanvasElementRole } from '@features/editor/utils/fabricHelpers'

type FabricLinkData = {
  offsetX: number
  offsetY: number
  rotationOffset: number
}

type FabricObjectData = {
  role?: CanvasElementRole
  blockId?: number
  link?: FabricLinkData
  savedWidth?: number
  savedHeight?: number
}

declare module 'fabric' {
  // Для типизации свойства data на экземплярах объектов
  interface FabricObject {
    data?: FabricObjectData
  }

  // Для типизации data в сериализованных объектах (JSON)
  interface SerializedObjectProps {
    data?: FabricObjectData
  }

  // Для обратной совместимости
  interface Object {
    data?: FabricObjectData
  }

  interface Canvas {
    wrapperEl?: HTMLDivElement
  }

  interface FabricImage {
    src?: string
    getSrc?: () => string
  }
}
