/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { Button } from '@heroui/react'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import type { JSX } from 'react'

type HorizontalAlign = 'left' | 'center' | 'right'

interface AlignmentButtonsProps {
  value: HorizontalAlign
  onChange: (align: HorizontalAlign) => void
  labels?: {
    left?: string
    center?: string
    right?: string
  }
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'ghost' | 'flat'
}

export const AlignmentButtons = ({
  value,
  onChange,
  labels = {
    left: 'Блок у левого края',
    center: 'Блок по центру',
    right: 'Блок у правого края'
  },
  size = 'sm',
  variant = 'ghost'
}: AlignmentButtonsProps): JSX.Element => {
  const alignOptions: HorizontalAlign[] = ['left', 'center', 'right']

  return (
    <div className="flex gap-1">
      {alignOptions.map((align) => (
        <Button
          key={align}
          isIconOnly={true} 
          variant={value === align ? 'primary' : variant}
          onPress={() => onChange(align)}
          className={size === 'sm' ? 'min-w-9' : ''}
          title={labels[align]}
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
  )
}
