import { useEffect, useRef, useState, type RefObject } from 'react'
import * as fabric from 'fabric'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@features/editor/utils/fabricHelpers'

// Локальный тип для ref (совпадает с типами в других хуках)
type MutableRef<T> = { current: T }

export const useFabricCanvas = (): {
  hostRef: RefObject<HTMLDivElement | null>
  fabricRef: MutableRef<fabric.Canvas | null>
  isCanvasReadyRef: MutableRef<boolean>
  canvasInstance: fabric.Canvas | null
} => {
  const hostRef = useRef<HTMLDivElement | null>(null)
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
    // Логические размеры остаются фиксированными для fabric.js
    el.width = CANVAS_WIDTH
    el.height = CANVAS_HEIGHT
    host.appendChild(el)
    
    // Функция для обновления размеров canvas
    // Используем фиксированные логические размеры - fabric.js будет правильно вычислять координаты
    const updateCanvasSize = (): void => {
      if (!el || !host || !fabricRef.current) return
      // Логические размеры остаются фиксированными (450x800)
      // Визуальные размеры устанавливаем равными логическим
      // Масштабирование происходит на уровне контейнера (CanvasContainer)
      el.style.width = `${CANVAS_WIDTH}px`
      el.style.height = `${CANVAS_HEIGHT}px`
      
      // Обновляем размеры wrapper равными логическим размерам
      if (fabricRef.current.wrapperEl) {
        const wrapper = fabricRef.current.wrapperEl
        wrapper.style.width = `${CANVAS_WIDTH}px`
        wrapper.style.height = `${CANVAS_HEIGHT}px`
        wrapper.style.transform = 'none'
      }
      
      // Пересчитываем offset для правильной работы координат
      fabricRef.current.calcOffset()
    }

    const canvas = new fabric.Canvas(el, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true,
      enableRetinaScaling: false
    })

    const wrapper = canvas.wrapperEl
    if (wrapper) {
      wrapper.style.touchAction = 'none'
      wrapper.style.position = 'relative'
    }

    fabricRef.current = canvas
    isCanvasReadyRef.current = true

    // ВАЖНО: Устанавливаем инстанс в стейт, чтобы вызвать ре-рендер зависимых компонентов
    // Используем requestAnimationFrame для избежания синхронного setState в effect
    requestAnimationFrame(() => {
      setCanvasInstance(canvas)
    })

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!isCanvasReadyRef.current || !fabricRef.current) return
        updateCanvasSize()
        // Обновляем координаты всех объектов после изменения размеров
        fabricRef.current.getObjects().forEach((obj) => {
          obj.setCoords()
        })
        if (fabricRef.current.contextContainer) {
          fabricRef.current.requestRenderAll()
        }
      })
    })
    ro.observe(host)
    
    // Инициализируем размеры при создании
    updateCanvasSize()

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
