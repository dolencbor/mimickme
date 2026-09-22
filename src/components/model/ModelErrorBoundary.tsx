"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; resetKey: string };
type State = { error: Error | null };

export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GLB loading failed", error, info);
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="viewer-message error-message" role="alert">
          <strong>Model could not be loaded.</strong>
          <span>Choose a valid binary .glb file and try again.</span>
        </div>
      );
    }
    return this.props.children;
  }
}
