import { Button, ScrollShadow, Slider, Label } from '@heroui/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart
} from 'lucide-react'
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'

interface SettingsPanelProps {
  overlaySettings: OverlaySettings
  setOverlaySettings: (s: any) => void
  profileSettings: StrategyProfileSettings
  setProfileSettings: (s: any) => void
  textValue: string
  setTextValue: (v: string) => void
  strategyId: StrategyType
  onAlignText: (h: 'left' | 'center' | 'right') => void
  onAlignVertical: (v: 'top' | 'center' | 'bottom') => void
  onCenterText: () => void
  onCenterBackground: (axis: 'horizontal' | 'vertical') => void
  updateCanvasText: (val: string) => void
}

export const SettingsPanel = ({
  overlaySettings,
  setOverlaySettings,
  profileSettings,
  setProfileSettings,
  textValue,
  setTextValue,
  strategyId,
  onAlignText,
  onAlignVertical,
  onCenterText,
  onCenterBackground,
  updateCanvasText
}: SettingsPanelProps) => {
  const profileConfig = (() => {
    switch (strategyId) {
      case 'IG1':
        return { key: 'focusStrength', label: 'Сила фокуса', min: 0, max: 1, step: 0.05 }
      case 'IG2':
        return { key: 'motionSpeed', label: 'Динамика', min: 0.8, max: 1.3, step: 0.01 }
      case 'IG3':
        return { key: 'contrast', label: 'Контраст', min: 0.8, max: 1.5, step: 0.05 }
      case 'IG4':
      default:
        return { key: 'grain', label: 'Зерно', min: 0, max: 1, step: 0.05 }
    }
  })()

  return (
    <aside className="w-96 border-l border-white/10 bg-black/60">
      <ScrollShadow className="h-full p-6 space-y-6">
        {/* Timing */}
        <div className="space-y-3">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Тайминг текста
          </div>
          <Slider
            step={0.5}
            maxValue={15}
            minValue={0}
            value={overlaySettings.timing.startTime}
            onChange={(v) =>
              setOverlaySettings((p: any) => ({ ...p, timing: { ...p.timing, startTime: v } }))
            }
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Старт (сек)</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
          </Slider>
          <Slider
            step={0.5}
            maxValue={15}
            minValue={1}
            value={overlaySettings.timing.duration}
            onChange={(v) =>
              setOverlaySettings((p: any) => ({ ...p, timing: { ...p.timing, duration: v } }))
            }
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Длительность (сек)</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
          </Slider>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">Текст</div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-default-600">Содержание</Label>
            <input
              type="text"
              value={textValue}
              onChange={(e) => {
                setTextValue(e.target.value)
                updateCanvasText(e.target.value)
              }}
              className="h-9 w-full rounded border border-white/10 bg-black/40 px-3 text-sm text-default-200 focus:border-primary/60 focus:outline-none"
            />
          </div>

          <Slider
            step={2}
            maxValue={96}
            minValue={18}
            value={overlaySettings.text.fontSize}
            onChange={(v) =>
              setOverlaySettings((p: any) => ({ ...p, text: { ...p.text, fontSize: v } }))
            }
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Размер</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
          </Slider>

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Цвет</span>
            <input
              type="color"
              value={overlaySettings.text.color}
              onChange={(e) =>
                setOverlaySettings((p: any) => ({
                  ...p,
                  text: { ...p.text, color: e.target.value }
                }))
              }
              className="h-8 w-16 rounded border border-white/10 bg-transparent"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Выравнивание</span>
            <div className="flex gap-1">
              {['left', 'center', 'right'].map((align) => (
                <Button
                  key={align}
                  size="sm"
                  variant={overlaySettings.text.align === align ? 'solid' : 'flat'}
                  onPress={() => {
                    setOverlaySettings((p: any) => ({ ...p, text: { ...p.text, align } }))
                    onAlignText(align as any)
                  }}
                  className="min-w-9"
                >
                  {align === 'left' ? (
                    <AlignLeft size={14} />
                  ) : align === 'center' ? (
                    <AlignCenter size={14} />
                  ) : (
                    <AlignRight size={14} />
                  )}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Вертикаль</span>
            <div className="flex gap-1">
              <Button size="sm" variant="flat" onPress={() => onAlignVertical('top')}>
                <AlignVerticalJustifyStart size={14} />
              </Button>
              <Button size="sm" variant="flat" onPress={() => onAlignVertical('center')}>
                <AlignVerticalJustifyCenter size={14} />
              </Button>
              <Button size="sm" variant="flat" onPress={() => onAlignVertical('bottom')}>
                <AlignVerticalJustifyEnd size={14} />
              </Button>
            </div>
          </div>
          <Button size="sm" variant="flat" onPress={onCenterText}>
            Центрировать внутри подложки
          </Button>
        </div>

        {/* Background */}
        <div className="space-y-3">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Подложка
          </div>
          <Slider
            step={10}
            maxValue={600}
            minValue={120}
            value={overlaySettings.background.width}
            onChange={(v) =>
              setOverlaySettings((p: any) => ({ ...p, background: { ...p.background, width: v } }))
            }
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Ширина</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
          </Slider>
          <Slider
            step={10}
            maxValue={300}
            minValue={60}
            value={overlaySettings.background.height}
            onChange={(v) =>
              setOverlaySettings((p: any) => ({ ...p, background: { ...p.background, height: v } }))
            }
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Высота</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
          </Slider>
          <Slider
            step={2}
            maxValue={80}
            minValue={0}
            value={overlaySettings.background.radius}
            onChange={(v) =>
              setOverlaySettings((p: any) => ({ ...p, background: { ...p.background, radius: v } }))
            }
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Скругление</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
          </Slider>
          <Slider
            step={0.05}
            maxValue={1}
            minValue={0}
            value={overlaySettings.background.opacity}
            onChange={(v) =>
              setOverlaySettings((p: any) => ({
                ...p,
                background: { ...p.background, opacity: v }
              }))
            }
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">Прозрачность</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
          </Slider>
          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Цвет</span>
            <input
              type="color"
              value={overlaySettings.background.color}
              onChange={(e) =>
                setOverlaySettings((p: any) => ({
                  ...p,
                  background: { ...p.background, color: e.target.value }
                }))
              }
              className="h-8 w-16 rounded border border-white/10 bg-transparent"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="flat" onPress={() => onCenterBackground('horizontal')}>
              Центр по горизонтали
            </Button>
            <Button size="sm" variant="flat" onPress={() => onCenterBackground('vertical')}>
              Центр по вертикали
            </Button>
          </div>
        </div>

        {/* Profile */}
        <div className="space-y-3">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Параметры профиля
          </div>
          <Slider
            step={profileConfig.step as number}
            maxValue={profileConfig.max as number}
            minValue={profileConfig.min as number}
            value={profileSettings[profileConfig.key] as number}
            onChange={(v) => setProfileSettings((p: any) => ({ ...p, [profileConfig.key]: v }))}
            className="w-full"
          >
            <div className="flex justify-between mb-1">
              <Label className="text-xs font-medium text-default-600">{profileConfig.label}</Label>
              <Slider.Output className="text-xs font-bold text-default-600" />
            </div>
          </Slider>
        </div>
      </ScrollShadow>
    </aside>
  )
}
