import * as fabric from 'fabric'
import { OverlayText, getObjectBoundingRect } from '../../utils/fabricHelpers'

export const clampTextToBackground = (background: fabric.Rect, text: OverlayText): void => {
  if (!background || !text) return
  background.setCoords()
  text.setCoords()

  const backgroundBounds = getObjectBoundingRect(background)
  const textWidth = text.getScaledWidth()
  const textHeight = text.getScaledHeight()

  const centerX = backgroundBounds.left + backgroundBounds.width / 2
  const centerY = backgroundBounds.top + backgroundBounds.height / 2

  const minX = backgroundBounds.left + textWidth / 2
  const maxX = backgroundBounds.left + backgroundBounds.width - textWidth / 2
  const minY = backgroundBounds.top + textHeight / 2
  const maxY = backgroundBounds.top + backgroundBounds.height - textHeight / 2

  const nextLeft = Math.min(Math.max(text.left ?? centerX, minX), maxX)
  const nextTop = Math.min(Math.max(text.top ?? centerY, minY), maxY)

  text.set({
    left: Number.isFinite(nextLeft) ? nextLeft : centerX,
    top: Number.isFinite(nextTop) ? nextTop : centerY
  })
  text.setCoords()
}

export const updateLinkOffsets = (background: fabric.Rect, text: OverlayText): void => {
  if (!background || !text) return
  background.setCoords()
  text.setCoords()

  const backgroundCenter = background.getCenterPoint()
  const textCenter = text.getCenterPoint()

  const angle = fabric.util.degreesToRadians(background.angle ?? 0)
  const dx = textCenter.x - backgroundCenter.x
  const dy = textCenter.y - backgroundCenter.y

  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)

  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos

  text.data = {
    ...(text.data ?? {}),
    link: {
      offsetX: localX / (background.scaleX ?? 1),
      offsetY: localY / (background.scaleY ?? 1),
      rotationOffset: (text.angle ?? 0) - (background.angle ?? 0)
    }
  }
}

export const attachTextToBackground = (background: fabric.Rect, text: OverlayText): void => {
  updateLinkOffsets(background, text)
}

export const syncTextWithBackground = (background: fabric.Rect, text: OverlayText): void => {
  if (!background || !text) return
  const link = text.data?.link
  if (!link) {
    updateLinkOffsets(background, text)
    return
  }

  background.setCoords()
  text.setCoords()

  const backgroundCenter = background.getCenterPoint()
  const angle = fabric.util.degreesToRadians(background.angle ?? 0)
  const offsetX = link.offsetX ?? 0
  const offsetY = link.offsetY ?? 0
  const rotationOffset = link.rotationOffset ?? 0

  const scaledX = offsetX * (background.scaleX ?? 1)
  const scaledY = offsetY * (background.scaleY ?? 1)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const rotatedX = scaledX * cos - scaledY * sin
  const rotatedY = scaledX * sin + scaledY * cos

  text.set({
    left: backgroundCenter.x + rotatedX,
    top: backgroundCenter.y + rotatedY,
    angle: (background.angle ?? 0) + rotationOffset,
    originX: 'center',
    originY: 'center'
  })
  text.setCoords()
}

export const restoreLinkFromText = (background: fabric.Rect, text: OverlayText): boolean => {
  const link = text.data?.link
  if (link && typeof link.offsetX === 'number') {
    syncTextWithBackground(background, text)
    return true
  }
  return false
}
