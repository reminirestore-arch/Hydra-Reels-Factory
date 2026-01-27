/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { Button, ScrollShadow, Slider, Label } from '@heroui/react'
import type { Dispatch, JSX, SetStateAction } from 'react'
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
  onTestFadeOut?: () => void
}

// Slider configuration type
type SliderConfig = {
  key: keyof StrategyProfileSettings
  label: string
  min: number
  max: number
  step: number
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default'
  description?: string
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
  updateCanvasText,
  onTestFadeOut
}: SettingsPanelProps): JSX.Element => {
  // Вспомогательная функция для рендеринга слайдера
  const renderSlider = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
    step: number,
    color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default' = 'primary',
    description?: string
  ): JSX.Element => (
    <div className="space-y-1">
      <Slider
        label={label}
        step={step}
        maxValue={max}
        minValue={min}
        value={value}
        onChange={(v) => onChange(v as number)}
        className="w-full"
        color={color}
        {...({
          children: (
            <>
              <Label
                {...({
                  children: label,
                  className: 'text-xs font-medium text-default-600'
                } as any)}
              />
              <Slider.Output {...({ className: 'text-xs font-bold text-default-600' } as any)} />
              <Slider.Track
                {...({
                  className: 'bg-default-500/20',
                  children: [<Slider.Fill key="fill" />, <Slider.Thumb key="thumb" />]
                } as any)}
              />
            </>
          )
        } as any)}
      />
      {description && (
        <p className="text-[10px] text-default-500 px-1">{description}</p>
      )}
    </div>
  )

  // Получить конфигурацию параметров профиля в зависимости от стратегии
  const getProfileConfigs = (): SliderConfig[] => {
    switch (strategyId) {
      case 'IG1':
        return [
          {
            key: 'focusStrength',
            label: 'Сила фокуса',
            min: 0,
            max: 1,
            step: 0.05,
            color: 'primary',
            description: 'Увеличивает кроп для эффекта зума'
          },
          {
            key: 'vignetteIntensity',
            label: 'Интенсивность виньетки',
            min: 0,
            max: 1,
            step: 0.05,
            color: 'secondary',
            description: 'Затемнение по краям кадра'
          },
          {
            key: 'contrast',
            label: 'Контраст',
            min: 0.8,
            max: 1.5,
            step: 0.05,
            color: 'success',
            description: 'Общий контраст изображения'
          }
        ]
      case 'IG2':
        return [
          {
            key: 'motionSpeed',
            label: 'Скорость движения',
            min: 0.8,
            max: 1.3,
            step: 0.01,
            color: 'primary',
            description: 'Скорость воспроизведения (1.0 = нормальная)'
          },
          {
            key: 'saturation',
            label: 'Насыщенность',
            min: 0.8,
            max: 1.5,
            step: 0.05,
            color: 'secondary',
            description: 'Интенсивность цветов'
          },
          {
            key: 'contrast',
            label: 'Контраст',
            min: 0.8,
            max: 1.5,
            step: 0.05,
            color: 'success',
            description: 'Общий контраст изображения'
          }
        ]
      case 'IG3':
        return [
          {
            key: 'contrast',
            label: 'Контраст',
            min: 0.8,
            max: 1.5,
            step: 0.05,
            color: 'primary',
            description: 'Интенсивность контраста'
          },
          {
            key: 'sharpness',
            label: 'Резкость',
            min: 0,
            max: 2.0,
            step: 0.1,
            color: 'secondary',
            description: 'Интенсивность резкости'
          },
          {
            key: 'fadeInDuration',
            label: 'Fade In (сек)',
            min: 0.1,
            max: 1.0,
            step: 0.05,
            color: 'warning',
            description: 'Длительность плавного появления в начале'
          },
          {
            key: 'fadeOutDuration',
            label: 'Fade Out (сек)',
            min: 0.1,
            max: 1.0,
            step: 0.05,
            color: 'warning',
            description: 'Длительность плавного исчезновения в конце'
          }
        ]
      case 'IG4':
        return [
          {
            key: 'grain',
            label: 'Зерно',
            min: 0,
            max: 1,
            step: 0.05,
            color: 'primary',
            description: 'Интенсивность зерна/шума'
          },
          {
            key: 'rotationAngle',
            label: 'Угол поворота (°)',
            min: -2.0,
            max: 2.0,
            step: 0.1,
            color: 'secondary',
            description: 'Небольшой наклон кадра'
          },
          {
            key: 'fadeInDuration',
            label: 'Fade In (сек)',
            min: 0.1,
            max: 1.0,
            step: 0.05,
            color: 'warning',
            description: 'Длительность плавного появления в начале'
          },
          {
            key: 'fadeOutDuration',
            label: 'Fade Out (сек)',
            min: 0.1,
            max: 1.0,
            step: 0.05,
            color: 'warning',
            description: 'Длительность плавного исчезновения в конце'
          }
        ]
      default:
        return []
    }
  }

  const profileConfigs = getProfileConfigs()
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
            (v) => setOverlaySettings((p) => ({ ...p, timing: { ...p.timing, startTime: v } })),
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
          {renderSlider(
            'Скорость исчезновения (мс)',
            overlaySettings.timing.fadeOutDuration ?? 500,
            (v) => setOverlaySettings((p) => ({ ...p, timing: { ...p.timing, fadeOutDuration: v } })),
            0,
            3000,
            50,
            'warning',
            'Длительность плавного исчезновения объекта в миллисекундах'
          )}
          {onTestFadeOut && (
            <Button
              size="sm"
              variant="ghost"
              onPress={onTestFadeOut}
              className="w-full"
              {...({
                children: 'Протестировать исчезновение'
              } as any)}
            />
          )}
        </div>

        {/* Text */}
        <div className="space-y-4">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">Текст</div>
          <div className="space-y-2">
            <Label
              {...({
                children: 'Содержание',
                className: 'text-xs font-medium text-default-600'
              } as any)}
            />
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
            <span className="font-medium">Насыщенность</span>
            <select
              value={overlaySettings.text.fontWeight?.toString() ?? 'bold'}
              onChange={(e) =>
                setOverlaySettings((p) => ({
                  ...p,
                  text: {
                    ...p.text,
                    fontWeight: e.target.value === 'normal' ? 'normal' : e.target.value === 'bold' ? 'bold' : parseInt(e.target.value, 10) || 'bold'
                  }
                }))
              }
              className="h-9 rounded border border-white/10 bg-black/40 px-3 text-sm text-default-200 focus:border-primary/60 focus:outline-none"
            >
              <option value="normal">Обычный</option>
              <option value="400">400</option>
              <option value="500">500</option>
              <option value="600">600</option>
              <option value="bold">Жирный</option>
              <option value="700">700</option>
              <option value="800">800</option>
              <option value="900">900</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Выравнивание</span>
            <div className="flex gap-1">
              {alignOptions.map((align) => (
                <Button
                  key={align}
                  size="sm"
                  variant={overlaySettings.text.align === align ? 'primary' : 'ghost'}
                  onPress={() => {
                    setOverlaySettings((p) => ({ ...p, text: { ...p.text, align } }))
                    onAlignText(align)
                  }}
                  className="min-w-9"
                  {...({
                    children:
                      align === 'left' ? (
                        <AlignLeft size={14} />
                      ) : align === 'center' ? (
                        <AlignCenter size={14} />
                      ) : (
                        <AlignRight size={14} />
                      )
                  } as any)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Вертикаль</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onPress={() => onAlignVertical('top')}
                {...({ children: <AlignVerticalJustifyStart size={14} /> } as any)}
              />
              <Button
                size="sm"
                variant="ghost"
                onPress={() => onAlignVertical('center')}
                {...({ children: <AlignVerticalJustifyCenter size={14} /> } as any)}
              />
              <Button
                size="sm"
                variant="ghost"
                onPress={() => onAlignVertical('bottom')}
                {...({ children: <AlignVerticalJustifyEnd size={14} /> } as any)}
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onPress={onCenterText}
            {...({ children: 'Центрировать внутри подложки' } as any)}
          />
        </div>

        {/* Background */}
        <div className="space-y-4">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Подложка
          </div>
          {renderSlider(
            'Ширина',
            overlaySettings.background.width,
            (v) => setOverlaySettings((p) => ({ ...p, background: { ...p.background, width: v } })),
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
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onCenterBackground('horizontal')}
              {...({ children: 'Центр по горизонтали' } as any)}
            />
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onCenterBackground('vertical')}
              {...({ children: 'Центр по вертикали' } as any)}
            />
          </div>
        </div>

        {/* Profile Parameters */}
        <div className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
              Параметры профиля
            </div>
            <div className="text-[10px] text-default-600 px-2 py-1 rounded bg-default-100/10">
              {strategyId}
            </div>
          </div>
          
          {profileConfigs.length > 0 ? (
            <div className="space-y-4">
              {profileConfigs.map((config) =>
                renderSlider(
                  config.label,
                  profileSettings[config.key] as number,
                  (v) => setProfileSettings((p) => ({ ...p, [config.key]: v })),
                  config.min,
                  config.max,
                  config.step,
                  config.color,
                  config.description
                )
              )}
            </div>
          ) : (
            <p className="text-xs text-default-500">Нет доступных параметров</p>
          )}
        </div>
      </ScrollShadow>
    </aside>
  )
}
