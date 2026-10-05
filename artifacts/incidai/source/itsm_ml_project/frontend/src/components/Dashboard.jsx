import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const baseUrl = import.meta.env?.VITE_API_URL || "http://localhost:8000";

    fetch(`${baseUrl}/dashboard`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setDashboardData(data);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const kpis = dashboardData?.kpis || [];
  const incidentData = dashboardData?.incidents_over_time || [];
  const categoryData = dashboardData?.category_distribution || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate/60">Dashboard</p>
        <h2 className="font-display text-3xl font-semibold text-slate sm:text-4xl">
          Operational visibility with AI-enhanced clarity.
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="glass rounded-3xl border border-white/50 p-6 shadow-glass">
            <p className="text-xs uppercase tracking-[0.2em] text-slate/60">{kpi.label}</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-2xl font-semibold text-slate">
                {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-3xl border border-white/50 p-6 shadow-glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate/60">Incidents Over Time</p>
              <h3 className="text-lg font-semibold text-slate">Weekly Forecast</h3>
            </div>
            <span className="rounded-full bg-lavender/30 px-3 py-1 text-xs font-semibold text-slate">Live</span>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={incidentData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(47, 58, 58, 0.1)" />
                <XAxis dataKey="name" stroke="#2F3A3A" tick={{ fontSize: 12 }} />
                <YAxis stroke="#2F3A3A" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(255,255,255,0.85)",
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.6)"
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="#3EB489" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-3xl border border-white/50 p-6 shadow-glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate/60">Ticket Categories</p>
              <h3 className="text-lg font-semibold text-slate">Distribution</h3>
            </div>
            <span className="rounded-full bg-sunshine/40 px-3 py-1 text-xs font-semibold text-slate">Updated</span>
          </div>
          <div className="mt-6 flex h-64 flex-col items-center justify-center gap-6">
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={6}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid gap-2 text-xs text-slate/60">
              {categoryData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                  <span>{entry.name}</span>
                  <span className="ml-auto font-semibold text-slate">{entry.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}