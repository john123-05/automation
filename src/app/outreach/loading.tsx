export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-5 xl:grid-cols-[96px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-[34px] p-3">
          <div className="rounded-[26px] bg-slate-950 px-3 py-4" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-14 rounded-[22px] bg-white/70" />
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="glass-panel rounded-[38px] px-6 py-6 sm:px-8">
            <div className="h-4 w-40 rounded-full bg-white/70" />
            <div className="mt-4 h-10 w-full max-w-[760px] rounded-[22px] bg-white/70" />
            <div className="mt-3 h-4 w-full max-w-[620px] rounded-full bg-white/70" />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[24px] border border-line bg-white/78 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
              >
                <div className="h-3 w-24 rounded-full bg-slate-200" />
                <div className="mt-4 h-9 w-16 rounded-full bg-slate-200" />
                <div className="mt-4 h-3 w-28 rounded-full bg-slate-200" />
              </div>
            ))}
          </section>

          <section className="glass-panel rounded-[34px] p-6">
            <div className="h-4 w-24 rounded-full bg-white/70" />
            <div className="mt-4 h-9 w-full max-w-[420px] rounded-[18px] bg-white/70" />
            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-48 rounded-[24px] bg-white/75" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
