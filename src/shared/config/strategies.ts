// src/shared/config/strategies.ts
// Domain config for strategy metadata (no React/UI). Icons are provided by the feature layer.
import type { StrategyType } from '../domain/strategy'

export interface StrategyMeta {
  id: StrategyType
  label: string
  desc: string
}

export const STRATEGY_META: readonly StrategyMeta[] = [
  { id: 'IG1', label: 'Юмор', desc: 'Focus + Vignette' },
  { id: 'IG2', label: 'POV', desc: 'Dynamic + Saturation' },
  { id: 'IG3', label: 'Кликбейт', desc: 'High Contrast' },
  { id: 'IG4', label: 'ASMR', desc: 'Cinema + Grain' }
] as const

export type StrategyMetaEntry = (typeof STRATEGY_META)[number]
