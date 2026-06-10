"use client";

import { motion } from "framer-motion";
import { BrandSwitcher } from "@/components/BrandSwitcher";
import { HostMockup } from "@/components/HostMockup";
import { ScriptedAgent } from "@/components/ScriptedAgent";
import { editScript, embeddedScript, revenueScript } from "@/lib/scripts";

/** Apple-grade settle — pause, then let the page exhale. */
const SETTLE = { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const };

export default function Home() {
  return (
    <>
      {/* HERO — one headline, one subhead. Hold 400ms then exhale. */}
      <section className="relative">
        <div className="aurora pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 pt-28 sm:pt-44">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SETTLE, delay: 0.4 }}
            className="font-display text-[64px] font-bold leading-[0.96] tracking-[-0.04em] sm:text-[112px]"
          >
            Software
            <br />
            you describe.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SETTLE, delay: 0.7 }}
            className="mt-8 max-w-md text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]"
          >
            An AI-native framework. Open source. MIT.
          </motion.p>
        </div>

        {/* Live agent demo — full-bleed within the page width, no chrome. */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SETTLE, delay: 1.0, duration: 1.3 }}
          className="mx-auto mt-24 max-w-6xl px-6 sm:mt-32"
        >
          <ScriptedAgent
            scripts={[revenueScript, editScript]}
            loop
            startDelay={1400}
            className="rounded-3xl border border-border bg-card/40 p-8 shadow-[0_40px_80px_-30px_hsl(var(--primary)/0.15)] backdrop-blur-sm sm:p-12"
          />
        </motion.div>
      </section>

      {/* ACT 1 — one sentence. */}
      <section className="mx-auto max-w-6xl px-6 pt-56 sm:pt-64">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={SETTLE}
          className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[72px]"
        >
          It composes itself
          <br />
          <span className="text-foreground/45">in three seconds.</span>
        </motion.h2>
      </section>

      {/* ACT 2 — in your design system. */}
      <section className="mx-auto max-w-6xl px-6 pt-56 sm:pt-72">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={SETTLE}
          className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[72px]"
        >
          In your
          <br />
          <span className="text-foreground/45">design system.</span>
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ ...SETTLE, delay: 0.15 }}
          className="mt-16"
        >
          <BrandSwitcher />
        </motion.div>
      </section>

      {/* ACT 3 — embedded inside your app. */}
      <section className="mx-auto max-w-6xl px-6 pt-56 sm:pt-72">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={SETTLE}
          className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[72px]"
        >
          Inside your
          <br />
          <span className="text-foreground/45">existing app.</span>
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ ...SETTLE, delay: 0.15 }}
          className="mt-16"
        >
          <HostMockup>
            <ScriptedAgent
              scripts={[embeddedScript]}
              loop
              startDelay={1200}
            />
          </HostMockup>
        </motion.div>
      </section>

      {/* CLOSING — typography on whitespace. No card. No aurora. */}
      <section className="mx-auto max-w-6xl px-6 pb-40 pt-56 sm:pt-72">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={SETTLE}
          className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[72px]"
        >
          Available now.
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ ...SETTLE, delay: 0.15 }}
          className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center"
        >
          <code className="rounded-md border border-border bg-card/60 px-4 py-3 font-mono text-[14px] text-foreground">
            pnpm add @autogen-ui/core
          </code>
          <a
            href="https://github.com/mosnin/autogen-ui"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] text-muted-foreground transition-colors hover:text-foreground"
          >
            View on GitHub →
          </a>
        </motion.div>
      </section>
    </>
  );
}
