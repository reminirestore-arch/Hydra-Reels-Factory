import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react'
import * as fabric from 'fabric'
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'
import { createDefaultStrategy } from '@shared/defaults'
import { mergeOverlaySettings } from './utils/fabricHelpers'
import type { OverlaySavePayload } from './types'

import { useFabricCanvas } from './hooks/useFabricCanvas'
import { useOverlayLogic } from './hooks/useOverlayLogic'
import { useEditorHydration } from './hooks/useEditorHydration'

import { EditorToolbar } from './components/EditorToolbar'
import { CanvasContainer } from './components/CanvasContainer'
import { EditorInspector } from './components/EditorInspector'
import type { EditorInspectorProps } from './components/EditorInspector'

export interface EditorWorkspaceProviderProps {
  filePath: string
  strategyId: StrategyType
  initialState?: object
  initialOverlaySettings?: OverlaySettings
  initialProfileSettings?: StrategyProfileSettings
  onSave: (payload: OverlaySavePayload) => void
  onUnselectStrategy?: () => void
}

interface EditorWorkspaceContextValue {
  hostRef: React.RefObject<HTMLDivElement | null>
  fabricRef: { current: fabric.Canvas | null }
  strategyId: StrategyType
  overlaySettings: OverlaySettings
  setOverlaySettings: React.Dispatch<React.SetStateAction<OverlaySettings>>
  profileSettings: StrategyProfileSettings
  setProfileSettings: React.Dispatch<React.SetStateAction<StrategyProfileSettings>>
  logic: ReturnType<typeof useOverlayLogic>
  hydration: ReturnType<typeof useEditorHydration>
  handleClose: () => void
}

const EditorWorkspaceContext = createContext<EditorWorkspaceContextValue | null>(null)

function useEditorWorkspace(): EditorWorkspaceContextValue {
  const ctx = useContext(EditorWorkspaceContext)
  if (!ctx) {
    throw new Error('EditorWorkspace.Center / EditorWorkspace.Inspector must be used inside EditorWorkspace.Provider')
  }
  return ctx
}

export function EditorWorkspaceProvider({
  filePath,
  strategyId,
  initialState,
  initialOverlaySettings,
  initialProfileSettings,
  onSave,
  onUnselectStrategy
}: EditorWorkspaceProviderProps): React.JSX.Element {
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

  const { hostRef, fabricRef, isCanvasReadyRef, canvasInstance } = useFabricCanvas()

  const logic = useOverlayLogic({
    fabricRef,
    isCanvasReadyRef,
    canvasInstance,
    overlaySettings,
    setOverlaySettings,
    initialState
  })

  useEffect(() => {
    logic.applyOverlaySettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logic, overlaySettings])

  const handleSave = useCallback(
    (payload: OverlaySavePayload) => {
      onSave(payload)
    },
    [onSave]
  )

  const handleClose = useCallback(() => {
    onUnselectStrategy?.()
  }, [onUnselectStrategy])

  const hydration = useEditorHydration({
    fabricRef,
    isCanvasReadyRef,
    canvasInstance,
    filePath,
    strategyId,
    initialState,
    syncOverlayObjects: logic.syncOverlayObjects,
    ensureFrameImage: logic.ensureFrameImage,
    frameImageRef: logic.frameImageRef,
    setIsHydrating: logic.setIsHydrating,
    overlaySettings,
    profileSettings,
    onSave: handleSave
  })

  const value: EditorWorkspaceContextValue = useMemo(
    () => ({
      hostRef,
      fabricRef,
      strategyId,
      overlaySettings,
      setOverlaySettings,
      profileSettings,
      setProfileSettings,
      logic,
      hydration,
      handleClose
    }),
    [
      hostRef,
      fabricRef,
      strategyId,
      overlaySettings,
      profileSettings,
      logic,
      hydration,
      handleClose
    ]
  )

  return (
    <div className="flex flex-1 min-w-0 min-h-0">
      <EditorWorkspaceContext.Provider value={value}>
        <div className="flex flex-1 min-w-0 min-h-0">
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <EditorWorkspaceCenter />
          </div>
          <EditorWorkspaceInspector />
        </div>
      </EditorWorkspaceContext.Provider>
    </div>
  )
}

export function EditorWorkspaceCenter(): React.JSX.Element {
  const { hostRef, fabricRef, logic, hydration, handleClose } = useEditorWorkspace()

  const onContainerResize = useCallback(() => {
    fabricRef.current?.requestRenderAll()
  }, [fabricRef])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-black/95">
      <EditorToolbar
        onAddText={logic.addText}
        onDuplicateOverlay={logic.duplicateOverlayBlock}
        hasOverlaySelected={logic.selectedBlockId != null}
        onSave={hydration.handleSave}
        onClose={handleClose}
      />
      <div className="flex-1 min-h-0 flex flex-col">
        <CanvasContainer hostRef={hostRef} onContainerResize={onContainerResize} />
      </div>
    </div>
  )
}

export function EditorWorkspaceInspector(): React.JSX.Element {
  const { fabricRef, strategyId, overlaySettings, setOverlaySettings, profileSettings, setProfileSettings, logic } =
    useEditorWorkspace()

  const currentVerticalAlign = useMemo(() => {
    const block = logic.getOverlayBlock(logic.selectedBlockId)
    if (block?.text?.data) {
      const data = block.text.data as { verticalAlignRelativeToBg?: 'top' | 'center' | 'bottom' }
      return data.verticalAlignRelativeToBg ?? 'center'
    }
    return 'center'
  }, [logic.selectedBlockId, logic.getOverlayBlock])

  const updateCanvasText = useCallback(
    (val: string) => {
      const block = logic.getOverlayBlock(logic.selectedBlockId)
      if (block) {
        block.text.set({ text: val })
        if (fabricRef.current) {
          fabricRef.current.fire('text:changed', { target: block.text as fabric.IText })
        }
        fabricRef.current?.requestRenderAll()
      }
    },
    [logic, fabricRef]
  )

  const inspectorProps: EditorInspectorProps = useMemo(
    () => ({
      layers: {
        elements: logic.canvasElements,
        selectedRole: logic.selectedRole,
        selectedBlockId: logic.selectedBlockId,
        fabricRef,
        getOverlayBlock: logic.getOverlayBlock,
        onRemoveBlock: logic.removeOverlayBlock
      },
      settings: {
        overlaySettings,
        setOverlaySettings,
        profileSettings,
        setProfileSettings,
        textValue: logic.textValue,
        setTextValue: logic.setTextValue,
        strategyId,
        onAlignTextBlock: logic.alignText,
        currentVerticalAlign,
        onCenterText: logic.handleCenterText,
        onCenterBackground: logic.handleCenterBackground,
        updateCanvasText,
        onTestFadeOut: () => logic.animateFadeOutBlock()
      }
    }),
    [
      logic,
      fabricRef,
      overlaySettings,
      setOverlaySettings,
      profileSettings,
      setProfileSettings,
      strategyId,
      currentVerticalAlign,
      updateCanvasText
    ]
  )

  return <EditorInspector {...inspectorProps} />
}
