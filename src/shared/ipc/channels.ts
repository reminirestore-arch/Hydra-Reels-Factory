// src/shared/ipc/channels.ts
export const IPC = {
  SelectFolder: 'dialogs:selectFolder',
  SelectOutputFolder: 'dialogs:selectOutputFolder',
  ScanFolder: 'fs:scanFolder',
  ExtractFrame: 'ffmpeg:extractFrame',
  SaveOverlay: 'overlay:saveOverlay',
  RenderStrategy: 'ffmpeg:renderStrategy',
  FfmpegLog: 'ffmpeg:log'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
