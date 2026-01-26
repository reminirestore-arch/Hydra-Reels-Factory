import { useState, useEffect } from 'react'
import * as fabric from 'fabric'
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'
import { createDefaultStrategy } from '@shared/defaults'
import { mergeOverlaySettings } from './utils/fabricHelpers'

import { useFabricCanvas } from './hooks/useFabricCanvas'
import { useOverlayLogic } from './hooks/useOverlayLogic'
import { useEditorHydration } from './hooks/useEditorHydration'

import { EditorToolbar } from './components/EditorToolbar'
import { LayersPanel } from './components/LayersPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { CanvasContainer } from './components/CanvasContainer'

interface EditorCanvasProps {
  filePath: string
  strategyId: StrategyType
  initialState?: object
  initialOverlaySettings?: OverlaySettings
  initialProfileSettings?: StrategyProfileSettings
  onSave: (payload: any) => void
  onClose: () => void
}

export const EditorCanvas = ({
  filePath,
  strategyId,
  initialState,
  initialOverlaySettings,
  initialProfileSettings,
  onSave,
  onClose
}: EditorCanvasProps) => {
  // 1. Core State
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(() =>
    mergeOverlaySettings(initialOverlaySettings)
  )
  const [profileSettings, setProfileSettings] = useState<StrategyProfileSettings>(
    initialProfileSettings ?? createDefaultStrategy(strategyId).profileSettings
  )

  // 2. Init Canvas
  // Получаем canvasInstance
  const { hostRef, fabricRef, isCanvasReadyRef, canvasInstance } = useFabricCanvas()

  // 3. Init Logic
  const logic = useOverlayLogic({
    fabricRef,
    isCanvasReadyRef,
    canvasInstance, // Передаем инстанс
    overlaySettings,
    setOverlaySettings,
    initialState
  })

  // 4. Update Setting Effect
  useEffect(() => {
    logic.applyOverlaySettings()
  }, [logic.applyOverlaySettings, overlaySettings])

  // 5. Init Hydration
  const hydration = useEditorHydration({
    fabricRef,
    isCanvasReadyRef,
    canvasInstance, // Передаем инстанс
    filePath,
    initialState,
    syncOverlayObjects: logic.syncOverlayObjects,
    ensureFrameImage: logic.ensureFrameImage,
    frameImageRef: logic.frameImageRef,
    overlaySettings,
    profileSettings,
    onSave
  })

  return (
    <div className="flex flex-col h-full w-full bg-black/95">
      <EditorToolbar onAddText={logic.addText} onSave={hydration.handleSave} onClose={onClose} />

      <div className="flex flex-1 min-h-0">
        <LayersPanel
          elements={logic.canvasElements}
          selectedRole={logic.selectedRole}
          selectedBlockId={logic.selectedBlockId}
          fabricRef={fabricRef}
          getOverlayBlock={logic.getOverlayBlock}
        />

        <CanvasContainer hostRef={hostRef} />

        <SettingsPanel
          overlaySettings={overlaySettings}
          setOverlaySettings={setOverlaySettings}
          profileSettings={profileSettings}
          setProfileSettings={setProfileSettings}
          textValue={logic.textValue}
          setTextValue={logic.setTextValue}
          strategyId={strategyId}
          onAlignText={logic.alignTextInsideBackground}
          onAlignVertical={logic.alignTextVertically}
          onCenterText={logic.handleCenterText}
          onCenterBackground={logic.handleCenterBackground}
          updateCanvasText={(val) => {
            const block = logic.getOverlayBlock(logic.selectedBlockId)
            if (block) {
              block.text.set({ text: val })
              if (fabricRef.current) {
                fabricRef.current.fire('text:changed', {
                  target: block.text
                } as fabric.TEvent)
              }
              fabricRef.current?.requestRenderAll()
            }
          }}
        />
      </div>
    </div>
  )
}
