# Архитектура проекта

## Обзор

Проект построен на Electron + React + TypeScript с использованием современных практик разработки. Приложение предназначено для обработки видео с применением различных стратегий рендеринга (IG1, IG2, IG3, IG4) и создания оверлеев с текстом.

## Структура проекта

```
src/
├── main/                    # Main process (Node.js)
│   ├── app/                 # Application lifecycle
│   │   ├── createWindow.ts  # Создание окон приложения
│   │   └── registerAppLifecycle.ts  # Регистрация жизненного цикла
│   ├── ipc/                 # IPC handlers
│   │   ├── handlers/        # Обработчики IPC запросов
│   │   │   ├── dialogs.ts   # Диалоги выбора папок
│   │   │   ├── ffmpeg.ts    # Обработка FFmpeg операций
│   │   │   ├── fs.ts        # Файловые операции
│   │   │   └── overlay.ts   # Сохранение оверлеев
│   │   └── index.ts         # Регистрация всех handlers
│   └── services/            # Бизнес-логика сервисов
│       ├── ffmpeg/          # FFmpeg сервис (рендеринг, извлечение кадров)
│       ├── fs/              # Файловые операции (сканирование папок)
│       ├── paths/           # Управление путями приложения
│       └── temp/            # Управление временными файлами
├── preload/                 # Preload scripts (bridge)
│   └── api/                 # API для renderer process
│       ├── exposeApi.ts     # Экспорт API через contextBridge
│       └── types.ts         # Типы для API
├── renderer/                # Renderer process (React)
│   └── src/
│       ├── app/             # Точка входа приложения
│       │   ├── App.tsx      # Корневой компонент с ErrorBoundary
│       │   ├── main.tsx     # Инициализация React
│       │   └── routes.tsx   # Маршрутизация (пока только Dashboard)
│       ├── features/        # Feature-based модули
│       │   ├── editor/      # Редактор оверлеев
│       │   │   ├── components/  # Компоненты редактора
│       │   │   ├── hooks/       # Хуки для работы с canvas и оверлеями
│       │   │   └── utils/       # Утилиты для Fabric.js
│       │   ├── files/       # Управление файлами
│       │   │   └── model/   # Zustand store для файлов
│       │   └── processing/  # Обработка видео
│       │       └── model/   # Zustand store для обработки
│       ├── pages/           # Страницы приложения
│       │   └── Dashboard/   # Главная страница
│       ├── components/      # Общие компоненты
│       │   └── Versions.tsx # Отображение версий
│       └── shared/          # Общие утилиты для renderer
│           ├── api/         # API клиент для IPC
│           └── components/  # Общие компоненты (ErrorBoundary)
└── shared/                  # Общий код для main и renderer
    ├── config/              # Конфигурация приложения
    ├── domain/              # Доменные модели
    │   ├── strategy.ts      # Модели стратегий рендеринга
    │   └── video.ts         # Модели видео файлов
    ├── ipc/                 # IPC контракты и каналы
    ├── logger/              # Система логирования
    ├── security/            # Безопасность (валидация путей, санитизация)
    ├── utils/               # Утилиты (retry логика)
    ├── validation/          # Zod схемы валидации
    └── types.ts             # Общие типы (фасад для domain)
```

## Архитектурные паттерны

### 1. Feature-Sliced Design
- Каждая фича изолирована в `features/`
- Структура: `components/`, `hooks/`, `model/`, `utils/`
- Минимальные зависимости между фичами
- **Реализованные фичи:**
  - `editor` - редактор оверлеев на базе Fabric.js
  - `files` - управление видео файлами и папками
  - `processing` - обработка и рендеринг видео

### 2. Domain-Driven Design
- Доменные модели в `shared/domain/`
- Фабрики для создания сущностей (`createVideoFile`, `createDefaultStrategy`)
- Четкое разделение бизнес-логики
- **Доменные модели:**
  - `VideoFile` - модель видео файла с стратегиями
  - `VideoStrategy` - модель стратегии рендеринга (IG1-IG4)
  - `OverlaySettings` - настройки оверлея (тайминг, текст, фон)
  - `StrategyProfileSettings` - настройки профиля стратегии

