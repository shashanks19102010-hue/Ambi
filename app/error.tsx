"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-screen">
      <div className="error-card">
        <div className="ambi-mark">A</div>

        <h1>Ambi recovered from a crash</h1>

        <p>
          The application isolated the failed screen so your saved
          local conversations are not deleted.
        </p>

        <button onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}