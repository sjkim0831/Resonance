import { Component, ErrorInfo, ReactNode } from "react";
import { publishTelemetryEvent } from "../../platform/telemetry/events";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorFingerprint = this.generateFingerprint(error, errorInfo);
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      fingerprint: errorFingerprint,
      timestamp: new Date().toISOString()
    };

    console.error("[ErrorBoundary] Caught error:", errorDetails);

    publishTelemetryEvent({
      type: "ui_error",
      result: "error_boundary_caught",
      payloadSummary: errorDetails
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.reportErrorToBackend(errorDetails);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  private generateFingerprint(error: Error, errorInfo: ErrorInfo): string {
    const hashInput = [
      error.name,
      error.message,
      errorInfo.componentStack?.split("\n")[0] || ""
    ].join("|");
    
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ERR_${Math.abs(hash).toString(16).toUpperCase()}`;
  }

  private async reportErrorToBackend(errorDetails: {
    message: string;
    stack?: string;
    componentStack?: string;
    fingerprint: string;
    timestamp: string;
  }) {
    try {
      const pageId = window.__CARBONET_REACT_MIGRATION__?.route || "unknown";
      
      const response = await fetch("/api/frontend/error/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": document.querySelector('meta[name="_csrf"]')?.getAttribute("content") || ""
        },
        body: JSON.stringify({
          errorType: "REACT_ERROR_BOUNDARY",
          fingerprint: errorDetails.fingerprint,
          message: errorDetails.message,
          stack: errorDetails.stack,
          componentStack: errorDetails.componentStack,
          pageId: pageId,
          timestamp: errorDetails.timestamp,
          userAgent: navigator.userAgent,
          url: window.location.href
        }),
        credentials: "same-origin"
      });
      
      const result = await response.json();
      if (result.status === "self_healing_triggered" || result.status === "ticket_created") {
        console.log("[ErrorBoundary] Auto-ticket created:", result.ticketId);
      }
    } catch (reportError) {
      console.error("[ErrorBoundary] Failed to report error to backend:", reportError);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h2 className="mb-2 text-xl font-bold text-gray-800">화면 오류가 발생했습니다</h2>
            <p className="mb-4 text-sm text-gray-600">
              문제가 지속된다면 페이지를 새로고침 해주세요.
            </p>
            <button
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={() => window.location.reload()}
            >
              페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
