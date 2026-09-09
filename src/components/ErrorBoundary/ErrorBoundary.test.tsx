import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Explodes(): never {
  throw new Error('render blew up');
}

/*
 * React unmounts the whole tree when a render throws and nothing catches it, so
 * one bad component leaves a white page with a healthy network tab and nothing
 * in the UI saying anything happened - the hardest kind of failure to report,
 * because whoever sees it has nothing to describe.
 *
 * Not hypothetical: `daily.length` on a response with no `daily` did exactly
 * that to the admin console during development.
 */
describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error itself; silencing keeps the run readable
    // without hiding whether *our* handler ran.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a message rather than a blank page', () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(document.body.textContent).not.toBe('');
  });

  it('offers a way out', () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('names what failed when it can', () => {
    // "The dashboard could not be displayed" beats "something went wrong".
    render(
      <ErrorBoundary label="The dashboard">
        <Explodes />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/dashboard could not be displayed/i)).toBeInTheDocument();
  });

  it('says the fault is ours, not the reader’s', () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/not something you did/i)).toBeInTheDocument();
  });

  it('logs the error, because a white page leaves nothing to go on', () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );

    const logged = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(logged).toContain('render blew up');
  });

  it('stays out of the way when nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>the actual page</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('the actual page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers a reset when navigating cannot clear the fault', () => {
    /*
     * The two standard actions assume the fault is tied to where you are. A
     * throw from a provider is not: it re-mounts on every route with the same
     * stored input and throws again, so "go to the home page" returns the
     * reader to the same wall the copy promised it would clear.
     */
    const onReset = vi.fn();
    render(
      <ErrorBoundary reset={{ label: 'Sign out and clear saved data', onReset }}>
        <Explodes />
      </ErrorBoundary>,
    );

    screen.getByRole('button', { name: /sign out and clear saved data/i }).click();
    expect(onReset).toHaveBeenCalled();
  });

  it('offers no reset where none was given, rather than a dead button', () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );

    expect(screen.queryByRole('button', { name: /clear saved data/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});