### 3. Service Layer
- Сервисы в `main/services/`
- Изолированная бизнес-логика
- Переиспользуемые компоненты
- **Реализованные сервисы:**
  - `ffmpeg` - рендеринг видео, извлечение кадров, применение фильтров
  - `fs` - сканирование папок, поиск видео файлов
  - `temp` - управление временными файлами
  - `paths` - управление путями приложения

### 4. IPC Architecture
- Типизированные контракты в `shared/ipc/`
- Result<T> паттерн для обработки ошибок
- Безопасное API через contextBridge
- **IPC каналы:**
  - `dialogs:selectFolder` - выбор входной папки
  - `dialogs:selectOutputFolder` - выбор выходной папки
  - `fs:scanFolder` - сканирование папки на видео файлы
  - `ffmpeg:extractFrame` - извлечение кадра из видео
  - `ffmpeg:renderStrategy` - рендеринг видео по стратегии
  - `ffmpeg:log` - события логирования FFmpeg
  - `overlay:saveOverlay` - сохранение оверлея

## Валидация данных

Используется **Zod** для runtime валидации всех данных, поступающих через IPC и из внешних источников.

### Использование

```typescript
import { VideoFileSchema, safeParse } from '@shared/validation/schemas'

const validation = safeParse(VideoFileSchema, data)
if (validation.success) {
  // Использовать validation.data (типизировано)
} else {
  // Обработать validation.error (ZodError)
  logger.warn('Validation failed', { errors: validation.error.issues })
}
```

### Реализованные схемы валидации

**Доменные модели:**
- `VideoFileSchema` - валидация видео файлов
- `VideoStrategySchema` - валидация стратегии рендеринга
- `OverlaySettingsSchema` - валидация настроек оверлея
- `StrategyProfileSettingsSchema` - валидация настроек профиля стратегии
- `StrategyTypeSchema` - enum для типов стратегий (IG1, IG2, IG3, IG4)

**IPC контракты:**
- `ExtractFrameArgsSchema` - валидация аргументов извлечения кадра
- `RenderStrategyPayloadSchema` - валидация payload для рендеринга
- `SaveOverlayArgsSchema` - валидация аргументов сохранения оверлея
- `ScanFolderArgsSchema` - валидация аргументов сканирования папки

### Валидация в коде

Валидация применяется:
- В IPC handlers перед обработкой запросов
- В stores при получении данных от API
- При создании доменных сущностей через фабрики

## Логирование

Реализована система структурированного логирования через `@shared/logger`. Логгер хранит записи в памяти с ограничением по количеству (по умолчанию 1000 записей).

### Использование

```typescript
import { createLogger } from '@shared/logger'

// Создание контекстного логгера
const logger = createLogger('MyComponent')

// Логирование с контекстом
logger.info('Operation started', { context: 'data' })
logger.error('Operation failed', error, { context: 'data' })
logger.warn('Warning message', { additional: 'info' })
logger.debug('Debug information', { details: 'data' })
```

### Уровни логирования
- `error` - критические ошибки (с поддержкой Error объектов)
- `warn` - предупреждения
- `info` - информационные сообщения
- `debug` - отладочная информация

### Настройка

Уровень логирования настраивается через переменную окружения `LOG_LEVEL`:
```bash
LOG_LEVEL=debug  # или error, warn, info
```

По умолчанию используется уровень `info`. Логгер автоматически фильтрует сообщения по уровню и выводит их в консоль с форматированием (временная метка, уровень, контекст).

### Использование в проекте

Логирование используется во всех ключевых компонентах:
- IPC handlers для отслеживания операций
- Сервисы (FFmpeg, FS) для диагностики
- Stores для отслеживания изменений состояния
- Retry логика для отладки повторных попыток

## Конфигурация

Конфигурация приложения управляется через environment variables (`.env` файл) с валидацией через Zod схемы.

### Структура конфигурации

```typescript
// В main process
import { getConfig } from '@shared/config'

const config = getConfig()
// config.canvas.width, config.ffmpeg.maxConcurrent, и т.д.

// В renderer process
import { getRendererConfig } from '@shared/config/renderer'

const config = getRendererConfig()
```

