import { OverlaySettings } from '@shared/types'
import { buildDefaultOverlaySettings } from '@shared/defaults'
import { OverlayBlock, mergeOverlaySettings } from '@features/editor/utils/fabricHelpers'

type MutableRef<T> = { current: T }

export const overlaySettingsEqual = (a: OverlaySettings, b: OverlaySettings): boolean => {
  return (
    a.timing.startTime === b.timing.startTime &&
    a.timing.duration === b.timing.duration &&
    (a.timing.fadeOutDuration ?? 0) === (b.timing.fadeOutDuration ?? 0) &&
    a.text.align === b.text.align &&
    a.text.verticalAlign === b.text.verticalAlign &&
    a.text.contentAlign === b.text.contentAlign &&
    a.text.color === b.text.color &&
    a.text.fontSize === b.text.fontSize &&
    a.text.fontWeight === b.text.fontWeight &&
    a.background.color === b.background.color &&
    a.background.opacity === b.background.opacity &&
    a.background.width === b.background.width &&
    a.background.height === b.background.height &&
    a.background.radius === b.background.radius
  )
}

const alignFromData = (
  data: OverlayBlock['text']['data'],
  fallback: OverlaySettings['text']['align']
): OverlaySettings['text']['align'] => {
  const h = (data as { horizontalAlignRelativeToBg?: string })?.horizontalAlignRelativeToBg
  if (h === 'left' || h === 'center' || h === 'right') return h
  return fallback
}

const verticalAlignFromData = (
  data: OverlayBlock['text']['data'],
  fallback: OverlaySettings['text']['verticalAlign']
): OverlaySettings['text']['verticalAlign'] => {
  const v = (data as { verticalAlignRelativeToBg?: string })?.verticalAlignRelativeToBg
  if (v === 'top' || v === 'center' || v === 'bottom') return v
  return fallback
}

const contentAlignFromText = (
  textAlign: unknown,
  fallback: OverlaySettings['text']['contentAlign']
): OverlaySettings['text']['contentAlign'] => {
  if (textAlign === 'left' || textAlign === 'center' || textAlign === 'right') return textAlign
  return fallback
}

export const deriveOverlaySettingsFromBlock = (
  block: OverlayBlock,
  overlaySettingsRef: MutableRef<OverlaySettings>
): OverlaySettings => {
  const defaults = buildDefaultOverlaySettings()
  const { background, text } = block

  return mergeOverlaySettings({
    timing: {
      ...overlaySettingsRef.current.timing
    },
    text: {
      ...overlaySettingsRef.current.text,
      fontSize: text.fontSize ?? defaults.text.fontSize,
      color: (text.fill as string) ?? defaults.text.color,
      align: alignFromData(text.data, defaults.text.align),
      verticalAlign: verticalAlignFromData(text.data, defaults.text.verticalAlign),
      contentAlign: contentAlignFromText(text.textAlign, defaults.text.contentAlign),
      fontWeight: text.fontWeight ?? defaults.text.fontWeight
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
