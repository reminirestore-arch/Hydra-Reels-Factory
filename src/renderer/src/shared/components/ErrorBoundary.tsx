/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, type ReactNode } from 'react'
import { Button, Card } from '@heroui/react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-black p-8">
          <Card className="max-w-md w-full p-6 bg-default-100/10 border border-danger/50">
            <div className="flex flex-col items-center gap-4">
              <AlertTriangle size={48} className="text-danger" />
              <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
              <p className="text-sm text-default-500 text-center">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="w-full mt-2">
                  <summary className="text-xs text-default-400 cursor-pointer">Error details</summary>
                  <pre className="mt-2 text-xs text-default-500 overflow-auto max-h-40">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              <Button
                color="primary"
                onPress={this.handleReset}
                {...({ children: 'Try Again' } as any)}
              />
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
