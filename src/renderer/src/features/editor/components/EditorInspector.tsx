import type { JSX } from 'react'
import { ScrollShadow, Separator } from '@heroui/react'
import * as fabric from 'fabric'
import {
  CanvasElementNode,
  CanvasElementRole,
  OverlayBlock
} from '@features/editor/utils/fabricHelpers'
import type { Dispatch, SetStateAction } from 'react'
import type { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'
import { LayersPanel } from './LayersPanel'
import { SettingsPanel } from './SettingsPanel'

interface LayersPanelProps {
  elements: CanvasElementNode[]
  selectedRole: CanvasElementRole | null
  selectedBlockId: number | null
  fabricRef: { current: fabric.Canvas | null }
  getOverlayBlock: (id?: number | null) => OverlayBlock | null
  onRemoveBlock: (blockId: number) => void
}

interface SettingsPanelProps {
  overlaySettings: OverlaySettings
  setOverlaySettings: Dispatch<SetStateAction<OverlaySettings>>
  profileSettings: StrategyProfileSettings
  setProfileSettings: Dispatch<SetStateAction<StrategyProfileSettings>>
  textValue: string
  setTextValue: (v: string) => void
  strategyId: StrategyType
  onAlignTextBlock: (options: {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'center' | 'bottom'
  }) => void
  currentVerticalAlign?: 'top' | 'center' | 'bottom'
  onCenterText: () => void
  onCenterBackground: (axis: 'horizontal' | 'vertical') => void
  updateCanvasText: (val: string) => void
  onTestFadeOut?: () => void
}

export interface EditorInspectorProps {
  layers: LayersPanelProps
  settings: SettingsPanelProps
}

export const EditorInspector = ({
  layers,
  settings
}: EditorInspectorProps): JSX.Element => {
  return (
    <aside className="w-[320px] min-w-[320px] flex flex-col h-full border-l border-white/10 bg-black/60 shrink-0">
      {/* Top ~30%: Layers */}
      <div className="flex-[0_0_30%] min-h-0 overflow-hidden flex flex-col">
        <LayersPanel
            elements={layers.elements}
            selectedRole={layers.selectedRole}
            selectedBlockId={layers.selectedBlockId}
            fabricRef={layers.fabricRef}
            getOverlayBlock={layers.getOverlayBlock}
            onRemoveBlock={layers.onRemoveBlock}
          />
      </div>

      <Separator className="shrink-0" />

      {/* Bottom flex-1: Settings */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollShadow className="flex-1 h-full">
          <SettingsPanel
            overlaySettings={settings.overlaySettings}
            setOverlaySettings={settings.setOverlaySettings}
            profileSettings={settings.profileSettings}
            setProfileSettings={settings.setProfileSettings}
            textValue={settings.textValue}
            setTextValue={settings.setTextValue}
            strategyId={settings.strategyId}
            onAlignTextBlock={settings.onAlignTextBlock}
            currentVerticalAlign={settings.currentVerticalAlign}
            onCenterText={settings.onCenterText}
            onCenterBackground={settings.onCenterBackground}
            updateCanvasText={settings.updateCanvasText}
            onTestFadeOut={settings.onTestFadeOut}
          />
        </ScrollShadow>
      </div>
    </aside>
  )
}
