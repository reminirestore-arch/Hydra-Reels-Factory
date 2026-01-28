import { ScrollShadow } from '@heroui/react'
import {
  CanvasElementNode,
  CanvasElementRole,
  OverlayBlock
} from '@features/editor/utils/fabricHelpers'
import * as fabric from 'fabric'
import { Trash2 } from 'lucide-react'
import { JSX } from 'react'

interface LayersPanelProps {
  elements: CanvasElementNode[]
  selectedRole: CanvasElementRole | null
  selectedBlockId: number | null
  fabricRef: { current: fabric.Canvas | null }
  getOverlayBlock: (id?: number | null) => OverlayBlock | null
  onRemoveBlock: (blockId: number) => void
}

export const LayersPanel = ({
  elements,
  selectedRole,
  selectedBlockId,
  fabricRef,
  getOverlayBlock,
  onRemoveBlock
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

  const handleRemove = (e: React.MouseEvent, blockId: number | undefined): void => {
    e.stopPropagation()
    if (blockId) {
      onRemoveBlock(blockId)
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
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => handleSelect(element)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all ${
                    selectedRole === element.role &&
                    (element.role === 'frame' || selectedBlockId === element.blockId)
                      ? 'bg-primary/25 text-primary ring-2 ring-primary/60 ring-inset border-l-4 border-primary'
                      : 'bg-white/5 hover:bg-white/10 border-l-4 border-transparent ring-2 ring-transparent ring-inset'
                  }`}
                >
                  <span>{element.label}</span>
                  {element.children && element.children.length > 0 && (
                    <span className="text-xs text-default-500">Группа</span>
                  )}
                </button>
                {element.blockId && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, element.blockId)}
                    className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-danger-soft-hover text-danger transition-opacity"
                    title="Удалить блок"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {element.children?.map((child) => (
                <div key={child.id} className="ml-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSelect(child)}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-all ${
                      selectedRole === child.role && selectedBlockId === child.blockId
                        ? 'bg-primary/25 text-primary ring-2 ring-primary/60 ring-inset border-l-4 border-primary'
                        : 'bg-white/5 hover:bg-white/10 border-l-4 border-transparent ring-2 ring-transparent ring-inset'
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
