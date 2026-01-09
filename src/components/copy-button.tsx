"use client";

export function CopyButton({ text }: { text: string }) {
  const copy = () => {
    navigator.clipboard.writeText(text);
  };

  return (
    <button onClick={copy} className="btn btn-secondary text-sm">
      Copy
    </button>
  );
}
