import { motion } from "framer-motion";

const PulseIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
    <path
      d="M3 12h4l2-6 4 12 2-6h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TicketIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
    <path
      d="M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2a2 2 0 0 0 0 4v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M9 9h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M9 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AnalyticsIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
    <path d="M5 19V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M19 19v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const features = [
  {
    title: "Incident Prediction",
    description: "Forecast anomalies before they escalate with multi-signal AI awareness.",
    icon: PulseIcon
  },
  {
    title: "Ticket Priority Classification",
    description: "Auto-assign urgency, category, and routing with ML-verified confidence.",
    icon: TicketIcon
  },
  {
    title: "Real-Time AI Analytics",
    description: "Monitor live patterns and operational health across every service layer.",
    icon: AnalyticsIcon
  }
];

export default function Features() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate/60">
          Capabilities
        </p>
        <h2 className="font-display text-3xl font-semibold text-slate sm:text-4xl">
          AI features for modern IT teams.
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            whileHover={{ y: -6 }}
            className="glass group flex h-full flex-col gap-4 rounded-3xl border border-white/50 p-6 shadow-glass transition"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-xl shadow-glass">
              {feature.icon}
            </div>
            <h3 className="text-lg font-semibold text-slate">{feature.title}</h3>
            <p className="text-sm text-slate/70">{feature.description}</p>
            <span className="mt-auto text-xs font-semibold uppercase tracking-[0.2em] text-slate/60">
              Explore
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}