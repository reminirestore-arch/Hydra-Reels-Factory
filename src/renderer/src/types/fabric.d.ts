import type { CanvasElementRole } from '../features/editor/utils/fabricHelpers'

type FabricLinkData = {
  offsetX: number
  offsetY: number
  rotationOffset: number
}

type FabricObjectData = {
  role?: CanvasElementRole
  blockId?: number
  link?: FabricLinkData
}

declare module 'fabric' {
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
