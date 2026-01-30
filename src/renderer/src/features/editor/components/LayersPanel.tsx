/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button, ScrollShadow, Tooltip } from '@heroui/react'
import {
  CanvasElementNode,
  CanvasElementRole,
  OverlayBlock
} from '@features/editor/utils/fabricHelpers'
import { canAddOverlay } from '@shared/domain/overlayTiming'
import * as fabric from 'fabric'
import { CopyPlus, Trash2, Type } from 'lucide-react'
import { JSX } from 'react'

interface LayersPanelProps {
  elements: CanvasElementNode[]
  selectedRole: CanvasElementRole | null
  selectedBlockId: number | null
  fabricRef: { current: fabric.Canvas | null }
  getOverlayBlock: (id?: number | null) => OverlayBlock | null
  onRemoveBlock: (blockId: number) => void
  onAddText: () => void
  onDuplicateOverlay: () => void
  hasOverlaySelected: boolean
  videoDuration?: number
}

export const LayersPanel = ({
  elements,
  selectedRole,
  selectedBlockId,
  fabricRef,
  getOverlayBlock,
  onRemoveBlock,
  onAddText,
  onDuplicateOverlay,
  hasOverlaySelected,
  videoDuration
}: LayersPanelProps): JSX.Element => {
  const canAdd = canAddOverlay(videoDuration)
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
    <div className="flex flex-col h-full w-full min-h-0">
      <div className="flex items-center justify-between shrink-0 p-4 pb-2">
        <span className="text-xs text-default-500 font-bold uppercase tracking-wider">
          Элементы канвы
        </span>
        <div className="flex gap-1">
          <Tooltip delay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="primary"
              isDisabled={!canAdd}
              onPress={onAddText}
              title={canAdd ? 'Добавить текст' : 'Видео слишком короткое (мин. 3 с)'}
              className="min-w-8 w-8 h-8"
              tooltipText="Добавить текст"
              {...({ children: <Type size={16} /> } as any)}
            />
            <Tooltip.Content>
              <p>Добавить текст</p>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip delay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              isDisabled={!hasOverlaySelected || !canAdd}
              onPress={onDuplicateOverlay}
              title={
                !canAdd
                  ? 'Видео слишком короткое (мин. 3 с)'
                  : hasOverlaySelected
                    ? 'Дублировать выделенный блок'
                    : 'Выделите блок для дублирования'
              }
              tooltipText="Дублировать выделенный блок"
              className="min-w-8 w-8 h-8"
              {...({ children: <CopyPlus size={16} /> } as any)}
            />
            <Tooltip.Content>
              <p>Дублировать выделенный блок</p>
            </Tooltip.Content>
          </Tooltip>
        </div>
      </div>
      <ScrollShadow className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="space-y-2 text-sm text-default-300">
          {elements.map((element) => (
            <div key={element.id} className="space-y-2 w-full">
              <div className="relative group w-full">
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
                <div key={child.id} className="ml-4 space-y-2 w-full">
                  <button
                    type="button"
                    onClick={() => handleSelect(child)}
                    className={`flex w-full min-w-0 items-center rounded-lg px-3 py-2 text-left text-sm transition-all ${
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
    </div>
  )
}
