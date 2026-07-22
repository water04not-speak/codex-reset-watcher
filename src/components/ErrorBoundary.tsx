import { Component, type ErrorInfo, type ReactNode } from "react";
import { t, getLanguage } from "../i18n";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const lang = getLanguage();
    return (
      <div className="error-boundary">
        <h2>{t("errorBoundary.title", lang)}</h2>
        <p>{t("errorBoundary.message", lang)}</p>
        <button
          className="btn btn-primary"
          type="button"
          onClick={this.handleReload}
        >
          {t("errorBoundary.reload", lang)}
        </button>
      </div>
    );
  }
}
