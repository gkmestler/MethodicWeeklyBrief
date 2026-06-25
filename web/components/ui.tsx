import React from "react";

// Small shared presentational primitives shared across dashboard sections.

export function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-gray-950">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-100/40 px-6 py-10 text-sm text-gray-400">
      {message}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-gray-100 text-gray-700 border-gray-200",
    updated: "bg-gray-950 text-white border-gray-950",
    closed: "bg-white text-gray-400 border-gray-200",
    added: "bg-gray-950 text-white border-gray-950",
    quantitative: "bg-gray-950 text-white border-gray-950",
    qualitative: "bg-white text-gray-500 border-gray-200",
  };
  const cls = styles[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}