### Переменные окружения

```bash
# Canvas (размеры canvas для редактора)
CANVAS_WIDTH=450
CANVAS_HEIGHT=800

# FFmpeg (настройки обработки видео)
FFMPEG_MAX_CONCURRENT=4        # Максимум параллельных операций
FFMPEG_TIMEOUT=300000          # Таймаут в миллисекундах (5 минут)

# Processing (настройки обработки)
PROCESSING_MAX_LOGS=600        # Максимум логов в store
PROCESSING_RETRY_ATTEMPTS=3    # Количество попыток при ошибке

# Feature Flags (флаги функций)
FEATURE_ADVANCED_FILTERS=false
FEATURE_BATCH_PROCESSING=true
FEATURE_PREVIEW_CACHE=true

# Paths (настройки путей)
MAX_PATH_LENGTH=4096
ALLOWED_EXTENSIONS=.mp4,.mov,.m4v,.webm,.mkv
```

### Валидация конфигурации

Все значения конфигурации валидируются через Zod при загрузке приложения:
- Числовые значения проверяются на тип и диапазон
- Булевы значения парсятся из строк
- Массивы парсятся из строк через запятую
- При невалидных значениях используются значения по умолчанию

### Разделение конфигурации

- `shared/config/index.ts` - конфигурация для main process (доступ к `process.env`)
- `shared/config/renderer.ts` - конфигурация для renderer process (использует `window.__ENV__` или значения по умолчанию)

## Безопасность

Реализованы механизмы защиты от распространенных уязвимостей: directory traversal, XSS, injection атак.

### Валидация путей

Класс `PathValidator` защищает от directory traversal атак и проверяет корректность путей:

```typescript
import { pathValidator } from '@shared/security/pathValidation'

// Валидация пути
const validation = pathValidator.validatePath(path, baseDir)
if (!validation.valid) {
  throw new Error(validation.error)
}
// Использовать validation.sanitized

// Валидация расширения файла
const extValidation = pathValidator.validateExtension(filePath)
if (!extValidation.valid) {
  throw new Error(extValidation.error)
}

// Полная валидация и санитизация
const result = pathValidator.validateAndSanitize(filePath, baseDir)
```

**Проверки:**
- Защита от `..` (directory traversal)
- Защита от null bytes (`\0`)
- Проверка максимальной длины пути
- Проверка, что путь находится в пределах baseDir
- Валидация расширения файла (из конфигурации)
- Санитизация имени файла (удаление опасных символов)

### Санитизация данных

Функции для очистки пользовательского ввода:

```typescript
import { sanitizeString, sanitizeDataUrl, sanitizeHtml } from '@shared/security/sanitization'

// Очистка строк (удаление null bytes, ограничение длины)
const clean = sanitizeString(userInput, maxLength)

// Валидация и очистка data URL
const result = sanitizeDataUrl(base64Data)
if (result.valid) {
  // Использовать result.sanitized
}

// Базовая очистка HTML (экранирование)
const safeHtml = sanitizeHtml(htmlString)

// Валидация UUID
const isValid = validateUuid(uuidString)

// Валидация hex цвета
const isValidColor = validateHexColor('#ffffff')
```

### Использование в проекте

Безопасность применяется:
- В IPC handlers перед обработкой путей к файлам
- При сохранении оверлеев (валидация dataUrl)
- При сканировании папок (валидация путей)
- При рендеринге видео (проверка входных/выходных путей)

## Производительность

### Параллельная обработка

Обработка видео выполняется параллельно с ограничением количества одновременных операций:

```typescript
// В processingStore используется p-limit для контроля параллелизма
const limit = pLimit(config.ffmpeg.maxConcurrent) // По умолчанию 4
await Promise.all(tasks.map(task => limit(task)))
```

### Code Splitting

- Lazy loading для `EditorModal` (динамический импорт)
- Динамические импорты для тяжелых модулей (например, `p-limit`)

### Мемоизация

- `useMemo` для дорогих вычислений (например, фильтрация файлов)
- `useCallback` для стабильных функций (колбэки в компонентах)
- Мемоизированные селекторы в Zustand stores

### Retry Logic

