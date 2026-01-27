import { useState, useEffect, useMemo, useCallback } from 'react'
import * as fabric from 'fabric'
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'
import { createDefaultStrategy } from '@shared/defaults'
import { mergeOverlaySettings } from './utils/fabricHelpers'
import type { OverlaySavePayload } from './types'

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
  onSave: (payload: OverlaySavePayload) => void
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
}: EditorCanvasProps): React.JSX.Element => {
  // 1. Core State (memoized initial values)
  const initialOverlaySettingsMemo = useMemo(
    () => mergeOverlaySettings(initialOverlaySettings),
    [initialOverlaySettings]
  )
  const initialProfileSettingsMemo = useMemo(
    () => initialProfileSettings ?? createDefaultStrategy(strategyId).profileSettings,
    [initialProfileSettings, strategyId]
  )

  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(initialOverlaySettingsMemo)
  const [profileSettings, setProfileSettings] = useState<StrategyProfileSettings>(initialProfileSettingsMemo)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logic, overlaySettings])

  // Memoized callbacks
  const handleSave = useCallback(
    (payload: OverlaySavePayload) => {
      onSave(payload)
    },
    [onSave]
  )

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // 5. Init Hydration
  const hydration = useEditorHydration({
    fabricRef,
    isCanvasReadyRef,
    canvasInstance, // Передаем инстанс
    filePath,
    strategyId,
    initialState,
    syncOverlayObjects: logic.syncOverlayObjects,
    ensureFrameImage: logic.ensureFrameImage,
    frameImageRef: logic.frameImageRef,
    overlaySettings,
    profileSettings,
    onSave: handleSave
  })

  return (
    <div className="flex flex-col h-full w-full bg-black/95">
      <EditorToolbar onAddText={logic.addText} onSave={hydration.handleSave} onClose={handleClose} />

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
          updateCanvasText={useCallback(
            (val: string) => {
              const block = logic.getOverlayBlock(logic.selectedBlockId)
              if (block) {
                block.text.set({ text: val })
                if (fabricRef.current) {
                  fabricRef.current.fire('text:changed', {
                    target: block.text as fabric.IText
                  })
                }
                fabricRef.current?.requestRenderAll()
              }
            },
            [logic]
          )}
          onTestFadeOut={useCallback(() => {
            logic.animateFadeOutBlock()
          }, [logic])}
        />
      </div>
    </div>
  )
}
