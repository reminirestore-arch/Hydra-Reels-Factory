import { JSX } from 'react'
import { Routes } from './routes'
import { ErrorBoundary } from '../shared/components/ErrorBoundary'

export default function App(): JSX.Element {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Application error:', error, errorInfo)
      }}
    >
      <Routes />
    </ErrorBoundary>
  )
}
