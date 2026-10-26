"use client";
export default function PrintButton({ label }) {
  return (
    <button className="btn btn-ink no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
