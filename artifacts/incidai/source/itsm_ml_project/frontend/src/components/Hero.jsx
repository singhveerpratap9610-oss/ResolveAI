import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const orbit = {
  animate: {
    rotate: 360,
    transition: { repeat: Infinity, duration: 30, ease: "linear" }
  }
};

export default function Hero() {
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const baseUrl = import.meta.env?.VITE_API_URL || "http://localhost:8000";

    Promise.all([
      fetch(`${baseUrl}/stats`, { signal: controller.signal }).then((res) => (res.ok ? res.json() : null)),
      fetch(`${baseUrl}/dashboard`, { signal: controller.signal }).then((res) => (res.ok ? res.json() : null))
    ])
      .then(([statsData, dashboardData]) => {
        if (statsData) setStats(statsData);
        if (dashboardData) setDashboard(dashboardData);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const liveInsights = (dashboard?.category_distribution || []).slice(0, 3);

  const handleTryPrediction = () => {
    const el = document.getElementById("prediction");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate/70 shadow-glass">
          AI Forecasting Layer
        </span>
        <h1 className="font-display text-4xl font-semibold leading-tight text-slate sm:text-5xl lg:text-6xl">
          Predict IT Incidents Before They Happen.
        </h1>
        <p className="max-w-xl text-base text-slate/70 sm:text-lg">
          AI-powered predictive intelligence for smarter IT operations. Get ahead of incidents,
          optimize ticket routing, and keep service levels effortless.
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={handleTryPrediction}
            className="rounded-full bg-gradient-to-r from-mint via-lavender to-sunshine px-6 py-3 text-sm font-semibold text-slate shadow-glow transition hover:-translate-y-0.5"
          >
            Try Prediction
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate/60">
          <div>
            <p className="text-sm font-semibold text-slate">{stats ? stats.total_tickets.toLocaleString() : "-"}</p>
            <p>Total tickets in dataset</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate">{stats ? stats.categories_count : "-"}</p>
            <p>Service categories</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate">{stats ? stats.resolved_tickets.toLocaleString() : "-"}</p>
            <p>Resolved tickets available</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="glass-strong relative overflow-hidden rounded-[32px] p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-lavender/30" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate/60">Live Insight</p>
                <p className="text-xl font-semibold text-slate">Incident Pulse</p>
              </div>
              <span className="rounded-full bg-mint/20 px-3 py-1 text-xs font-semibold text-slate">Live</span>
            </div>
            <div className="grid gap-4">
              {(liveInsights.length ? liveInsights : [{ name: "-", value: "-" }, { name: "-", value: "-" }, { name: "-", value: "-" }]).map(
                (entry) => (
                <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate">{entry.name}</p>
                    <p className="text-xs text-slate/60">Share of ticket volume</p>
                  </div>
                  <div className="text-sm font-semibold text-slate">{typeof entry.value === "number" ? `${entry.value}%` : entry.value}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-mint" />
              <p className="text-xs text-slate/60">Live dataset insights</p>
            </div>
          </div>
        </div>

        <motion.div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full border border-white/50 bg-white/40 blur-sm"
          variants={orbit}
          animate="animate"
        />
        <div className="pointer-events-none absolute -bottom-10 left-6 h-24 w-24 rounded-full bg-coral/40 blur-2xl" />
        <div className="pointer-events-none absolute -top-6 left-20 h-10 w-10 rounded-full bg-mint/50" />
      </div>
    </div>
  );
}