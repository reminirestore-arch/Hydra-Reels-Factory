import { Button, ScrollShadow, Slider, Label } from '@heroui/react'
import type { Dispatch, SetStateAction } from 'react'
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
  setOverlaySettings: Dispatch<SetStateAction<OverlaySettings>>
  profileSettings: StrategyProfileSettings
  setProfileSettings: Dispatch<SetStateAction<StrategyProfileSettings>>
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

  // Вспомогательная функция, строго следующая анатомии HeroUI v3
  // Label и Output должны быть прямыми детьми Slider
  const renderSlider = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
    step: number,
    color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default' = 'primary'
  ) => (
    <Slider
      label={label} // Используем проп label для надежности, если компонент Label внутри не рендерится
      step={step}
      maxValue={max}
      minValue={min}
      value={value}
      onChange={(v) => onChange(v as number)}
      className="w-full"
      color={color}
      // Передаем label как children, следуя документации
    >
      <Label className="text-xs font-medium text-default-600">{label}</Label>
      <Slider.Output className="text-xs font-bold text-default-600" />
      <Slider.Track className="bg-default-500/20">
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  )

  const alignOptions = ['left', 'center', 'right'] as const

  return (
    <aside className="w-96 border-l border-white/10 bg-black/60">
      <ScrollShadow className="h-full p-6 space-y-6">
        {/* Timing */}
        <div className="space-y-4">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Тайминг текста
          </div>
          {renderSlider(
            'Старт (сек)',
            overlaySettings.timing.startTime,
            (v) =>
              setOverlaySettings((p) => ({ ...p, timing: { ...p.timing, startTime: v } })),
            0,
            15,
            0.5,
            'primary'
          )}
          {renderSlider(
            'Длительность (сек)',
            overlaySettings.timing.duration,
            (v) => setOverlaySettings((p) => ({ ...p, timing: { ...p.timing, duration: v } })),
            1,
            15,
            0.5,
            'secondary'
          )}
        </div>

        {/* Text */}
        <div className="space-y-4">
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

          {renderSlider(
            'Размер',
            overlaySettings.text.fontSize,
            (v) => setOverlaySettings((p) => ({ ...p, text: { ...p.text, fontSize: v } })),
            18,
            96,
            2,
            'warning'
          )}

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Цвет</span>
            <input
              type="color"
              value={overlaySettings.text.color}
              onChange={(e) =>
                setOverlaySettings((p) => ({
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
              {alignOptions.map((align) => (
                <Button
                  key={align}
                  size="sm"
                  variant={overlaySettings.text.align === align ? 'solid' : 'flat'}
                  onPress={() => {
                    setOverlaySettings((p) => ({ ...p, text: { ...p.text, align } }))
                    onAlignText(align)
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
        <div className="space-y-4">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Подложка
          </div>
          {renderSlider(
            'Ширина',
            overlaySettings.background.width,
            (v) =>
              setOverlaySettings((p) => ({ ...p, background: { ...p.background, width: v } })),
            120,
            600,
            10,
            'primary'
          )}
          {renderSlider(
            'Высота',
            overlaySettings.background.height,
            (v) =>
              setOverlaySettings((p) => ({
                ...p,
                background: { ...p.background, height: v }
              })),
            60,
            300,
            10,
            'secondary'
          )}
          {renderSlider(
            'Скругление',
            overlaySettings.background.radius,
            (v) =>
              setOverlaySettings((p) => ({
                ...p,
                background: { ...p.background, radius: v }
              })),
            0,
            80,
            2,
            'primary'
          )}
          {renderSlider(
            'Прозрачность',
            overlaySettings.background.opacity,
            (v) =>
              setOverlaySettings((p) => ({
                ...p,
                background: { ...p.background, opacity: v }
              })),
            0,
            1,
            0.05,
            'warning'
          )}

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Цвет</span>
            <input
              type="color"
              value={overlaySettings.background.color}
              onChange={(e) =>
                setOverlaySettings((p) => ({
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
        <div className="space-y-4">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Параметры профиля
          </div>
          {renderSlider(
            profileConfig.label,
            profileSettings[profileConfig.key] as number,
            (v) => setProfileSettings((p) => ({ ...p, [profileConfig.key]: v })),
            profileConfig.min,
            profileConfig.max,
            profileConfig.step,
            'success'
          )}
        </div>
      </ScrollShadow>
    </aside>
  )
}
