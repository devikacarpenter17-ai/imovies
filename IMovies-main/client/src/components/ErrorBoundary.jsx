import { Component } from 'react';

// Shows the error on screen instead of leaving a blank page if something crashes while rendering.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container page">
        <div className="empty">
          <h3>Something went wrong on this page</h3>
          <p>{String(this.state.error.message || this.state.error)}</p>
          <button className="btn btn-brand" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
  }
}
