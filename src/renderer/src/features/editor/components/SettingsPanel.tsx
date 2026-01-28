/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { Button, ScrollShadow, Label } from '@heroui/react'
import type { Dispatch, JSX, SetStateAction } from 'react'
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'
import { SettingsSlider } from './SettingsSlider'
import { AlignmentButtons } from './AlignmentButtons'
import { TextBlockAlignment } from './TextBlockAlignment'
import { getProfileConfigs } from './profileConfigs'

interface SettingsPanelProps {
  overlaySettings: OverlaySettings
  setOverlaySettings: Dispatch<SetStateAction<OverlaySettings>>
  profileSettings: StrategyProfileSettings
  setProfileSettings: Dispatch<SetStateAction<StrategyProfileSettings>>
  textValue: string
  setTextValue: (v: string) => void
  strategyId: StrategyType
  onAlignTextBlock: (options: {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'center' | 'bottom'
  }) => void
  currentVerticalAlign?: 'top' | 'center' | 'bottom'
  onCenterText: () => void
  onCenterBackground: (axis: 'horizontal' | 'vertical') => void
  updateCanvasText: (val: string) => void
  onTestFadeOut?: () => void
}

// Хелперы для обновления состояния
const updateTiming = (
  setOverlaySettings: Dispatch<SetStateAction<OverlaySettings>>,
  field: 'startTime' | 'duration' | 'fadeOutDuration',
  value: number
): void => {
  setOverlaySettings((p) => ({ ...p, timing: { ...p.timing, [field]: value } }))
}

const updateText = (
  setOverlaySettings: Dispatch<SetStateAction<OverlaySettings>>,
  field: keyof OverlaySettings['text'],
  value: unknown
): void => {
  setOverlaySettings((p) => ({ ...p, text: { ...p.text, [field]: value } }))
}

const updateBackground = (
  setOverlaySettings: Dispatch<SetStateAction<OverlaySettings>>,
  field: keyof OverlaySettings['background'],
  value: unknown
): void => {
  setOverlaySettings((p) => ({ ...p, background: { ...p.background, [field]: value } }))
}

