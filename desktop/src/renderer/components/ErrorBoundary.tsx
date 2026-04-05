import React from "react";
import { Button } from "./ui";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  override componentDidCatch(error: Error): void {
    console.error("Renderer crash captured by ErrorBoundary", error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-error-50 mx-auto mb-4">
              <span className="material-symbols-rounded text-error-500 text-2xl">
                error
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Brifo hit an unexpected error
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {this.state.message || "Unknown renderer error"}
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload app
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
