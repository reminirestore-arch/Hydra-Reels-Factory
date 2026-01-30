/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { Button } from '@heroui/react'
import { MonitorPlay, Save } from 'lucide-react'
import { JSX } from 'react'

interface EditorToolbarProps {
  onSave: () => void
}

export const EditorToolbar = ({ onSave }: EditorToolbarProps): JSX.Element => {
  return (
    <div className="h-16 bg-black/50 border-b border-white/10 flex items-center justify-between px-6 shrink-0 backdrop-blur-md">
      <div className="text-default-500 text-xs font-mono flex items-center gap-2">
        <MonitorPlay size={14} />
        9:16 • 1080p Preview
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onPress={onSave}
          className="font-medium bg-success text-black"
          {...({
            children: (
              <>
                <Save size={16} />
                Сохранить
              </>
            )
          } as any)}
        />
      </div>
    </div>
  )
}