Реализована система повторных попыток с экспоненциальным backoff:

```typescript
import { retry } from '@shared/utils/retry'

await retry(() => apiClient.renderStrategy(payload), {
  maxAttempts: 3,              // Количество попыток (из конфигурации)
  delay: 1000,                 // Базовая задержка в миллисекундах
  backoff: 'exponential',      // 'exponential' или 'linear'
  onRetry: (attempt, error) => {
    // Колбэк при повторной попытке
  }
})
```

**Особенности:**
- Экспоненциальный backoff: задержка увеличивается как `baseDelay * 2^(attempt-1)`
- Линейный backoff: задержка увеличивается как `baseDelay * attempt`
- Логирование всех попыток через logger
- Используется в `processingStore` для рендеринга стратегий

### Оптимизация логов

Логи в `processingStore` ограничены по количеству (по умолчанию 600 записей) для предотвращения утечек памяти при длительной обработке.

## Обработка ошибок

### Result<T> Pattern

Все IPC операции возвращают типизированный `Result<T>` для безопасной обработки ошибок:

```typescript
type Result<T> = 
  | { ok: true; data: T }
  | { ok: false; error: IpcError }

type IpcError = {
  code: IpcErrorCode  // 'CANCELLED' | 'VALIDATION' | 'NOT_FOUND' | 'IO' | 'FFMPEG' | 'INTERNAL' | 'UNKNOWN'
  message: string
  details?: unknown
}
```

### Использование Result

**В IPC handlers:**
```typescript
import { ok, err, toUnknownErr } from './_result'

try {
  const result = await someOperation()
  return ok(result)
} catch (error) {
  return err(toUnknownErr(error))
}
```

**В renderer (через apiClient):**
```typescript
// apiClient автоматически unwrap'ает Result
const data = await apiClient.scanFolder(path) // Возвращает данные или бросает IpcClientError

// Или напрямую через window.api
const result = await window.api.scanFolder(path)
if (result.ok) {
  // Использовать result.data
} else {
  // Обработать result.error
}
```

### Error Boundary

Глобальный `ErrorBoundary` в `App.tsx` перехватывает все React ошибки и отображает пользователю понятное сообщение:

```typescript
<ErrorBoundary
  onError={(error, errorInfo) => {
    console.error('Application error:', error, errorInfo)
  }}
>
  <Routes />
</ErrorBoundary>
```

**Особенности:**
- Отображение сообщения об ошибке пользователю
- Кнопка "Try Again" для сброса состояния
- В development режиме показывается stack trace
- Кастомный fallback UI с использованием HeroUI компонентов

### Централизованная обработка

- `ok(data)` - создание успешного Result
- `err(error)` - создание Result с ошибкой
- `toUnknownErr(error)` - преобразование неизвестной ошибки в IpcError
- `unwrap(result)` - извлечение данных из Result (бросает исключение при ошибке)
- `IpcClientError` - кастомный класс ошибки для renderer process с кодом и деталями

### Коды ошибок

- `CANCELLED` - операция отменена пользователем
- `VALIDATION` - ошибка валидации данных
- `NOT_FOUND` - файл или ресурс не найден
- `IO` - ошибка файловой системы
- `FFMPEG` - ошибка при выполнении FFmpeg операции
- `INTERNAL` - внутренняя ошибка приложения
- `UNKNOWN` - неизвестная ошибка

## Управление состоянием

Используется **Zustand** для управления состоянием приложения. Все stores следуют единой структуре с разделением на state и actions.

### Реализованные Stores

#### filesStore (`features/files/model/filesStore.ts`)

Управление видео файлами и папками:

```typescript
type FilesState = {
  // State
  inputDir: string | null
  outputDir: string | null
  files: VideoFile[]
  selectedFile: VideoFile | null
  isLoading: boolean
  error: string | null

  // Actions
  actions: {
    pickInputDir: () => Promise<void>
    pickOutputDir: () => Promise<void>
    scan: () => Promise<void>
    selectFile: (file: VideoFile | null) => void
    setInputDir: (path: string | null) => void
    setOutputDir: (path: string | null) => void
    updateFile: (file: VideoFile) => void
  }
}
```

