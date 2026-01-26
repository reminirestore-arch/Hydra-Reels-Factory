import { OverlaySettings } from '@shared/types'
import { buildDefaultOverlaySettings } from '@shared/defaults'
import { OverlayBlock, mergeOverlaySettings } from '../../utils/fabricHelpers'
import type { Textbox } from 'fabric'

type MutableRef<T> = { current: T }

const normalizeTextAlign = (
  align: Textbox['textAlign'],
  fallback: OverlaySettings['text']['align']
): OverlaySettings['text']['align'] => {
  if (align === 'left' || align === 'center' || align === 'right') return align
  return fallback
}

export const overlaySettingsEqual = (a: OverlaySettings, b: OverlaySettings): boolean => {
  return (
    a.timing.startTime === b.timing.startTime &&
    a.timing.duration === b.timing.duration &&
    a.text.align === b.text.align &&
    a.text.color === b.text.color &&
    a.text.fontSize === b.text.fontSize &&
    a.background.color === b.background.color &&
    a.background.opacity === b.background.opacity &&
    a.background.width === b.background.width &&
    a.background.height === b.background.height &&
    a.background.radius === b.background.radius
  )
}

export const deriveOverlaySettingsFromBlock = (
  block: OverlayBlock,
  overlaySettingsRef: MutableRef<OverlaySettings>
): OverlaySettings => {
  const defaults = buildDefaultOverlaySettings()
  const { background, text } = block
  return mergeOverlaySettings({
    timing: overlaySettingsRef.current.timing,
    text: {
      ...overlaySettingsRef.current.text,
      fontSize: text.fontSize ?? defaults.text.fontSize,
      color: (text.fill as string) ?? defaults.text.color,
      align: normalizeTextAlign(text.textAlign, defaults.text.align)
    },
    background: {
      ...overlaySettingsRef.current.background,
      width: background.width ?? defaults.background.width,
      height: background.height ?? defaults.background.height,
      radius: background.rx ?? defaults.background.radius,
      color: (background.fill as string) ?? defaults.background.color,
      opacity: background.opacity ?? defaults.background.opacity
    }
  })
}
