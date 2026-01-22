import { useState, JSX } from 'react'
import { Button, Card, Slider, Switch, Chip, Tabs, ScrollShadow, Label } from '@heroui/react'
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
}

const STRATEGIES = [
  { id: 'IG1', label: 'Юмор', desc: 'Focus + Vignette', icon: <Wand2 size={18} /> },
  { id: 'IG2', label: 'POV', desc: 'Dynamic + Saturation', icon: <Zap size={18} /> },
  { id: 'IG3', label: 'Кликбейт', desc: 'High Contrast', icon: <Activity size={18} /> },
  { id: 'IG4', label: 'ASMR', desc: 'Cinema + Grain', icon: <Layers size={18} /> }
] as const

export const EditorPanel = ({ file }: EditorPanelProps): JSX.Element => {
  const [settings, setSettings] = useState<EditorSettings>({
    strategy: 'IG1',
    volume: 0,
    speed: 1.0,
    saturation: 1.0,
    vignette: false,
    captions: false
  })

  const currentStrategy = STRATEGIES.find((s) => s.id === settings.strategy)

  return (
    <div className="flex flex-col h-full bg-black/90 relative border-l border-white/5">
      {/* Background Noise */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      {/* Header */}
      <div className="z-10 p-6 pb-2 shrink-0">
        <div className="flex justify-between items-start">
          <div className="overflow-hidden">
            <h2 className="text-xl font-bold text-foreground truncate" title={file.name}>
              {file.name}
            </h2>
            <div className="flex gap-2 mt-2">
              <Chip size="sm" variant="soft" color="default" className="text-xs">
                1080p
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

      {/* Main Content */}
      <ScrollShadow className="flex-1 px-6 z-10 space-y-8 pb-24">
        {/* Strategy Selector */}
        <div>
          <label className="text-xs text-default-500 font-bold uppercase tracking-wider mb-3 block">
            Стратегия обработки
          </label>

          <Tabs
            variant="secondary"
            selectedKey={settings.strategy}
            onSelectionChange={(key) =>
              setSettings((s) => ({ ...s, strategy: key as StrategyType }))
            }
            className="w-full"
          >
            <Tabs.ListContainer>
              <Tabs.List
                className="w-full grid grid-cols-4 gap-4 border-b border-white/10 pb-0"
                aria-label="Strategies"
              >
                {STRATEGIES.map((strat) => (
                  <Tabs.Tab
                    key={strat.id}
                    id={strat.id}
                    className="h-12 px-0 flex items-center justify-center data-[selected=true]:text-primary"
                  >
                    <div className="flex items-center gap-2 z-10">
                      {strat.icon}
                      <span>{strat.id}</span>
                    </div>
                    <Tabs.Indicator className="bg-primary" />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          <Card className="mt-4 bg-default-100/10 border border-white/5 shadow-sm">
            <div className="p-4">
              <p className="text-sm font-medium text-foreground">{currentStrategy?.label}</p>
              <p className="text-xs text-default-400 mt-1">{currentStrategy?.desc}</p>
            </div>
          </Card>
        </div>

        {/* Sliders Section */}
        <div className="space-y-6">
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

        {/* Toggles Section */}
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

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md absolute bottom-0 left-0 right-0 z-20">
        {/* 👇 ИСПРАВЛЕННАЯ КНОПКА ПО СТАНДАРТУ V3 */}
        <Button
          fullWidth
          size="lg"
          // Вместо color="success" используем классы bg-success
          // Вместо startContent кладем иконку внутрь
          className="font-bold text-black shadow-lg shadow-success/40 bg-success hover:bg-success/90 flex items-center justify-center gap-2"
          onPress={() => console.log('Exporting settings:', settings)}
        >
          <Save size={20} />
          ПРИМЕНИТЬ
        </Button>
      </div>
    </div>
  )
}
