/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { Accordion, Button, Label } from '@heroui/react'
import { ChevronDown } from 'lucide-react'
import type { Dispatch, JSX, SetStateAction } from 'react'
import { OverlaySettings, StrategyProfileSettings, StrategyType } from '@shared/types'
import {
  clampTiming,
  durationMax,
  D_MIN,
  startTimeMax
} from '@shared/domain/overlayTiming'
import { SettingsSlider } from './SettingsSlider'
import { AlignmentButtons } from './AlignmentButtons'
import { TextBlockAlignment } from './TextBlockAlignment'
import { getProfileConfigs } from './profileConfigs'
import { useSettingsPanelStore } from '@features/editor/model/settingsPanelStore'

interface SettingsPanelProps {
  hasElementSelected?: boolean
  videoDuration?: number
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
  onTestFadeIn?: () => void
}

// Хелперы для обновления состояния
const updateTiming = (
  setOverlaySettings: Dispatch<SetStateAction<OverlaySettings>>,
  field: 'startTime' | 'duration' | 'fadeOutDuration' | 'fadeInDuration',
  value: number
): void => {
  setOverlaySettings((p) => ({ ...p, timing: { ...p.timing, [field]: value } }))
}

/**
 * Updates start/duration with compression rule.
 * Pass only the field that changed; the other is taken from previous state (p)
 * so the display stays in sync and we avoid stale closure issues during drag.
 */
