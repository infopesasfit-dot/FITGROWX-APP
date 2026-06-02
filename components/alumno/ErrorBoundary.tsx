"use client";

import React, { ReactNode } from "react";

const fd = "'Inter', sans-serif";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{
            minHeight: "200px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            padding: "20px",
            textAlign: "center",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12,
            gap: 16,
          }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <div>
              <h3 style={{ font: `600 1rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 6 }}>
                Algo salió mal
              </h3>
              <p style={{ font: `400 0.85rem/1.5 ${fd}`, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
                {this.state.error?.message || "Error desconocido"}
              </p>
              <button
                onClick={this.handleReset}
                style={{
                  padding: "8px 16px",
                  background: "#F97316",
                  border: "none",
                  borderRadius: 8,
                  color: "#FFFFFF",
                  font: `600 0.85rem/1 ${fd}`,
                  cursor: "pointer",
                }}
              >
                Reintentar
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
