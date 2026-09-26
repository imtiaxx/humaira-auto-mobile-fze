"use client";

/**
 * Last-resort error boundary.
 *
 * Replaces the root layout when the layout itself throws, so it must render its
 * own `<html>` and `<body>`. Two consequences follow from the file being a
 * Client Component: global styles and fonts are not applied here, and the
 * Metadata API is unavailable - the title is set with React's `<title>`.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en-AE">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#07090c",
          color: "#f6f7f9",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <title>Application error | Humera Automobile</title>
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            Humera Automobile is temporarily unavailable
          </h1>
          <p style={{ color: "#b0b8c4", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            An unexpected error stopped the application from rendering. Our team has been
            notified.
          </p>
          {error.digest ? (
            <p style={{ color: "#8590a1", fontSize: "0.75rem", marginBottom: "1.5rem" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              backgroundColor: "#f6f7f9",
              color: "#07090c",
              border: 0,
              borderRadius: "4px",
              padding: "0.65rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload the page
          </button>
        </main>
      </body>
    </html>
  );
}
