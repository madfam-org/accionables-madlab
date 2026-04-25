/**
 * Root error boundary fallback. Shown by Sentry's <ErrorBoundary> in main.tsx
 * when an uncaught render error bubbles all the way up. Sentry has already
 * captured the exception by the time this renders — the UI just needs to
 * give the user a path forward (reload).
 *
 * Kept intentionally inline-styled / dependency-free: if the app's CSS or
 * design-system code is the thing that exploded, we still want this to render.
 */
export function RootErrorFallback() {
  return (
    <div
      role="alert"
      style={{
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '32rem',
        margin: '4rem auto',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
        Something went wrong
      </h1>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        The MADLAB dashboard hit an unexpected error. The team has been
        notified. Please reload the page to continue.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          border: '1px solid #ccc',
          background: '#f5f5f5',
          cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  );
}
