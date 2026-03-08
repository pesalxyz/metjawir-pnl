import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-semibold">Card not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This signature has not been generated yet or cannot be reconstructed.
      </p>
      <Link href="/" className="mt-5 text-cyan-300 hover:text-cyan-200">
        Go to generator
      </Link>
    </main>
  );
}