**Особенности:**
- Автоматическая валидация файлов через Zod при сканировании
- Сохранение выбранного файла при обновлении списка
- Логирование операций через logger

#### processingStore (`features/processing/model/processingStore.ts`)

Управление обработкой и рендерингом видео:

```typescript
type ProcessingState = {
  // State
  isRendering: boolean
  lastResult: boolean | null
  error: string | null
  progress: { completed: number; total: number }
  stopRequested: boolean
  statusByFileId: Record<string, FileProcessingStatus>
  logs: FfmpegLogEvent[]
  maxLogs: number

  // Actions
  actions: {
    renderAll: () => Promise<void>
    stop: () => void
    reset: () => void
    setFileStatus: (fileId: string, status: FileProcessingStatus) => void
    clearStatuses: () => void
    clearLogs: () => void
    pushLog: (e: FfmpegLogEvent) => void
  }
}
```

**Особенности:**
- Параллельная обработка с ограничением через p-limit
- Отслеживание прогресса по файлам и стратегиям
- Подписка на FFmpeg логи через IPC
- Retry логика для каждой стратегии
- Управление статусами файлов (idle, processing, done, error)

### Структура Store

Все stores следуют единому паттерну:

```typescript
export const useStore = create<StoreState>((set, get) => ({
  // State (примитивные значения и массивы)
  data: [],
  isLoading: false,
  error: null,

  // Actions (всегда в объекте actions)
  actions: {
    action1: () => void,
    action2: () => Promise<void>,
    action3: (param: T) => void
  }
}))

// Использование в компонентах
const { data, isLoading, actions } = useStore()
```

**Преимущества:**
- Четкое разделение state и actions
- Легко тестировать actions отдельно
- Автоматическая типизация через TypeScript
- Минимальный boilerplate код

## Типизация

Проект использует строгий TypeScript режим с полной типизацией всех компонентов.

### Особенности типизации

- **Строгий TypeScript режим** - все файлы проверяются на типы
- **Явные типы возврата** - все функции имеют явные типы возврата
- **Типизированные IPC контракты** - все IPC операции типизированы через `shared/ipc/contracts.ts`
- **Доменные типы** - типы в `shared/domain/` с фасадом в `shared/types.ts`
- **Zod схемы** - runtime валидация с автоматической генерацией типов
- **API типизация** - `window.api` типизирован через `preload/api/types.ts`

### Типизация IPC

```typescript
// Каналы типизированы через const assertion
export const IPC = {
  SelectFolder: 'dialogs:selectFolder',
  // ...
} as const

// Контракты типизированы отдельно
export type SelectFolderResult = string | null
export type ScanFolderArgs = { path: string }
export type ScanFolderResult = VideoFile[]

// API типизирован через satisfies
export const api: Api = { ... } satisfies Api
```

### Проверка типов

```bash
npm run typecheck        # Проверка всех типов
npm run typecheck:node    # Проверка main process
npm run typecheck:web     # Проверка renderer process
```

## Стратегии рендеринга

Приложение поддерживает 4 стратегии рендеринга видео, каждая с уникальными визуальными эффектами и настройками.

### Типы стратегий

- **IG1 (Focus Profile)** - профиль с фокусом и виньеткой
  - `focusStrength` (0.0-1.0) - сила кропа/фокуса
  - `vignetteIntensity` (0.0-1.0) - интенсивность виньетки
  
- **IG2 (Motion Profile)** - профиль с движением и насыщенностью
  - `motionSpeed` (0.1-3.0) - скорость воспроизведения
  - `saturation` (0.1-3.0) - насыщенность цветов
  
- **IG3 (Contrast Profile)** - профиль с контрастом и резкостью
  - `contrast` (0.1-3.0) - контраст
  - `sharpness` (0.0-2.0) - резкость
  - `fadeInDuration` (0.1-1.0) - длительность fade in
  - `fadeOutDuration` (0.1-1.0) - длительность fade out
  
- **IG4 (Grain Profile)** - профиль с зерном и поворотом
  - `grain` (0.0-1.0) - интенсивность зерна
  - `rotationAngle` (-2.0 до +2.0) - угол поворота в градусах
  - `fadeInDuration` (0.1-1.0) - длительность fade in
  - `fadeOutDuration` (0.1-1.0) - длительность fade out

