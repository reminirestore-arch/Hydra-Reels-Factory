import * as fabric from 'fabric'

type MutableRef<T> = { current: T }

export const getBlockId = (obj?: fabric.Object | null): number | null => {
  const blockId = (obj as { data?: { blockId?: number } })?.data?.blockId
  return typeof blockId === 'number' && Number.isFinite(blockId) ? blockId : null
}

export const ensureRolesOnObjects = (canvas: fabric.Canvas): void => {
  const objects = canvas.getObjects()
  for (const obj of objects) {
    if (!obj.data) obj.data = {}
    if (
      !obj.data.role &&
      (obj instanceof fabric.IText ||
        obj instanceof fabric.Textbox ||
        obj instanceof fabric.FabricText)
    ) {
      obj.data.role = 'overlay-text'
    }
    if (!obj.data.role && obj instanceof fabric.Rect) {
      obj.data.role = 'overlay-background'
    }
  }
}

export const ensureOverlayIds = (
  canvas: fabric.Canvas,
  nextBlockIdRef: MutableRef<number>
): void => {
  const objects = canvas.getObjects()
  const backgrounds = objects.filter((obj) => obj.data?.role === 'overlay-background')
  const texts = objects.filter((obj) => obj.data?.role === 'overlay-text')

  const existingIds = new Set<number>()
  ;[...backgrounds, ...texts].forEach((obj) => {
    const id = getBlockId(obj)
    if (id) existingIds.add(id)
  })

  let nextId = Math.max(0, ...Array.from(existingIds)) + 1
  const assignId = (obj: fabric.Object, blockId: number): void => {
    obj.data = { ...(obj.data ?? {}), blockId }
  }

  if (existingIds.size === 0 && (backgrounds.length > 0 || texts.length > 0)) {
    const count = Math.max(backgrounds.length, texts.length)
    for (let i = 0; i < count; i++) {
      const blockId = nextId++
      if (backgrounds[i]) assignId(backgrounds[i], blockId)
      if (texts[i]) assignId(texts[i], blockId)
    }
    nextBlockIdRef.current = nextId
    return
  }

  const missingBg = backgrounds.filter((o) => !getBlockId(o))
  const missingTx = texts.filter((o) => !getBlockId(o))
  const count = Math.max(missingBg.length, missingTx.length)
  for (let i = 0; i < count; i++) {
    const blockId = nextId++
    if (missingBg[i]) assignId(missingBg[i], blockId)
    if (missingTx[i]) assignId(missingTx[i], blockId)
  }
  nextBlockIdRef.current = Math.max(nextBlockIdRef.current, nextId)
}
