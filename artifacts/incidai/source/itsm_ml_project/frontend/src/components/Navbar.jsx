export default function Navbar() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-mint via-lavender to-sunshine p-[2px] shadow-glass">
          <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-white/70 text-lg font-semibold text-slate">
            AI
          </div>
        </div>
        <div>
          <p className="font-semibold text-slate">Predictive ITSM</p>
          <p className="text-xs text-slate/60">AI Operations Suite</p>
        </div>
      </div>
      <nav className="hidden items-center gap-8 text-sm font-medium text-slate/80 md:flex">
        <a className="transition hover:text-slate" href="#prediction">Prediction</a>
        <a className="transition hover:text-slate" href="#dashboard">Dashboard</a>
      </nav>
      <button className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm shadow-glass transition hover:-translate-y-0.5 md:hidden">
        Menu
      </button>
    </header>
  );
}