### Настройки стратегий

Каждая стратегия имеет:
- **Статус** (`default` или `custom`) - указывает, использовались ли пользовательские настройки
- **Overlay настройки** - параметры оверлея (текст, фон, тайминг)
- **Profile настройки** - параметры визуальных эффектов стратегии
- **Overlay путь** - путь к сохраненному оверлею (если создан)
- **Canvas состояние** - состояние редактора (для восстановления)

### Создание стратегий

Стратегии создаются через фабрики:

```typescript
import { createDefaultStrategy, createDefaultStrategies } from '@shared/domain/strategy'

// Создание одной стратегии
const strategy = createDefaultStrategy('IG1')

// Создание всех стратегий по умолчанию
const strategies = createDefaultStrategies()
// { IG1: {...}, IG2: {...}, IG3: {...}, IG4: {...} }
```

### Рендеринг стратегий

Рендеринг выполняется через FFmpeg сервис с применением соответствующих фильтров:
- Каждая стратегия использует уникальный набор FFmpeg фильтров
- Поддержка оверлеев с настраиваемым таймингом
- Поддержка fade out эффекта для оверлеев
- Параллельная обработка нескольких стратегий для одного файла

## Редактор оверлеев

Реализован полнофункциональный редактор оверлеев на базе Fabric.js.

### Компоненты редактора

- `EditorModal` - модальное окно редактора
- `EditorPanel` - основная панель редактора
- `EditorCanvas` - canvas для редактирования
- `CanvasContainer` - контейнер для canvas
- `EditorToolbar` - панель инструментов
- `LayersPanel` - панель слоев
- `SettingsPanel` - панель настроек

### Хуки редактора

- `useFabricCanvas` - управление Fabric.js canvas
- `useEditorHydration` - гидратация состояния редактора
- `useOverlayLogic` - логика работы с оверлеями
- `overlayObjectFactories` - фабрики объектов оверлея
- `overlaySettings` - управление настройками оверлея
- `overlayGeometry` - геометрические вычисления
- `overlayCanvasIds` - управление ID объектов

### Функциональность

- Создание и редактирование текстовых оверлеев
- Настройка стилей текста (размер, цвет, выравнивание, жирность)
- Настройка фона (размер, цвет, прозрачность, скругление)
- Настройка тайминга (время начала, длительность, fade out)
- Сохранение состояния canvas
- Экспорт оверлея в PNG

## Тестирование

⚠️ **В разработке**: Добавить unit и integration тесты.

Планируется:
- Unit тесты для сервисов (FFmpeg, FS)
- Unit тесты для stores (Zustand)
- Unit тесты для утилит (валидация, безопасность)
- Integration тесты для IPC handlers
- E2E тесты для основных сценариев использования

## Документация

- `ARCHITECTURE.md` - этот файл (архитектура проекта)
- `README.md` - общая информация о проекте
- JSDoc комментарии для публичных API (планируется)

## Технологический стек

### Основные технологии

- **Electron** ^39.2.6 - фреймворк для десктопных приложений
- **React** ^19.2.1 - UI библиотека
- **TypeScript** ^5.9.3 - типизированный JavaScript
- **Vite** ^7.2.6 - сборщик и dev server
- **Zustand** ^5.0.10 - управление состоянием
- **Zod** ^4.3.6 - валидация схем
- **Fabric.js** ^7.1.0 - canvas библиотека для редактора
- **FFmpeg** (fluent-ffmpeg ^2.1.3, ffmpeg-static ^5.3.0) - обработка видео

### UI библиотеки

- **HeroUI** ^3.0.0-beta.5 - компоненты UI
- **Tailwind CSS** ^4.1.18 - стилизация
- **Framer Motion** ^12.28.1 - анимации
- **Lucide React** ^0.562.0 - иконки

### Утилиты

- **Winston** ^3.19.0 - логирование (не используется напрямую, есть кастомный logger)
- **p-limit** ^7.2.0 - ограничение параллелизма
- **path-sanitizer** ^3.1.0 - санитизация путей