export const SettingsPanel = ({
  overlaySettings,
  setOverlaySettings,
  profileSettings,
  setProfileSettings,
  textValue,
  setTextValue,
  strategyId,
  onAlignTextBlock,
  currentVerticalAlign,
  onCenterText,
  onCenterBackground,
  updateCanvasText,
  onTestFadeOut
}: SettingsPanelProps): JSX.Element => {
  const profileConfigs = getProfileConfigs(strategyId)

  return (
    <aside className="w-96 border-l border-white/10 bg-black/60">
      <ScrollShadow className="h-full p-6 space-y-6">
        {/* Timing */}
        <div className="space-y-4">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Тайминг текста
          </div>
          <SettingsSlider
            label="Старт (сек)"
            value={overlaySettings.timing.startTime}
            onChange={(v) => updateTiming(setOverlaySettings, 'startTime', v)}
            min={0}
            max={15}
            step={0.5}
            color="primary"
          />
          <SettingsSlider
            label="Длительность (сек)"
            value={overlaySettings.timing.duration}
            onChange={(v) => updateTiming(setOverlaySettings, 'duration', v)}
            min={1}
            max={15}
            step={0.5}
            color="secondary"
          />
          <SettingsSlider
            label="Скорость исчезновения (мс)"
            value={overlaySettings.timing.fadeOutDuration ?? 500}
            onChange={(v) => updateTiming(setOverlaySettings, 'fadeOutDuration', v)}
            min={0}
            max={3000}
            step={50}
            color="warning"
            description="Длительность плавного исчезновения объекта в миллисекундах"
          />
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

          <SettingsSlider
            label="Размер"
            value={overlaySettings.text.fontSize}
            onChange={(v) => updateText(setOverlaySettings, 'fontSize', v)}
            min={18}
            max={96}
            step={2}
            color="warning"
          />

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Цвет</span>
            <input
              type="color"
              value={overlaySettings.text.color}
              onChange={(e) => updateText(setOverlaySettings, 'color', e.target.value)}
              className="h-8 w-16 rounded border border-white/10 bg-transparent"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Насыщенность</span>
            <select
              value={overlaySettings.text.fontWeight?.toString() ?? 'bold'}
              onChange={(e) => {
                const fontWeight =
                  e.target.value === 'normal'
                    ? 'normal'
                    : e.target.value === 'bold'
                      ? 'bold'
                      : parseInt(e.target.value, 10) || 'bold'
                updateText(setOverlaySettings, 'fontWeight', fontWeight)
              }}
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

          {/* Позиция блока на подложке */}
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-default-400">Позиция блока на подложке</div>
            <p className="text-[10px] text-default-500">
              Где находится весь текстовый блок относительно подложки.
            </p>
            <TextBlockAlignment
              horizontal={overlaySettings.text.align}
              vertical={overlaySettings.text.verticalAlign ?? currentVerticalAlign ?? 'center'}
              onHorizontalChange={(align) => {
                updateText(setOverlaySettings, 'align', align)
                onAlignTextBlock({ horizontal: align })
              }}
              onVerticalChange={(align) => {
                updateText(setOverlaySettings, 'verticalAlign', align)
                onAlignTextBlock({ vertical: align })
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onPress={onCenterText}
              className="w-full"
              {...({ children: 'Центрировать блок внутри подложки' } as any)}
            />
          </div>

          {/* Выравнивание содержимого внутри блока */}
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-default-400">Выравнивание содержимого</div>
            <p className="text-[10px] text-default-500">
              Как выравниваются строки текста внутри блока.
            </p>
            <div className="flex items-center justify-between text-xs text-default-600">
              <span className="font-medium">Содержимое</span>
              <AlignmentButtons
                value={overlaySettings.text.contentAlign ?? 'center'}
                onChange={(align) => updateText(setOverlaySettings, 'contentAlign', align)}
                labels={{
                  left: 'Строки влево',
                  center: 'Строки по центру',
                  right: 'Строки вправо'
                }}
              />
            </div>
          </div>
        </div>

        {/* Background */}
        <div className="space-y-4">
          <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
            Подложка
          </div>
          <SettingsSlider
            label="Ширина"
            value={overlaySettings.background.width}
            onChange={(v) => updateBackground(setOverlaySettings, 'width', v)}
            min={120}
            max={600}
            step={10}
            color="primary"
          />
          <SettingsSlider
            label="Высота"
            value={overlaySettings.background.height}
            onChange={(v) => updateBackground(setOverlaySettings, 'height', v)}
            min={60}
            max={300}
            step={10}
            color="secondary"
          />
          <SettingsSlider
            label="Скругление"
            value={overlaySettings.background.radius}
            onChange={(v) => updateBackground(setOverlaySettings, 'radius', v)}
            min={0}
            max={80}
            step={2}
            color="primary"
          />
          <SettingsSlider
            label="Прозрачность"
            value={overlaySettings.background.opacity}
            onChange={(v) => updateBackground(setOverlaySettings, 'opacity', v)}
            min={0}
            max={1}
            step={0.05}
            color="warning"
          />

          <div className="flex items-center justify-between text-xs text-default-600">
            <span className="font-medium">Цвет</span>
            <input
              type="color"
              value={overlaySettings.background.color}
              onChange={(e) => updateBackground(setOverlaySettings, 'color', e.target.value)}
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
              {profileConfigs.map((config) => (
                <SettingsSlider
                  key={config.key}
                  label={config.label}
                  value={profileSettings[config.key] as number}
                  onChange={(v) => setProfileSettings((p) => ({ ...p, [config.key]: v }))}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  color={config.color}
                  description={config.description}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-default-500">Нет доступных параметров</p>
          )}
        </div>
      </ScrollShadow>
    </aside>
  )
}