const updateTimingWithClamp = (
  setOverlaySettings: Dispatch<SetStateAction<OverlaySettings>>,
  videoDuration: number | undefined,
  update: { startTime?: number; duration?: number }
): void => {
  setOverlaySettings((p) => {
    const startTime = update.startTime ?? p.timing.startTime
    const duration = update.duration ?? p.timing.duration
    const next = clampTiming(videoDuration, { startTime, duration })
    return { ...p, timing: { ...p.timing, ...next } }
  })
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
  hasElementSelected = false,
  videoDuration,
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
  onTestFadeOut,
  onTestFadeIn
}: SettingsPanelProps): JSX.Element => {
  const profileConfigs = getProfileConfigs(strategyId)
  const expandedKeys = useSettingsPanelStore((s) => s.settingsAccordionExpandedKeys)
  const setSettingsAccordionExpandedKeys = useSettingsPanelStore(
    (s) => s.actions.setSettingsAccordionExpandedKeys
  )

  return (
    <div className="w-full max-w-full overflow-x-hidden p-4">
      <Accordion
        allowsMultipleExpanded
        className="w-full max-w-full"
        expandedKeys={expandedKeys}
        onExpandedChange={(keys) =>
          setSettingsAccordionExpandedKeys(new Set([...keys].map(String)))
        }
      >
        {/* 1. Слой (Layer Properties) — только при выбранном элементе */}
        <Accordion.Item id="layer">
          <Accordion.Heading>
            <Accordion.Trigger>
              Слой
              <Accordion.Indicator>
                <ChevronDown size={16} />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="space-y-4">
              {hasElementSelected ? (
                <>
                  {/* Timing */}
                  <div className="space-y-3">
                    <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
                      Тайминг текста
                    </div>
                    <div className="max-w-full space-y-2">
                      <SettingsSlider
                        label="Старт (сек)"
                        value={overlaySettings.timing.startTime}
                        onChange={(v) =>
                          updateTimingWithClamp(setOverlaySettings, videoDuration, {
                            startTime: v
                          })
                        }
                        min={0}
                        max={startTimeMax(videoDuration)}
                        step={0.5}
                        color="primary"
                      />
                      <SettingsSlider
                        label="Длительность (сек)"
                        value={overlaySettings.timing.duration}
                        onChange={(v) =>
                          updateTimingWithClamp(setOverlaySettings, videoDuration, {
                            duration: v
                          })
                        }
                        min={D_MIN}
                        max={durationMax(videoDuration, overlaySettings.timing.startTime)}
                        step={0.5}
                        color="secondary"
                        description="Длительность показа overlay от момента Старт до конца (относительно Старт)"
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
                      <SettingsSlider
                        label="Скорость появления (мс)"
                        value={overlaySettings.timing.fadeInDuration ?? 500}
                        onChange={(v) => updateTiming(setOverlaySettings, 'fadeInDuration', v)}
                        min={0}
                        max={3000}
                        step={50}
                        color="success"
                        description="Длительность плавного появления объекта в миллисекундах"
                      />
                      <div className="flex gap-2">
                        {onTestFadeOut && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={onTestFadeOut}
                            className="flex-1"
                            {...({
                              children: 'Протестировать исчезновение'
                            } as any)}
                          />
                        )}
                        {onTestFadeIn && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={onTestFadeIn}
                            className="flex-1"
                            {...({
                              children: 'Протестировать появление'
                            } as any)}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Text */}
                  <div className="space-y-3">
                    <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
                      Текст
                    </div>
                    <div className="space-y-2 max-w-full">
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
                        className="h-9 w-full max-w-full rounded border border-white/10 bg-black/40 px-3 text-sm text-default-200 focus:border-primary/60 focus:outline-none"
                      />
                      <SettingsSlider
                        label="Размер"
                        value={overlaySettings.text.fontSize}
                        onChange={(v) => updateText(setOverlaySettings, 'fontSize', v)}
                        min={18}
                        max={96}
                        step={2}
                        color="warning"
                      />
                      <div className="flex items-center justify-between gap-2 text-xs text-default-600 max-w-full">
                        <span className="font-medium shrink-0">Цвет</span>
                        <input
                          type="color"
                          value={overlaySettings.text.color}
                          onChange={(e) => updateText(setOverlaySettings, 'color', e.target.value)}
                          className="h-8 w-16 rounded border border-white/10 bg-transparent shrink-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-default-600 max-w-full">
                        <span className="font-medium shrink-0">Насыщенность</span>
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
                          className="h-9 min-w-0 max-w-full flex-1 rounded border border-white/10 bg-black/40 px-3 text-sm text-default-200 focus:border-primary/60 focus:outline-none"
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

                      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 max-w-full">
                        <div className="text-xs font-semibold text-default-400">
                          Выравнивание текста на подложке
                        </div>
                        <TextBlockAlignment
                          horizontal={overlaySettings.text.align}
                          vertical={
                            overlaySettings.text.verticalAlign ?? currentVerticalAlign ?? 'center'
                          }
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
                          variant="outline"
                          onPress={onCenterText}
                          className="w-full max-w-full bg-accent-soft"
                          {...({ children: 'По центру' } as any)}
                        />
                      </div>

                      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 max-w-full">
                        <div className="text-xs font-semibold text-default-400">
                          Выравнивание содержимого
                        </div>
                        <p className="text-[10px] text-default-500">
                          Как выравниваются строки текста внутри блока.
                        </p>
                        <div className="flex items-center justify-between gap-2 text-xs text-default-600 max-w-full">
                          <span className="font-medium shrink-0">Содержимое</span>
                          <AlignmentButtons
                            value={overlaySettings.text.contentAlign ?? 'center'}
                            onChange={(align) =>
                              updateText(setOverlaySettings, 'contentAlign', align)
                            }
                            labels={{
                              left: 'Строки влево',
                              center: 'Строки по центру',
                              right: 'Строки вправо'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Background (подложка) */}
                  <div className="space-y-3">
                    <div className="text-xs text-default-500 font-bold uppercase tracking-wider">
                      Подложка
                    </div>
                    <div className="max-w-full space-y-2">
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
                      <div className="flex items-center justify-between gap-2 text-xs text-default-600 max-w-full">
                        <span className="font-medium shrink-0">Цвет</span>
                        <input
                          type="color"
                          value={overlaySettings.background.color}
                          onChange={(e) =>
                            updateBackground(setOverlaySettings, 'color', e.target.value)
                          }
                          className="h-8 w-16 rounded border border-white/10 bg-transparent shrink-0"
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
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
                  </div>
                </>
              ) : (
                <p className="text-xs text-default-500 py-2">
                  Выберите элемент на канвасе, чтобы редактировать свойства слоя.
                </p>
              )}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>

        {/* 3. Эффекты профиля (Strategy Effects) — всегда */}
        <Accordion.Item id="profile-effects">
          <Accordion.Heading>
            <Accordion.Trigger>
              Эффекты профиля
              <Accordion.Indicator>
                <ChevronDown size={16} />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-default-500 font-bold uppercase tracking-wider">
                  Параметры профиля
                </span>
                <span className="text-[10px] text-default-600 px-2 py-1 rounded bg-default-100/10 shrink-0">
                  {strategyId}
                </span>
              </div>
              {profileConfigs.length > 0 ? (
                <div className="space-y-4 max-w-full">
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
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  )
}
