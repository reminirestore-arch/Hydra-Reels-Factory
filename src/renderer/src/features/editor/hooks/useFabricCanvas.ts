import { useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/fabricHelpers'

export const useFabricCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const isCanvasReadyRef = useRef(false)
  // Добавляем стейт, чтобы оповестить остальные хуки о готовности
  const [canvasInstance, setCanvasInstance] = useState<fabric.Canvas | null>(null)

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

    const wrapper = canvas.wrapperEl
    if (wrapper) wrapper.style.touchAction = 'none'

    fabricRef.current = canvas
    isCanvasReadyRef.current = true

    // ВАЖНО: Устанавливаем инстанс в стейт, чтобы вызвать ре-рендер зависимых компонентов
    setCanvasInstance(canvas)

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

    requestAnimationFrame(() => {
      if (!isCanvasReadyRef.current || !fabricRef.current) return
      fabricRef.current.calcOffset()
      fabricRef.current.requestRenderAll()
    })

    return () => {
      isCanvasReadyRef.current = false
      setCanvasInstance(null) // Сбрасываем при размонтировании
      ro.disconnect()

      if (fabricRef.current === canvas) {
        fabricRef.current = null
      }

      canvas.off()
      canvas.dispose().catch((err) => console.warn('Canvas dispose warning:', err))
      host.replaceChildren()
    }
  }, [])

  return { hostRef, fabricRef, isCanvasReadyRef, canvasInstance }
}
