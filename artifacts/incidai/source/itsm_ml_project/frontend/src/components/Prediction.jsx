import { useState } from "react";
import { motion } from "framer-motion";

const sampleResult = {
  incident: "-",
  confidence: 0,
  priority: "-",
  category: "-",
  resolution: "-"
};

export default function Prediction() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(sampleResult);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handlePredict = async () => {
    setError("");
    setLoading(true);

    const baseUrl = import.meta.env?.VITE_API_URL || "http://localhost:8000";
    const payload = { title: subject || "(no subject)", description: description || "" };

    try {
      const [mlRes, resolveRes] = await Promise.all([
        fetch(`${baseUrl}/predict/ml`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }),
        fetch(`${baseUrl}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, use_llm: false })
        })
      ]);

      if (!mlRes.ok) {
        const msg = await mlRes.text();
        throw new Error(msg || "Prediction failed");
      }

      if (!resolveRes.ok) {
        const msg = await resolveRes.text();
        throw new Error(msg || "Resolution failed");
      }

      const mlJson = await mlRes.json();
      const resolveJson = await resolveRes.json();

      setResult({
        incident: subject || "(no subject)",
        confidence: Math.round((mlJson.confidence || 0) * 100),
        priority: "-",
        category: resolveJson.predicted_category || mlJson.category || "-",
        resolution: resolveJson.resolution || "-"
      });
    } catch (e) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="glass rounded-3xl border border-white/50 p-8 shadow-glass">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate/60">
              Prediction Interface
            </p>
            <h3 className="font-display text-2xl font-semibold text-slate">
              Run a live incident prediction.
            </h3>
          </div>
          <span className="rounded-full bg-mint/20 px-3 py-1 text-xs font-semibold text-slate">Live</span>
        </div>
        <form className="mt-6 flex flex-col gap-5">
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate/60">
              Subject
            </label>
            <textarea
              rows={4}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Example: Intermittent packet loss on core switch..."
              className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate shadow-glass focus:border-mint focus:ring-mint"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate/60">
              Ticket Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail"
              className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate shadow-glass focus:border-mint focus:ring-mint"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate/60">
              Category
            </label>
            <select className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate shadow-glass focus:border-mint focus:ring-mint">
              <option>Infrastructure</option>
              <option>Security</option>
              <option>Applications</option>
              <option>Service Desk</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handlePredict}
            className="mt-2 rounded-full bg-gradient-to-r from-mint via-lavender to-sunshine px-6 py-3 text-sm font-semibold text-slate shadow-glow transition hover:-translate-y-0.5"
          >
            {loading ? "Predicting..." : "Predict"}
          </button>
          {error && (
            <div className="mt-4 rounded-2xl bg-coral/15 px-4 py-3 text-sm text-slate/80 shadow-glass">
              {error}
            </div>
          )}
        </form>
      </div>

      <div className="glass-strong rounded-3xl border border-white/50 p-8 shadow-glass">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate/60">Prediction Result</p>
            <h3 className="font-display text-2xl font-semibold text-slate">AI Response</h3>
          </div>
          <span className="rounded-full bg-lavender/30 px-3 py-1 text-xs font-semibold text-slate">ML Core</span>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-glass">
            <p className="text-xs uppercase tracking-[0.2em] text-slate/60">Predicted Incident</p>
            <p className="text-base font-semibold text-slate">{result.incident}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-glass">
            <p className="text-xs uppercase tracking-[0.2em] text-slate/60">Suggested Priority</p>
            <p className="text-base font-semibold text-slate">{result.priority}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-glass">
            <p className="text-xs uppercase tracking-[0.2em] text-slate/60">Suggested Resolution</p>
            <p className="text-sm text-slate/80 whitespace-pre-line">{result.resolution}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/80 p-4 shadow-glass">
            <div
              className="relative flex h-24 w-24 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#3EB489 ${result.confidence}%, rgba(62, 180, 137, 0.15) 0)`
              }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-lg font-semibold text-slate">
                {result.confidence}%
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate/60">Confidence</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 shadow-glass">
            <p className="text-xs uppercase tracking-[0.2em] text-slate/60">Category Confidence</p>
            <p className="text-base font-semibold text-slate">{result.category}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-mint/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${result.confidence}%` }}
                transition={{ duration: 1.2 }}
                className="h-full rounded-full bg-gradient-to-r from-mint via-lavender to-sunshine"
              />
            </div>
            <p className="mt-2 text-xs text-slate/60">AI probability distribution</p>
          </div>
        </div>

        {loading && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate/70 shadow-glass">
            <span className="h-3 w-3 animate-pulse rounded-full bg-mint" />
            Running predictive ensemble... analyzing signals.
          </div>
        )}
      </div>
    </div>
  );
}