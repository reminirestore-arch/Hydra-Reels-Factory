/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { Button } from '@heroui/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart
} from 'lucide-react'
import type { JSX } from 'react'

type HorizontalAlign = 'left' | 'center' | 'right'
type VerticalAlign = 'top' | 'center' | 'bottom'

interface TextBlockAlignmentProps {
  horizontal: HorizontalAlign
  vertical?: VerticalAlign
  onHorizontalChange: (align: HorizontalAlign) => void
  onVerticalChange: (align: VerticalAlign) => void
  horizontalLabels?: {
    left?: string
    center?: string
    right?: string
  }
  verticalLabels?: {
    top?: string
    center?: string
    bottom?: string
  }
}

export const TextBlockAlignment = ({
  horizontal,
  vertical,
  onHorizontalChange,
  onVerticalChange,
  horizontalLabels = {
    left: 'Блок у левого края',
    center: 'Блок по центру',
    right: 'Блок у правого края'
  },
  verticalLabels = {
    top: 'Блок у верхнего края',
    center: 'Блок по центру',
    bottom: 'Блок у нижнего края'
  }
}: TextBlockAlignmentProps): JSX.Element => {
  const horizontalOptions: HorizontalAlign[] = ['left', 'center', 'right']
  const verticalOptions: VerticalAlign[] = ['top', 'center', 'bottom']

  return (
    <div className="space-y-3">
      {/* Горизонтальное выравнивание */}
      <div className="flex items-center justify-between text-xs text-default-600">
        <span className="font-medium">По горизонтали</span>
        <div className="flex gap-1">
          {horizontalOptions.map((align) => (
            <Button
              key={align}
              isIconOnly={true}
              size="sm"
              variant={horizontal === align ? 'primary' : 'ghost'}
              onPress={() => onHorizontalChange(align)}
              className="min-w-9"
              title={horizontalLabels[align]}
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

      {/* Вертикальное выравнивание */}
      <div className="flex items-center justify-between text-xs text-default-600">
        <span className="font-medium">По вертикали</span>
        <div className="flex gap-1">
          {verticalOptions.map((align) => (
            <Button
              key={align}
              size="sm"
              variant={vertical === align ? 'primary' : 'ghost'}
              onPress={() => onVerticalChange(align)}
              title={verticalLabels[align]}
              {...({
                children:
                  align === 'top' ? (
                    <AlignVerticalJustifyStart size={14} />
                  ) : align === 'center' ? (
                    <AlignVerticalJustifyCenter size={14} />
                  ) : (
                    <AlignVerticalJustifyEnd size={14} />
                  )
              } as any)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
