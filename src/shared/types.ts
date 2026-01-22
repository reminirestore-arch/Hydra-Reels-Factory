export interface VideoFile {
  id: string;
  name: string;
  path: string;
  thumbnail?: string;
}

export type StrategyType = 'IG1' | 'IG2' | 'IG3' | 'IG4';

export interface StrategyConfig {
  id: StrategyType;
  label: string;
  description: string;
  color: "primary" | "secondary" | "warning" | "danger" | "success" | "default";
}

// Параметры, которые мы будем крутить
export interface EditorSettings {
  strategy: StrategyType;
  volume: number;      // Громкость
  speed: number;       // Скорость
  saturation: number;  // Насыщенность
  vignette: boolean;   // Виньетка
  captions: boolean;   // Субтитры
}
