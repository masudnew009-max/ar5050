import type { ReactNode } from 'react';

/** Shared shell for the static info pages (Contact, FAQ, Terms). */
export function InfoPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="text-white max-w-3xl mx-auto">
      <h1 className="text-2xl lg:text-3xl font-bold mb-2">{title}</h1>
      {intro && <p className="text-dark-400 mb-6">{intro}</p>}
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-dark-800/60 border border-dark-700 rounded-2xl p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="text-sm text-dark-300 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
