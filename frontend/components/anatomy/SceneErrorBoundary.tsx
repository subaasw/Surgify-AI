"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

export class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("3D scene fallback activated", error.message, info.componentStack);
  }
  render() {
    if (this.state.failed) return <div className="scene-fallback"><TriangleAlert size={22} /><strong>3D preview unavailable</strong><span>The learning controls remain available. Refresh to retry the procedural model.</span></div>;
    return this.props.children;
  }
}
