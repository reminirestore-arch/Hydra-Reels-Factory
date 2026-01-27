import { JSX, RefObject, useEffect, useState, useRef } from 'react'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@features/editor/utils/fabricHelpers'

interface CanvasContainerProps {
  hostRef: RefObject<HTMLDivElement | null>
}

export const CanvasContainer = ({ hostRef }: CanvasContainerProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = (): void => {
      // Используем clientWidth/clientHeight, которые уже учитывают padding
      const availableWidth = container.clientWidth
      const availableHeight = container.clientHeight

      if (availableWidth <= 0 || availableHeight <= 0) return

      // Вычисляем размер с сохранением пропорций 9:16
      const aspectRatio = 9 / 16
      let canvasWidth = availableWidth
      let canvasHeight = canvasWidth / aspectRatio

      // Если высота превышает доступное пространство, ограничиваем по высоте
      if (canvasHeight > availableHeight) {
        canvasHeight = availableHeight
        canvasWidth = canvasHeight * aspectRatio
      }

      setDimensions({ width: canvasWidth, height: canvasHeight })
    }

    updateDimensions()

    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-gray-900 to-black">
      <div
        ref={containerRef}
        className="relative shadow-2xl shadow-black ring-1 ring-white/10 w-full h-full flex items-center justify-center"
      >
        <div
          ref={hostRef}
          className="relative"
          style={{
            ...(dimensions
              ? {
                  width: `${CANVAS_WIDTH}px`,
                  height: `${CANVAS_HEIGHT}px`,
                  transform: `scale(${Math.min(dimensions.width / CANVAS_WIDTH, dimensions.height / CANVAS_HEIGHT)})`,
                  transformOrigin: 'center'
                }
              : {
                  aspectRatio: '9 / 16',
                  width: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  height: 'auto'
                })
          }}
        />
        <div className="pointer-events-none absolute inset-0 border border-white/5 mix-blend-overlay"></div>
      </div>
    </div>
  )
}
