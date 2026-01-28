/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { Slider, Label } from '@heroui/react'
import type { JSX } from 'react'

interface SettingsSliderProps {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default'
  description?: string
}

export const SettingsSlider = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  color = 'primary',
  description
}: SettingsSliderProps): JSX.Element => (
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
                className: 'h-2 rounded-full bg-surface-secondary',
                children: [<Slider.Fill key="fill" />, <Slider.Thumb key="thumb" />]
              } as any)}
            >
              <Slider.Fill className="bg-accent" />
              <Slider.Thumb className="size-4 rounded-full bg-accent" />
            </Slider.Track>
          </>
        )
      } as any)}
    />
    {description && <p className="text-[10px] text-default-500 px-1">{description}</p>}
  </div>
)
