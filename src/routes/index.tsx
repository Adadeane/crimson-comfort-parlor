import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import spaCozy from "@/assets/spa-cozy.jpg";
import handsMassage from "@/assets/hands-massage.jpg";
import skinwalker from "@/assets/skinwalker.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

// Cozy spa → horror scroll experience.
// Scroll progress (0..1) drives color, type, and atmosphere.
function Index() {
  const [progress, setProgress] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const oscRefs = useRef<{ stop: () => void }[]>([]);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(Math.max(0, Math.min(1, window.scrollY / h)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Procedural horror audio that intensifies with scroll
  useEffect(() => {
    if (!audioOn) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    audioRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Low drone
    const drone = ctx.createOscillator();
    drone.type = "sawtooth";
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.15;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    drone.connect(filter).connect(droneGain).connect(master);
    drone.start();

    // Detuned second drone
    const drone2 = ctx.createOscillator();
    drone2.type = "sawtooth";
    drone2.frequency.value = 56.7;
    drone2.connect(filter);
    drone2.start();

    // High dissonant whine
    const whine = ctx.createOscillator();
    whine.type = "sine";
    whine.frequency.value = 1760;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.02;
    whine.connect(whineGain).connect(master);
    whine.start();

    oscRefs.current = [
      { stop: () => { drone.stop(); drone2.stop(); whine.stop(); ctx.close(); } },
    ];

    // Animation loop tied to scroll
    let raf = 0;
    const tick = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = Math.max(0, Math.min(1, window.scrollY / h));
      const t = ctx.currentTime;
      master.gain.linearRampToValueAtTime(Math.pow(p, 1.5) * 0.6, t + 0.1);
      filter.frequency.linearRampToValueAtTime(150 + p * 800, t + 0.1);
      whineGain.gain.linearRampToValueAtTime(p > 0.7 ? (p - 0.7) * 0.25 : 0, t + 0.1);
      // Random heartbeat thumps in horror zone
      if (p > 0.5 && Math.random() < 0.02 + p * 0.05) {
        const thump = ctx.createOscillator();
        const tg = ctx.createGain();
        thump.frequency.value = 60;
        thump.type = "sine";
        tg.gain.setValueAtTime(0.4 * p, t);
        tg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        thump.connect(tg).connect(master);
        thump.start(t);
        thump.stop(t + 0.25);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      oscRefs.current.forEach(o => o.stop());
    };
  }, [audioOn]);

  // Color interpolation
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const bgHue = lerp(35, 0, Math.min(1, progress * 1.2));
  const bgSat = lerp(40, 90, progress);
  const bgLight = lerp(96, 4, Math.pow(progress, 1.3));
  const textLight = progress > 0.6 ? lerp(20, 95, (progress - 0.6) / 0.4) : 20;

  const horror = progress > 0.75;

  return (
    <div
      style={{
        backgroundColor: `hsl(${bgHue}, ${bgSat}%, ${bgLight}%)`,
        color: `hsl(${bgHue}, 30%, ${textLight}%)`,
        fontFamily: "var(--font-body)",
        transition: "background-color 0.3s linear, color 0.3s linear",
      }}
      className="min-h-screen overflow-x-hidden relative"
    >
      {/* Audio toggle */}
      <button
        onClick={() => setAudioOn(v => !v)}
        className="fixed top-4 right-4 z-50 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border"
        style={{
          background: progress > 0.5 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.7)",
          color: progress > 0.5 ? "#fff" : "#3a2a20",
          borderColor: progress > 0.5 ? "rgba(255,0,0,0.4)" : "rgba(0,0,0,0.1)",
        }}
      >
        {audioOn ? "🔊 sound on" : "🔈 enable sound"}
      </button>

      {/* Progress indicator */}
      <div className="fixed top-0 left-0 right-0 h-0.5 z-50" style={{ background: "rgba(0,0,0,0.05)" }}>
        <div className="h-full transition-all" style={{ width: `${progress * 100}%`, background: `hsl(${lerp(20, 0, progress)}, 80%, ${lerp(60, 40, progress)}%)` }} />
      </div>

      {/* SECTION 1 — COZY HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
        <p className="tracking-[0.4em] text-xs uppercase mb-6 opacity-70" style={{ color: "#a8745a" }}>est. 1888 — by appointment only</p>
        <h1
          style={{ fontFamily: "var(--font-display)", color: "#5a3322" }}
          className="text-6xl md:text-8xl font-normal italic leading-tight max-w-4xl"
        >
          Petal <span className="not-italic">&</span> Peel
        </h1>
        <p className="mt-6 max-w-md text-lg" style={{ color: "#7a5a48" }}>
          A boutique skin-ripping parlor. Where renewal begins beneath the surface.
        </p>
        <img
          src={spaCozy}
          alt="Cozy spa interior"
          width={1536}
          height={1024}
          className="mt-12 rounded-3xl shadow-2xl max-w-3xl w-full animate-breathe"
          style={{ boxShadow: "0 30px 80px -20px rgba(168,116,90,0.4)" }}
        />
        <p className="mt-16 text-sm tracking-widest opacity-60 animate-float-soft">scroll to begin your ritual ↓</p>
      </section>

      {/* SECTION 2 — SERVICES (still cozy) */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <h2 style={{ fontFamily: "var(--font-display)", color: progress < 0.3 ? "#5a3322" : undefined }} className="text-5xl md:text-6xl italic mb-4 text-center">Our Rituals</h2>
        <p className="opacity-70 mb-16 text-center max-w-md">Gentle peels. Tender removal. Deeply restorative.</p>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl w-full">
          {[
            { title: "The Lavender Peel", desc: "A gentle 60-minute first layer ritual. Includes warm towels and chamomile tea.", price: "$120" },
            { title: "Rose Renewal", desc: "Deep tissue strip with rose petal compress. For sensitive flesh.", price: "$220" },
            { title: "The Full Surrender", desc: "Complete dermal liberation. Wear something easy to remove. Stay overnight.", price: "$888" },
          ].map((s, i) => (
            <div key={i} className="rounded-3xl p-8 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(168,116,90,0.15)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", color: "#5a3322" }} className="text-2xl italic mb-3">{s.title}</h3>
              <p className="text-sm opacity-80 mb-6" style={{ color: "#5a3322" }}>{s.desc}</p>
              <p className="text-xs tracking-widest" style={{ color: "#a8745a" }}>FROM {s.price}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 — TESTIMONIALS (slight unease) */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <img src={handsMassage} alt="Gentle hands" width={1024} height={1024} loading="lazy" className="rounded-full w-64 h-64 object-cover shadow-xl mb-12" />
        <h2 style={{ fontFamily: "var(--font-display)" }} className="text-5xl italic mb-12 text-center">They came back lighter.</h2>
        <div className="max-w-2xl space-y-10 text-center">
          <blockquote className="text-2xl italic" style={{ fontFamily: "var(--font-display)" }}>
            "I left a piece of myself there. I think about it every night."
            <footer className="text-xs tracking-widest mt-3 opacity-60 not-italic">— MARGOT, RETURNING CLIENT</footer>
          </blockquote>
          <blockquote className="text-2xl italic" style={{ fontFamily: "var(--font-display)" }}>
            "The receptionist knew my middle name. I never told her."
            <footer className="text-xs tracking-widest mt-3 opacity-60 not-italic">— ELEANOR, SECOND VISIT</footer>
          </blockquote>
        </div>
      </section>

      {/* SECTION 4 — TRANSITION (red bleeding in) */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24 relative">
        {/* Drips */}
        {progress > 0.45 && (
          <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{
                position: "absolute",
                left: `${i * 8.5}%`,
                top: 0,
                width: "3px",
                height: `${30 + (i * 17) % 80}px`,
                background: "linear-gradient(to bottom, transparent, #5a0000)",
                opacity: Math.min(1, (progress - 0.45) * 3),
              }} />
            ))}
          </div>
        )}
        <h2 style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }} className="text-5xl md:text-7xl text-center max-w-3xl mb-8">
          We don't{" "}
          <span style={{ textDecoration: progress > 0.5 ? "line-through" : "none" }}>refund</span>{" "}
          return what we take.
        </h2>
        <p className="opacity-70 max-w-md text-center">Once given, your skin belongs to the parlor. This is in our gentle terms of service. You signed it. Of course you did.</p>
      </section>

      {/* SECTION 5 — DESCENT */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <h2 style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }} className={`text-6xl md:text-8xl text-center max-w-4xl ${progress > 0.65 ? "animate-flicker" : ""}`}>
          do you hear them<br />
          <span style={{ color: "#8b0000" }}>under the floor?</span>
        </h2>
        <p className="mt-12 text-center max-w-md opacity-80 italic">that's just the heating. that's just the heating. that's just the heating.</p>
      </section>

      {/* SECTION 6 — FINAL HORROR */}
      <section className={`min-h-screen flex flex-col items-center justify-center px-6 py-24 relative ${horror ? "animate-shake" : ""}`}>
        <img
          src={skinwalker}
          alt=""
          width={1024}
          height={1536}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: Math.max(0, (progress - 0.7) / 0.3),
            filter: `contrast(${100 + progress * 40}%) saturate(${50 + progress * 100}%)`,
          }}
        />
        <div className="absolute inset-0" style={{
          background: `radial-gradient(circle at center, transparent 30%, hsl(0, 90%, ${lerp(10, 2, progress)}%) 100%)`,
          opacity: Math.max(0, (progress - 0.75) / 0.25),
        }} />

        <div className="relative z-10 text-center">
          <h2
            className={horror ? "animate-flicker" : ""}
            style={{
              fontFamily: "var(--font-scary)",
              fontSize: "clamp(3rem, 14vw, 11rem)",
              color: "#fff",
              textShadow: "0 0 40px #8b0000, 0 0 80px #ff0000, 4px 4px 0 #2a0000",
              lineHeight: 0.9,
              letterSpacing: "0.02em",
              opacity: Math.max(0, (progress - 0.8) / 0.2),
            }}
          >
            GIVE ME<br />YOUR SKIN
          </h2>
          <p
            className="mt-12 tracking-widest"
            style={{
              color: "#ff3030",
              fontFamily: "var(--font-scary)",
              fontSize: "1.5rem",
              opacity: Math.max(0, (progress - 0.9) / 0.1),
              textShadow: "0 0 20px #8b0000",
            }}
          >
            you booked the appointment.
          </p>
        </div>

        {/* Vignette / scratches */}
        {horror && (
          <div className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{
            background: "repeating-linear-gradient(95deg, transparent 0, transparent 3px, rgba(255,0,0,0.1) 3px, rgba(255,0,0,0.1) 4px)",
          }} />
        )}
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-xs tracking-widest" style={{ color: progress > 0.7 ? "#5a0000" : "#a8745a", fontFamily: "var(--font-scary)" }}>
        PETAL & PEEL — NO REFUNDS — NO ESCAPE
      </footer>
    </div>
  );
}
