import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/fabricHelpers'

export const useFabricCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const isCanvasReadyRef = useRef(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (fabricRef.current) return

    host.replaceChildren()

    const el = document.createElement('canvas')
    el.width = CANVAS_WIDTH
    el.height = CANVAS_HEIGHT
    el.style.width = `${CANVAS_WIDTH}px`
    el.style.height = `${CANVAS_HEIGHT}px`
    host.appendChild(el)

    const canvas = new fabric.Canvas(el, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true,
      enableRetinaScaling: false
    })

    const wrapper = (canvas as any).wrapperEl as HTMLDivElement | undefined
    if (wrapper) wrapper.style.touchAction = 'none'

    fabricRef.current = canvas
    isCanvasReadyRef.current = true

    // Resize Observer logic (можно вынести, но для краткости оставим здесь)
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!isCanvasReadyRef.current || !fabricRef.current) return
        fabricRef.current.calcOffset()
        if (fabricRef.current.contextContainer) {
          fabricRef.current.requestRenderAll()
        }
      })
    })
    ro.observe(host)

    // Initial offset calculation
    requestAnimationFrame(() => {
      if (!isCanvasReadyRef.current || !fabricRef.current) return
      fabricRef.current.calcOffset()
      fabricRef.current.requestRenderAll()
    })

    return () => {
      isCanvasReadyRef.current = false
      ro.disconnect()

      if (fabricRef.current === canvas) {
        fabricRef.current = null
      }

      canvas.off()
      canvas.dispose().catch((err) => console.warn('Canvas dispose warning:', err))
      host.replaceChildren()
    }
  }, [])

  return { hostRef, fabricRef, isCanvasReadyRef }
}
