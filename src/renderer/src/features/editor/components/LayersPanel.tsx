import { ScrollShadow } from '@heroui/react'
import {
  CanvasElementNode,
  CanvasElementRole,
  OverlayBlock
} from '@features/editor/utils/fabricHelpers'
import * as fabric from 'fabric'

interface LayersPanelProps {
  elements: CanvasElementNode[]
  selectedRole: CanvasElementRole | null
  selectedBlockId: number | null
  fabricRef: { current: fabric.Canvas | null }
  getOverlayBlock: (id?: number | null) => OverlayBlock | null
}

export const LayersPanel = ({
  elements,
  selectedRole,
  selectedBlockId,
  fabricRef,
  getOverlayBlock
}: LayersPanelProps): JSX.Element => {
  const handleSelect = (element: CanvasElementNode): void => {
    if (element.role === 'frame') {
      fabricRef.current?.discardActiveObject()
      fabricRef.current?.requestRenderAll()
      return
    }
    const block = getOverlayBlock(element.blockId)
    const target = element.role === 'overlay-background' ? block?.background : block?.text
    if (target) {
      target.setCoords()
      fabricRef.current?.setActiveObject(target)
      fabricRef.current?.requestRenderAll()
    }
  }

  return (
    <aside className="w-60 border-r border-white/10 bg-black/60">
      <ScrollShadow className="h-full p-4 space-y-4">
        <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
          Элементы канвы
        </div>
        <div className="space-y-2 text-sm text-default-300">
          {elements.map((element) => (
            <div key={element.id} className="space-y-2">
              <button
                type="button"
                onClick={() => handleSelect(element)}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                  selectedRole === element.role &&
                  (element.role === 'frame' || selectedBlockId === element.blockId)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <span>{element.label}</span>
                {element.children && element.children.length > 0 && (
                  <span className="text-xs text-default-500">Группа</span>
                )}
              </button>

              {element.children?.map((child) => (
                <div key={child.id} className="ml-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSelect(child)}
                    className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${
                      selectedRole === child.role && selectedBlockId === child.blockId
                        ? 'bg-primary/15 text-primary'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {child.label}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScrollShadow>
    </aside>
  )
}
