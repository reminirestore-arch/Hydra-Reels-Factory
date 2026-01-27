/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround for HeroUI components that don't accept children prop in TypeScript definitions
import { Button } from '@heroui/react'
import { MonitorPlay, Save, Type, X } from 'lucide-react'
import { JSX } from 'react'

interface EditorToolbarProps {
  onAddText: () => void
  onSave: () => void
  onClose: () => void
}

export const EditorToolbar = ({ onAddText, onSave, onClose }: EditorToolbarProps): JSX.Element => {
  return (
    <div className="h-16 bg-black/50 border-b border-white/10 flex items-center justify-between px-6 shrink-0 backdrop-blur-md">
      <div className="flex gap-3">
        <Button
          size="sm"
          variant="primary"
          onPress={onAddText}
          className="font-medium shadow-lg shadow-primary/20"
          {...({
            children: (
              <>
                <Type size={16} />
                Добавить текст
              </>
            )
          } as any)}
        />
      </div>

      <div className="text-default-500 text-xs font-mono flex items-center gap-2">
        <MonitorPlay size={14} />
        9:16 • 1080p Preview
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onPress={onClose}
          className="font-medium"
          {...({
            children: (
              <>
                <X size={16} />
                Закрыть
              </>
            )
          } as any)}
        />
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
