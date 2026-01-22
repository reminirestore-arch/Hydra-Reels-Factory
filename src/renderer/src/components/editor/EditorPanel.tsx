import { useState, JSX } from 'react';
import {
  Button,
  Card,
  // CardBody убрали
  Slider,
  Switch,
  Chip,
  Tabs,
  Tab,
  // Divider убрали
  ScrollShadow
} from "@heroui/react";
import { VideoFile, StrategyType } from '@shared/types';
import { Wand2, Zap, Activity, Layers, Play, Save } from 'lucide-react';

export interface EditorSettings {
  strategy: StrategyType;
  volume: number;
  speed: number;
  saturation: number;
  vignette: boolean;
  captions: boolean;
}

interface EditorPanelProps {
  file: VideoFile;
}

const STRATEGIES = [
  { id: 'IG1', label: 'Юмор', desc: 'Focus + Vignette', icon: <Wand2 size={18} /> },
  { id: 'IG2', label: 'POV', desc: 'Dynamic + Saturation', icon: <Zap size={18} /> },
  { id: 'IG3', label: 'Кликбейт', desc: 'High Contrast', icon: <Activity size={18} /> },
  { id: 'IG4', label: 'ASMR', desc: 'Cinema + Grain', icon: <Layers size={18} /> },
] as const;

export const EditorPanel = ({ file }: EditorPanelProps): JSX.Element => {
  const [settings, setSettings] = useState<EditorSettings>({
    strategy: 'IG1',
    volume: 0,
    speed: 1.0,
    saturation: 1.0,
    vignette: false,
    captions: false,
  });

  return (
    <div className="flex flex-col h-full bg-black/90 relative border-l border-white/5">
      {/* Фон (шум) */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      {/* Header */}
      <div className="z-10 p-6 pb-2 shrink-0">
        <div className="flex justify-between items-start">
          <div className="overflow-hidden">
            <h2 className="text-xl font-bold text-foreground truncate" title={file.name}>
              {file.name}
            </h2>
            <div className="flex gap-2 mt-2">
              <Chip size="sm" variant="flat" color="default" className="text-xs">1080p</Chip>
              <Chip size="sm" variant="flat" color="warning" className="text-xs">MP4</Chip>
            </div>
          </div>
          <Button isIconOnly color="primary" variant="shadow" size="sm" radius="full">
            <Play size={16} fill="currentColor" />
          </Button>
        </div>
      </div>

      {/* Manual Divider (вместо компонента Divider) */}
      <div className="w-full h-px bg-white/10 my-4" />

      {/* Main Content */}
      <ScrollShadow className="flex-1 px-6 z-10 space-y-8 pb-24">

        {/* Strategy Selector */}
        <div>
          <label className="text-xs text-default-500 font-bold uppercase tracking-wider mb-3 block">
            Стратегия обработки
          </label>
          <Tabs
            aria-label="Strategies"
            color="primary"
            variant="underlined"
            selectedKey={settings.strategy}
            onSelectionChange={(key) => setSettings(s => ({...s, strategy: key as StrategyType}))}
            fullWidth
            classNames={{
              tabList: "gap-6 w-full relative rounded-none p-0 border-b border-white/10",
              cursor: "w-full bg-primary",
              tab: "max-w-fit px-0 h-12",
              tabContent: "group-data-[selected=true]:text-primary"
            }}
          >
            {STRATEGIES.map((strat) => (
              <Tab
                key={strat.id}
                title={
                  <div className="flex items-center gap-2">
                    {strat.icon}
                    <span>{strat.id}</span>
                  </div>
                }
              />
            ))}
          </Tabs>

          <Card className="mt-4 bg-default-100/10 border border-white/5 shadow-sm">
            {/* Manual CardBody (вместо компонента) */}
            <div className="p-4">
              <p className="text-sm font-medium text-foreground">
                {STRATEGIES.find(s => s.id === settings.strategy)?.label}
              </p>
              <p className="text-xs text-default-400 mt-1">
                {STRATEGIES.find(s => s.id === settings.strategy)?.desc}
              </p>
            </div>
          </Card>
        </div>

        {/* Sliders Section */}
        <div className="space-y-6">
          <Slider
            label="Скорость (Speed)"
            size="sm"
            step={0.1}
            maxValue={2.0}
            minValue={0.5}
            defaultValue={1.0}
            value={settings.speed}
            onChange={(v) => setSettings({...settings, speed: v as number})}
            showSteps={true}
            color="secondary"
            classNames={{
              label: "text-xs font-medium text-default-600",
              value: "text-xs font-bold text-default-600",
              track: "bg-default-500/20",
            }}
          />

          <Slider
            label="Насыщенность (Saturation)"
            size="sm"
            step={0.1}
            maxValue={2.0}
            minValue={0.0}
            defaultValue={1.0}
            value={settings.saturation}
            onChange={(v) => setSettings({...settings, saturation: v as number})}
            color="warning"
            classNames={{
              label: "text-xs font-medium text-default-600",
              value: "text-xs font-bold text-default-600",
              track: "bg-default-500/20",
            }}
          />
        </div>

        {/* Toggles Section */}
        <div className="space-y-4">
          <Switch
            isSelected={settings.vignette}
            onValueChange={(v) => setSettings({...settings, vignette: v})}
            classNames={{
              wrapper: "group-data-[selected=true]:bg-primary",
            }}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">Виньетка</span>
              <span className="text-xs text-default-500">Затемнение углов</span>
            </div>
          </Switch>

          <Switch
            isSelected={settings.captions}
            onValueChange={(v) => setSettings({...settings, captions: v})}
            color="success"
            classNames={{
              wrapper: "group-data-[selected=true]:bg-success",
            }}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">AI Субтитры</span>
              <span className="text-xs text-default-500">Генерация через Whisper</span>
            </div>
          </Switch>
        </div>

      </ScrollShadow>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md absolute bottom-0 left-0 right-0 z-20">
        <Button
          fullWidth
          color="success"
          variant="shadow"
          size="lg"
          startContent={<Save size={20} />}
          className="font-bold text-black"
          onPress={() => console.log('Exporting settings:', settings)}
        >
          ПРИМЕНИТЬ
        </Button>
      </div>
    </div>
  );
};
