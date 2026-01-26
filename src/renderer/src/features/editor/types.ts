import type { OverlaySettings, StrategyProfileSettings } from '@shared/types'

export type OverlaySavePayload = {
  canvasState: object
  overlayDataUrl: string
  textData: string
  overlaySettings: OverlaySettings
  profileSettings: StrategyProfileSettings
}
