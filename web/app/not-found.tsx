import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-5xl font-semibold tracking-tight text-gray-300 tnum">
        404
      </span>
      <p className="mt-4 text-sm text-gray-500">
        That page doesn&apos;t exist or the record hasn&apos;t been published
        yet.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-400"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
