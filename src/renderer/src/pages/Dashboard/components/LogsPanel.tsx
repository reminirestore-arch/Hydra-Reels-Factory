/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JSX } from 'react'
import { Button, Card, ScrollShadow } from '@heroui/react'
import { useProcessingStore } from '@features/processing/model/processingStore'

export const LogsPanel = (): JSX.Element | null => {
  const { isRendering, logs, actions: processingActions } = useProcessingStore()

  if (!isRendering && logs.length === 0) {
    return null
  }

  return (
    <Card className="mt-4">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-default-500">FFmpeg logs</div>
          <Button
            size="sm"
            variant="light"
            onPress={() => processingActions.clearLogs()}
            {...({ children: 'Очистить' } as any)}
          />
        </div>

        <ScrollShadow className="max-h-56 text-[11px] font-mono whitespace-pre-wrap">
          {logs.slice(-200).map((e, i) => (
            <div key={i}>
              [{new Date(e.ts).toLocaleTimeString()}] {e.level}
              {e.filename ? ` ${e.filename}` : ''} {e.strategyId ? ` ${e.strategyId}` : ''} —{' '}
              {e.line}
            </div>
          ))}
        </ScrollShadow>
      </div>
    </Card>
  )
}
