import { useState, JSX } from 'react'
import { Button, Card, Slider, Switch, Chip, ScrollShadow, Label } from '@heroui/react'
import { VideoFile, StrategyType } from '@shared/types'
import { Wand2, Zap, Activity, Layers, Play, Save } from 'lucide-react'

export interface EditorSettings {
  strategy: StrategyType
  volume: number
  speed: number
  saturation: number
  vignette: boolean
  captions: boolean
}

interface EditorPanelProps {
  file: VideoFile
  onOpenEditor: (strategy: StrategyType) => void
  onUpdateDuration: (duration: number) => void
  onApplySettings: (settings: EditorSettings) => void
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
  onUpdateDuration,
  onApplySettings
}: EditorPanelProps): JSX.Element => {
  const [settings, setSettings] = useState<EditorSettings>({
    strategy: 'IG1',
    volume: 0,
    speed: 1.0,
    saturation: 1.0,
    vignette: false,
    captions: false
  })

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
                {file.duration ? `${Math.round(file.duration)}s` : '...' }
              </Chip>
              <Chip size="sm" variant="soft" color="warning" className="text-xs">
                MP4
              </Chip>
            </div>
          </div>
          <Button isIconOnly size="sm">
            <Play size={16} fill="currentColor" />
          </Button>
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
                <Card
                  key={strat.id}
                  className="bg-default-100/10 border border-white/5 shadow-sm"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {strat.icon}
                        {strat.id}: {strat.label}
                      </div>
                      <Chip size="sm" color={strategyState.isReady ? 'success' : 'default'}>
                        {strategyState.isReady ? 'ГОТОВО' : 'НЕ ГОТОВО'}
                      </Chip>
                    </div>
                    <p className="text-xs text-default-400">{strat.desc}</p>
                    {strategyState.textData && (
                      <p className="text-xs text-default-300 line-clamp-2">“{strategyState.textData}”</p>
                    )}
                    <Button size="sm" variant="flat" onPress={() => onOpenEditor(strat.id)}>
                      Настроить
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          <Slider
            step={0.5}
            maxValue={15}
            minValue={1}
            value={file.overlayDuration}
            onChange={(v) => onUpdateDuration(v as number)}
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Длительность текста (сек)</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
            <Slider.Track className="bg-default-500/20 h-1">
              <Slider.Fill className="bg-primary" />
              <Slider.Thumb className="bg-primary size-3" />
            </Slider.Track>
          </Slider>

          <Slider
            step={0.1}
            maxValue={2.0}
            minValue={0.5}
            defaultValue={1.0}
            value={settings.speed}
            onChange={(v) => setSettings({ ...settings, speed: v as number })}
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Скорость (Speed)</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
            <Slider.Track className="bg-default-500/20 h-1">
              <Slider.Fill className="bg-secondary" />
              <Slider.Thumb className="bg-secondary size-3" />
            </Slider.Track>
          </Slider>

          <Slider
            step={0.1}
            maxValue={2.0}
            minValue={0.0}
            defaultValue={1.0}
            value={settings.saturation}
            onChange={(v) => setSettings({ ...settings, saturation: v as number })}
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">
                Насыщенность (Saturation)
              </Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
            <Slider.Track className="bg-default-500/20 h-1">
              <Slider.Fill className="bg-warning" />
              <Slider.Thumb className="bg-warning size-3" />
            </Slider.Track>
          </Slider>
        </div>

        <div className="space-y-4">
          <Switch
            isSelected={settings.vignette}
            onChange={(v) => setSettings({ ...settings, vignette: v })}
            className="justify-between"
          >
            <div className="flex flex-col">
              <Label className="text-sm font-medium">Виньетка</Label>
              <span className="text-xs text-default-500">Затемнение углов</span>
            </div>
            <Switch.Control className="bg-default-200 data-[selected=true]:bg-primary">
              <Switch.Thumb />
            </Switch.Control>
          </Switch>

          <Switch
            isSelected={settings.captions}
            onChange={(v) => setSettings({ ...settings, captions: v })}
            className="justify-between"
          >
            <div className="flex flex-col">
              <Label className="text-sm font-medium">AI Субтитры</Label>
              <span className="text-xs text-default-500">Генерация через Whisper</span>
            </div>
            <Switch.Control className="bg-default-200 data-[selected=true]:bg-success">
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
      </ScrollShadow>

      <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md absolute bottom-0 left-0 right-0 z-20">
        <Button
          fullWidth
          size="lg"
          className="font-bold text-black shadow-lg shadow-success/40 bg-success hover:bg-success/90 flex items-center justify-center gap-2"
          onPress={() => onApplySettings(settings)}
        >
          <Save size={20} />
          ПРИМЕНИТЬ
        </Button>
      </div>
    </div>
  )
}
