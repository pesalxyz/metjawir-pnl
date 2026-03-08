import { GenerateForm } from "@/components/forms/generate-form";

export function HeroSection() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10">
      <section className="mb-8 text-center">
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          METJAWIR PNL CARD
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Ora ana sambungan dompet dibutuhake. Tempel transaksi posisi cedhak kanggo entuk kertu PNL
        </p>
      </section>

      <GenerateForm />
    </main>
  );
}
