import { RefObject } from 'react'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@features/editor/utils/fabricHelpers'

interface CanvasContainerProps {
  hostRef: RefObject<HTMLDivElement | null>
}

export const CanvasContainer = ({ hostRef }: CanvasContainerProps): JSX.Element => {
  return (
    <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-gray-900 to-black">
      <div className="relative shadow-2xl shadow-black ring-1 ring-white/10">
        <div
          ref={hostRef}
          className="relative"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        />
        <div className="pointer-events-none absolute inset-0 border border-white/5 mix-blend-overlay"></div>
      </div>
    </div>
  )
}
