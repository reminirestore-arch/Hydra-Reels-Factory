import type { Api } from '@shared/ipc/contracts'

export const apiClient: Api = {
  selectFolder: () => window.api.selectFolder(),
  selectOutputFolder: () => window.api.selectOutputFolder(),
  scanFolder: (path) => window.api.scanFolder(path),
  extractFrame: (path, strategyId, atSeconds) =>
    window.api.extractFrame(path, strategyId, atSeconds),
  saveOverlay: (dataUrl) => window.api.saveOverlay(dataUrl),
  renderStrategy: (payload) => window.api.renderStrategy(payload)
}
