import type { StrategyType } from '@shared/types'

export type SliderConfig = {
  key: keyof import('@shared/types').StrategyProfileSettings
  label: string
  min: number
  max: number
  step: number
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default'
  description?: string
}

export const getProfileConfigs = (strategyId: StrategyType): SliderConfig[] => {
  switch (strategyId) {
    case 'IG1':
      return [
        {
          key: 'focusStrength',
          label: 'Сила фокуса',
          min: 0,
          max: 1,
          step: 0.05,
          color: 'primary',
          description: 'Увеличивает кроп для эффекта зума'
        },
        {
          key: 'vignetteIntensity',
          label: 'Интенсивность виньетки',
          min: 0,
          max: 1,
          step: 0.05,
          color: 'secondary',
          description: 'Затемнение по краям кадра'
        },
        {
          key: 'contrast',
          label: 'Контраст',
          min: 0.8,
          max: 1.5,
          step: 0.05,
          color: 'success',
          description: 'Общий контраст изображения'
        }
      ]
    case 'IG2':
      return [
        {
          key: 'motionSpeed',
          label: 'Скорость движения',
          min: 0.8,
          max: 1.3,
          step: 0.01,
          color: 'primary',
          description: 'Скорость воспроизведения (1.0 = нормальная)'
        },
        {
          key: 'saturation',
          label: 'Насыщенность',
          min: 0.8,
          max: 1.5,
          step: 0.05,
          color: 'secondary',
          description: 'Интенсивность цветов'
        },
        {
          key: 'contrast',
          label: 'Контраст',
          min: 0.8,
          max: 1.5,
          step: 0.05,
          color: 'success',
          description: 'Общий контраст изображения'
        }
      ]
    case 'IG3':
      return [
        {
          key: 'contrast',
          label: 'Контраст',
          min: 0.8,
          max: 1.5,
          step: 0.05,
          color: 'primary',
          description: 'Интенсивность контраста'
        },
        {
          key: 'sharpness',
          label: 'Резкость',
          min: 0,
          max: 2.0,
          step: 0.1,
          color: 'secondary',
          description: 'Интенсивность резкости'
        },
        {
          key: 'fadeInDuration',
          label: 'Fade In (сек)',
          min: 0.1,
          max: 1.0,
          step: 0.05,
          color: 'warning',
          description: 'Длительность плавного появления в начале'
        },
        {
          key: 'fadeOutDuration',
          label: 'Fade Out (сек)',
          min: 0.1,
          max: 1.0,
          step: 0.05,
          color: 'warning',
          description: 'Длительность плавного исчезновения в конце'
        }
      ]
    case 'IG4':
      return [
        {
          key: 'grain',
          label: 'Зерно',
          min: 0,
          max: 1,
          step: 0.05,
          color: 'primary',
          description: 'Интенсивность зерна/шума'
        },
        {
          key: 'rotationAngle',
          label: 'Угол поворота (°)',
          min: -2.0,
          max: 2.0,
          step: 0.1,
          color: 'secondary',
          description: 'Небольшой наклон кадра'
        },
        {
          key: 'fadeInDuration',
          label: 'Fade In (сек)',
          min: 0.1,
          max: 1.0,
          step: 0.05,
          color: 'warning',
          description: 'Длительность плавного появления в начале'
        },
        {
          key: 'fadeOutDuration',
          label: 'Fade Out (сек)',
          min: 0.1,
          max: 1.0,
          step: 0.05,
          color: 'warning',
          description: 'Длительность плавного исчезновения в конце'
        }
      ]
    default:
      return []
  }
}
