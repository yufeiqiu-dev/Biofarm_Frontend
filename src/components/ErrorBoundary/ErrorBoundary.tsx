import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
  /** Named in the message, so "the dashboard" beats "something". */
  label?: string;
  /**
   * A last-resort escape for a failure that navigating cannot clear.
   *
   * The two standard actions both assume the fault is tied to where you are:
   * reload the route, or leave it. That holds for the boundary inside App,
   * which wraps the routes - but not for the one above the providers, where a
   * throw is path-independent. A provider that cannot read its own stored state
   * re-mounts and throws again wherever you navigate, so "go to the home page"
   * returns the reader to the same wall the copy promised it would clear.
   *
   * Offered only where such a reset exists, and destructive by nature, so the
   * caller supplies both the action and a label that says what it costs.
   */
  reset?: { label: string; onReset: () => void };
}

interface State {
  error: Error | null;
}

/**
 * Stops one bad render taking the whole page with it.
 *
 * React unmounts the entire tree when a render throws and nothing catches it.
 * The result is a white page with a healthy network tab and nothing in the UI
 * saying anything happened - which is the hardest kind of failure to report,
 * because the person seeing it has nothing to describe.
 *
 * This is not hypothetical here: `daily.length` on a response that had no
 * `daily` did exactly that to the admin console during development. The two
 * repos deploy independently, so a frontend shipped ahead of its backend gets a
 * perfectly successful response missing a field it expects, and every such
 * mismatch is one throw away from a blank screen.
 *
 * A class component because there is still no hook equivalent -
 * componentDidCatch has no functional counterpart.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Logged deliberately, and this is not the exception the api client makes.
    // That rule is about response *bodies*, which can carry a customer's own
    // data; this is our own stack trace, and without it a white page leaves
    // nothing at all to go on.
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className={styles.wrap} role="alert">
        <h1 className={styles.title}>
          {this.props.label ? `${this.props.label} could not be displayed` : "Something broke"}
        </h1>
        <p className={styles.body}>
          This is a fault on our side, not something you did. Reloading often
          clears it; if it does not, the home page will.
        </p>
        {/*
          Two ways out, deliberately. A reload returns to the same route, so for
          a deterministic cause - a response missing a field this page reads -
          it throws again immediately and the reader is stuck in a loop the copy
          promised would clear.
          
          A full navigation home clears anything tied to the route. Not a router
          link: this tree is already unmounted, so client-side routing has
          nothing to render into.

          Neither helps when the throw is path-independent - a provider that
          cannot read its own stored state re-mounts and throws again wherever
          you go. That is what `reset` is for, and why the boundary above the
          providers supplies one.
        */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go to the home page
          </button>
          {this.props.reset && (
            <button
              type="button"
              className={styles.buttonDanger}
              onClick={this.props.reset.onReset}
            >
              {this.props.reset.label}
            </button>
          )}
        </div>
      </div>
    );
  }
}
