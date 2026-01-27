# Hydra Reels Factory

An Electron application with React and TypeScript for video processing and overlay editing.

## Features

- 🎬 Video file scanning and management
- 🎨 Interactive canvas editor with Fabric.js
- 🎯 Multiple processing strategies (IG1-IG4)
- 🔄 Batch processing with progress tracking
- 🛡️ Type-safe IPC communication
- ✅ Runtime data validation with Zod
- 📝 Structured logging
- ⚙️ Environment-based configuration
- 🔒 Security features (path validation, sanitization)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
$ cp .env.example .env
```

Key configuration options:
- `CANVAS_WIDTH`, `CANVAS_HEIGHT` - Canvas dimensions
- `FFMPEG_MAX_CONCURRENT` - Max concurrent FFmpeg operations
- `PROCESSING_RETRY_ATTEMPTS` - Retry attempts for failed operations
- `LOG_LEVEL` - Logging level (error, warn, info, debug)
- Feature flags: `FEATURE_ADVANCED_FILTERS`, `FEATURE_BATCH_PROCESSING`, etc.

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Key Technologies

- **Electron** - Desktop application framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Zustand** - State management
- **Fabric.js** - Canvas manipulation
- **FFmpeg** - Video processing
- **Zod** - Runtime validation
- **Tailwind CSS** - Styling
- **HeroUI** - UI components

## Project Structure

```
src/
├── main/          # Main process (Node.js)
├── preload/       # Preload scripts
├── renderer/      # Renderer process (React)
└── shared/        # Shared code
```

## Code Quality

- ESLint for linting
- Prettier for formatting
- TypeScript strict mode
- Path aliases for clean imports

## Security

- Path validation to prevent directory traversal
- Input sanitization
- Type-safe IPC contracts
- Error boundary for React errors
