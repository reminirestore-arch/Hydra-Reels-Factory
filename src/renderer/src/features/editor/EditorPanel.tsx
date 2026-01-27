/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { JSX } from 'react'
import { Button, Card, Chip, ScrollShadow } from '@heroui/react'
import { VideoFile, StrategyType } from '@shared/types'
import { Wand2, Zap, Activity, Layers, Play } from 'lucide-react'

interface EditorPanelProps {
  file: VideoFile
  onOpenEditor: (strategy: StrategyType) => void
  isProcessing: boolean
}

const STRATEGIES = [
  { id: 'IG1', label: 'Юмор', desc: 'Focus + Vignette', icon: <Wand2 size={18} /> },
  { id: 'IG2', label: 'POV', desc: 'Dynamic + Saturation', icon: <Zap size={18} /> },
  { id: 'IG3', label: 'Кликбейт', desc: 'High Contrast', icon: <Activity size={18} /> },
  { id: 'IG4', label: 'ASMR', desc: 'Cinema + Grain', icon: <Layers size={18} /> }
] as const

export const EditorPanel = ({
  file,
  onOpenEditor,
  isProcessing
}: EditorPanelProps): JSX.Element => {
  return (
    <div className="flex flex-col h-full bg-black/90 relative border-l border-white/5">
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.15),transparent)]" />

      <div className="z-10 p-6 pb-2 shrink-0">
        <div className="flex justify-between items-start">
          <div className="overflow-hidden">
            <h2 className="text-xl font-bold text-foreground truncate" title={file.filename}>
              {file.filename}
            </h2>
            <div className="flex gap-2 mt-2">
              <Chip size="sm" variant="soft" color="default" className="text-xs">
                {file.duration ? `${Math.round(file.duration)}s` : '...'}
              </Chip>
              <Chip size="sm" variant="soft" color="warning" className="text-xs">
                MP4
              </Chip>
            </div>
          </div>
          <Button
            isIconOnly
            size="sm"
            {...({ children: <Play size={16} fill="currentColor" /> } as any)}
          />
        </div>
      </div>

      <div className="w-full h-px bg-white/10 my-4" />

      <ScrollShadow className="flex-1 px-6 z-10 space-y-8 pb-24">
        <div>
          <label className="text-xs text-default-500 font-bold uppercase tracking-wider mb-3 block">
            4 версии обработки
          </label>
          <div className="grid grid-cols-2 gap-4">
            {STRATEGIES.map((strat) => {
              const strategyState = file.strategies[strat.id]
              return (
                <Card key={strat.id} className="bg-default-100/10 border border-white/5 shadow-sm">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {strat.icon}
                        {strat.id}: {strat.label}
                      </div>
                      <Chip
                        size="sm"
                        color={strategyState.status === 'custom' ? 'success' : 'default'}
                      >
                        {strategyState.status === 'custom' ? 'КАСТОМНЫЙ' : 'ДЕФОЛТНЫЙ'}
                      </Chip>
                    </div>
                    <p className="text-xs text-default-400">{strat.desc}</p>
                    {strategyState.textData && (
                      <p className="text-xs text-default-300 line-clamp-2">
                        “{strategyState.textData}”
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => onOpenEditor(strat.id)}
                      isDisabled={isProcessing}
                      {...({ children: 'Настроить' } as any)}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </ScrollShadow>
    </div>
  )
}
