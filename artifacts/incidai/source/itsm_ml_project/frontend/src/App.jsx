import { motion } from "framer-motion";
import Navbar from "./components/Navbar.jsx";
import Hero from "./components/Hero.jsx";
import Features from "./components/Features.jsx";
import Prediction from "./components/Prediction.jsx";
import Dashboard from "./components/Dashboard.jsx";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
};

export default function App() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute -top-24 right-[-140px] h-80 w-80 rounded-full bg-lavender/40 blur-3xl" />
      <div className="absolute top-56 left-[-120px] h-72 w-72 rounded-full bg-mint/30 blur-3xl" />
      <div className="absolute bottom-0 right-[-80px] h-64 w-64 rounded-full bg-sunshine/40 blur-3xl" />

      <Navbar />

      <main className="mx-auto flex max-w-6xl flex-col gap-24 px-6 pb-24 pt-10 lg:px-8">
        <motion.section variants={fadeUp} initial="hidden" animate="show">
          <Hero />
        </motion.section>

        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
          <Features />
        </motion.section>

        <motion.section id="prediction" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
          <Prediction />
        </motion.section>

        <motion.section id="dashboard" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
          <Dashboard />
        </motion.section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 pb-14 text-center text-sm text-slate/70">
        <span className="font-semibold">ITSM AI Prediction Suite</span>
      </footer>
    </div>
  );
}