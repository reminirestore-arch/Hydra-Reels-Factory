import * as fabric from 'fabric'
import { OverlaySettings } from '@shared/types'
import { CANVAS_HEIGHT, CANVAS_WIDTH, clampRadius } from '@features/editor/utils/fabricHelpers'

/** Ширина по размеру текста (без переносов). */
const LARGE_WIDTH = 3000

function getTextFittedWidth(text: fabric.Textbox): number {
  const n = text.textLines?.length ?? 0
  if (n === 0) return 20
  let maxW = 0
  for (let i = 0; i < n; i++) {
    const w = text.getLineWidth(i)
    if (typeof w === 'number' && w > maxW) maxW = w
  }
  return maxW || 20
}

export const configureTextControls = (text: fabric.Textbox): void => {
  text.set({ lockUniScaling: true, objectCaching: false })
}

export const buildTextObject = (
  settings: OverlaySettings,
  textValueOverride?: string,
  textWidthOverride?: number,
  textHeightOverride?: number
): fabric.Textbox => {
  // Если есть override ширины, используем его сразу при создании для правильного пересчёта переносов
  const initialWidth =
    textWidthOverride != null && textWidthOverride > 0 ? textWidthOverride : LARGE_WIDTH

  const text = new fabric.Textbox(textValueOverride ?? 'Текст Рилса', {
    left: CANVAS_WIDTH / 2,
    top: CANVAS_HEIGHT / 2,
    fontFamily: 'Arial',
    fill: settings.text.color,
    fontSize: settings.text.fontSize,
    fontWeight: settings.text.fontWeight ?? 'bold',
    textAlign: (settings.text.contentAlign ?? 'center') as 'left' | 'center' | 'right',
    width: initialWidth,
    originX: 'center',
    originY: 'center',
    editable: true,
    selectable: true,
    splitByGrapheme: false,
    objectCaching: false
  })

  // Если не было override ширины, вычисляем подходящую ширину по содержимому
  if (textWidthOverride == null || textWidthOverride <= 0) {
    const fittedWidth = getTextFittedWidth(text)
    text.set({ width: fittedWidth })
  }

  // Высота в Textbox вычисляется автоматически на основе переносов строк
  // Если указана явная высота, устанавливаем её (но обычно это не нужно)
  if (textHeightOverride != null && textHeightOverride > 0) {
    text.set({ height: textHeightOverride })
  }

  return text
}

export const buildBackgroundObject = (settings: OverlaySettings): fabric.Rect => {
  const bw = settings.background.width
  const bh = settings.background.height
  const radius = clampRadius(settings.background.radius ?? 0, bw, bh)

  return new fabric.Rect({
    left: CANVAS_WIDTH / 2,
    top: CANVAS_HEIGHT / 2,
    width: bw,
    height: bh,
    originX: 'center',
    originY: 'center',
    fill: settings.background.color,
    opacity: settings.background.opacity,
    rx: radius,
    ry: radius,
    evented: true,
    selectable: true,
    hasControls: true,
    lockRotation: false,
    lockScalingX: false,
    lockScalingY: false,
    objectCaching: false
  })
}
