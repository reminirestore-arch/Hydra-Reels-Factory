import * as fabric from 'fabric'
import { OverlaySettings } from '@shared/types'
import { CANVAS_HEIGHT, CANVAS_WIDTH, clampRadius } from '@features/editor/utils/fabricHelpers'

export const configureTextControls = (text: fabric.Textbox): void => {
  text.set({ lockUniScaling: true, objectCaching: false })
}

export const buildTextObject = (
  settings: OverlaySettings,
  textValueOverride?: string
): fabric.Textbox => {
  return new fabric.Textbox(textValueOverride ?? 'Текст Рилса', {
    left: CANVAS_WIDTH / 2,
    top: CANVAS_HEIGHT / 2,
    fontFamily: 'Arial',
    fill: settings.text.color,
    fontSize: settings.text.fontSize,
    fontWeight: 'bold',
    textAlign: settings.text.align,
    width: settings.background.width,
    originX: 'center',
    originY: 'center',
    editable: true,
    selectable: true,
    splitByGrapheme: false,
    objectCaching: false
  })
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
