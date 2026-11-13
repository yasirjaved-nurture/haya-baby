import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <div className="text-6xl">🧸</div>
        <h1 className="mt-4 text-3xl font-semibold">Oops, nothing here</h1>
        <Link href="/" className="btn-primary mt-6">Back home</Link>
      </div>
    </div>
  );
}
