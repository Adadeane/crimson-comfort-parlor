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
  const [audioOn, setAudioOn] = useState(true);
  const [hasGesture, setHasGesture] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const oscRefs = useRef<{ stop: () => void }[]>([]);

  // Browsers block autoplay until the user interacts. Try to resume immediately;
  // if blocked, resume on the first user gesture so audio is effectively "on by default".
  useEffect(() => {
    const onGesture = () => {
      setHasGesture(true);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("scroll", onGesture);
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchstart", onGesture);
    window.addEventListener("scroll", onGesture, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("scroll", onGesture);
    };
  }, []);

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
    if (!audioOn || !hasGesture) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    audioRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // ---- Distortion node (dry at top, wet at bottom) ----
    const makeCurve = (amount: number) => {
      const n = 1024;
      const curve = new Float32Array(n);
      const k = amount * 100;
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    };
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeCurve(0);
    shaper.oversample = "4x";

    // Lowpass that closes as horror grows (muffles the cute melody → underwater dread)
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 8000;
    tone.Q.value = 1;

    // Pitch shifter via playbackRate isn't available on osc; we'll detune live instead.
    // Wet/dry mix for distortion
    const dryGain = ctx.createGain(); dryGain.gain.value = 1;
    const wetGain = ctx.createGain(); wetGain.gain.value = 0;

    const busIn = ctx.createGain();
    busIn.connect(dryGain).connect(tone).connect(master);
    busIn.connect(shaper).connect(wetGain).connect(tone);

    // ---- Cute melody: music-box-ish twinkle ----
    // C major pentatonic ascending/descending lullaby
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33];
    const melodyOscs: OscillatorNode[] = [];
    let melodyStep = 0;
    let lastNoteAt = 0;

    const playNote = (freq: number, when: number, p: number) => {
      // Two-osc bell: sine fundamental + soft triangle harmonic
      const o1 = ctx.createOscillator();
      o1.type = "sine";
      const o2 = ctx.createOscillator();
      o2.type = "triangle";
      const g = ctx.createGain();
      // Pitch drops as horror grows
      const pitchMul = 1 - p * 0.45;
      o1.frequency.value = freq * pitchMul;
      o2.frequency.value = freq * 2 * pitchMul;
      // Detune wobble grows with horror
      o1.detune.value = (Math.random() - 0.5) * p * 80;
      o2.detune.value = (Math.random() - 0.5) * p * 120;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.18, when + 0.01);
      // Sustain stretches as horror grows (notes smear together)
      const decay = 0.6 + p * 2.5;
      g.gain.exponentialRampToValueAtTime(0.001, when + decay);
      o1.connect(g);
      o2.connect(g);
      g.connect(busIn);
      o1.start(when); o2.start(when);
      o1.stop(when + decay + 0.05);
      o2.stop(when + decay + 0.05);
      melodyOscs.push(o1, o2);
    };

    // ---- Drones (silent at top, loud at bottom) ----
    const drone = ctx.createOscillator();
    drone.type = "sawtooth"; drone.frequency.value = 55;
    const drone2 = ctx.createOscillator();
    drone2.type = "sawtooth"; drone2.frequency.value = 56.7;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass"; droneFilter.frequency.value = 180;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0;
    drone.connect(droneFilter); drone2.connect(droneFilter);
    droneFilter.connect(droneGain).connect(master);
    drone.start(); drone2.start();

    // ---- High dissonant whine (only deep horror) ----
    const whine = ctx.createOscillator();
    whine.type = "sine"; whine.frequency.value = 1760;
    const whineGain = ctx.createGain(); whineGain.gain.value = 0;
    whine.connect(whineGain).connect(master);
    whine.start();

    let raf = 0;
    const tick = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = Math.max(0, Math.min(1, window.scrollY / h));
      const t = ctx.currentTime;

      // Subtle early unease: aligned to "You are not your skin" section (~25%), grows slowly
      const unease = Math.min(1, Math.max(0, (p - 0.22) / 0.3));
      // Main corruption curve: stays ~0 until 70% (later, since page is longer), then ramps up
      const corrupt = Math.pow(Math.max(0, (p - 0.7) / 0.3), 1.4);
      // Combined distortion amount — small wobble first, full chaos later
      const distAmt = Math.max(unease * 0.18, corrupt);

      // Distortion mix — gentle hint early, heavy late
      shaper.curve = makeCurve(distAmt);
      wetGain.gain.linearRampToValueAtTime(distAmt, t + 0.1);
      dryGain.gain.linearRampToValueAtTime(1 - distAmt * 0.5, t + 0.1);

      // Tone slightly muffles early, fully darkens late
      tone.frequency.linearRampToValueAtTime(8000 - unease * 1500 - corrupt * 5800, t + 0.1);
      tone.Q.linearRampToValueAtTime(1 + corrupt * 8, t + 0.1);

      // Drones swell only at the very end
      const droneAmt = Math.max(0, (p - 0.75) / 0.25);
      droneGain.gain.linearRampToValueAtTime(Math.pow(droneAmt, 1.4) * 0.45, t + 0.15);
      droneFilter.frequency.linearRampToValueAtTime(180 + droneAmt * 600, t + 0.15);

      // Whine only in deep horror
      whineGain.gain.linearRampToValueAtTime(p > 0.88 ? (p - 0.88) * 0.3 : 0, t + 0.1);
      whine.detune.value = Math.sin(t * 4) * corrupt * 50;

      // Melody scheduling: tempo stays cute until late
      const baseInterval = 0.42; // cute tempo
      const interval = baseInterval + corrupt * 1.4;
      if (t - lastNoteAt > interval) {
        let freq: number;
        if (p < 0.78) {
          freq = scale[melodyStep % scale.length];
          melodyStep++;
        } else {
          if (Math.random() < corrupt * 0.8) {
            freq = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.4 ? 0.5 : 1);
            if (Math.random() < corrupt * 0.6) freq *= 1.414;
          } else {
            freq = scale[melodyStep % scale.length];
            melodyStep++;
          }
        }
        playNote(freq, t + 0.02, corrupt);
        lastNoteAt = t;
      }

      // Heartbeat thumps only deep in horror
      if (p > 0.82 && Math.random() < 0.01 + corrupt * 0.05) {
        const thump = ctx.createOscillator();
        const tg = ctx.createGain();
        thump.frequency.value = 55;
        thump.type = "sine";
        tg.gain.setValueAtTime(0.45 * p, t);
        tg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        thump.connect(tg).connect(master);
        thump.start(t);
        thump.stop(t + 0.32);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    oscRefs.current = [{
      stop: () => {
        try { drone.stop(); drone2.stop(); whine.stop(); } catch { /* already stopped */ }
        melodyOscs.forEach(o => { try { o.stop(); } catch { /* noop */ } });
        ctx.close();
      },
    }];

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

      {/* SECTION 3.5 — OUR PHILOSOPHY (still cozy, faintly off) */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <p className="tracking-[0.4em] text-xs uppercase mb-6 opacity-70" style={{ color: "#a8745a" }}>our philosophy</p>
        <h2 style={{ fontFamily: "var(--font-display)" }} className="text-5xl md:text-6xl italic text-center max-w-3xl mb-10">
          You are not your skin.
        </h2>
        <div className="max-w-2xl space-y-6 text-lg leading-relaxed text-center" style={{ color: "#5a3322" }}>
          <p>For over a century, Petal &amp; Peel has helped clients shed the layer that no longer serves them.</p>
          <p>What remains underneath is softer. Pinker. More <em>honest</em>.</p>
          <p className="opacity-70 text-base">The discarded layer is composted in our garden. The roses do beautifully.</p>
        </div>
      </section>

      {/* SECTION 3.7 — THE RITUAL STEPS (cozy → unsettling) */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <h2 style={{ fontFamily: "var(--font-display)" }} className="text-5xl italic text-center mb-16">A Ritual in Five Movements</h2>
        <ol className="max-w-xl w-full space-y-8">
          {[
            { n: "I", title: "Welcome Tea", desc: "Chamomile, honey, a whisper of valerian. You will feel safe." },
            { n: "II", title: "Disrobing", desc: "Soft lighting. Folded linens. We do not watch." },
            { n: "III", title: "The First Touch", desc: "Warm oil along the spine. Your shoulders forget themselves." },
            { n: "IV", title: "The Loosening", desc: "Where the skin meets the meat, we listen. We wait. It lets go." },
            { n: "V", title: "Renewal", desc: "You will not remember leaving. You will return next month. You will." },
          ].map((s) => (
            <li key={s.n} className="flex gap-6 items-start">
              <span style={{ fontFamily: "var(--font-display)", color: "#a8745a" }} className="text-3xl italic shrink-0">{s.n}.</span>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", color: "#5a3322" }} className="text-xl italic mb-1">{s.title}</h3>
                <p className="text-sm opacity-80" style={{ color: "#5a3322" }}>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* SECTION 3.9 — FAQ (subtle dread building) */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <h2 style={{ fontFamily: "var(--font-display)" }} className="text-5xl italic text-center mb-12">Gentle Questions</h2>
        <div className="max-w-2xl w-full space-y-6">
          {[
            { q: "Will it hurt?", a: "Only at first. Then never again." },
            { q: "Can I bring a friend?", a: "We prefer you come alone. They understand. They always understand." },
            { q: "Is parking available?", a: "Yes — three spots behind the building. The fourth car never leaves." },
            { q: "Do you accept walk-ins?", a: "We knew you were coming. Your room is ready." },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(168,116,90,0.15)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", color: "#5a3322" }} className="text-xl italic mb-2">{f.q}</h3>
              <p className="text-sm opacity-80" style={{ color: "#5a3322" }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4 — TRANSITION (red bleeding in) */}
      {/* SECTION 3.92 — STAFF (cozy, slightly off) */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <p className="tracking-[0.4em] text-xs uppercase mb-6 opacity-70" style={{ color: "#a8745a" }}>your gentle hands</p>
        <h2 style={{ fontFamily: "var(--font-display)" }} className="text-5xl md:text-6xl italic text-center mb-16">Meet the Practitioners</h2>
        <div className="grid md:grid-cols-3 gap-10 max-w-5xl w-full">
          {[
            { name: "Mireille", role: "Lead Peeler", bio: "Twenty-two years with us. Has never aged. Smells faintly of lilac." },
            { name: "Otto", role: "Loosening Specialist", bio: "Trained in Vienna, then somewhere colder. Speaks softly. Hums while he works." },
            { name: "The Other One", role: "Apprentice", bio: "We do not ask her name. She prefers it that way. The clients adore her." },
          ].map((p) => (
            <div key={p.name} className="text-center">
              <div className="w-32 h-32 mx-auto mb-4 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #f3d9c8, #c89a7e)" }} />
              <h3 style={{ fontFamily: "var(--font-display)", color: "#5a3322" }} className="text-2xl italic">{p.name}</h3>
              <p className="text-xs tracking-widest mb-3 opacity-70" style={{ color: "#a8745a" }}>{p.role.toUpperCase()}</p>
              <p className="text-sm opacity-80" style={{ color: "#5a3322" }}>{p.bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3.94 — AMENITIES */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <h2 style={{ fontFamily: "var(--font-display)" }} className="text-5xl italic text-center mb-4">Little Comforts</h2>
        <p className="opacity-70 mb-16 text-center max-w-md">Every detail considered. Every door, locked from the outside — for your safety.</p>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl w-full">
          {[
            "Heated stone floors",
            "Single-origin chamomile",
            "Hand-stitched linen robes",
            "Soundproofed treatment rooms",
            "Private garden (do not enter)",
            "Complimentary aftercare salve",
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-4 p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(168,116,90,0.15)" }}>
              <span style={{ color: "#a8745a" }} className="text-xl">✦</span>
              <span style={{ color: "#5a3322" }}>{a}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3.96 — A LETTER FROM A CLIENT */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <p className="tracking-[0.4em] text-xs uppercase mb-6 opacity-70" style={{ color: "#a8745a" }}>received last tuesday</p>
        <h2 style={{ fontFamily: "var(--font-display)" }} className="text-4xl md:text-5xl italic text-center mb-12 max-w-2xl">A Letter, Unsigned</h2>
        <div className="max-w-xl space-y-5 text-lg leading-relaxed italic" style={{ color: "#5a3322", fontFamily: "var(--font-display)" }}>
          <p>Dearest Petal &amp; Peel,</p>
          <p>I do not recognize my reflection anymore, and I want to thank you.</p>
          <p>The new layer fits beautifully. It moves when I am still. It smiles when I am not.</p>
          <p>I will see you again on the seventh. Or perhaps you will see me first.</p>
          <p className="not-italic text-sm tracking-widest opacity-60" style={{ fontFamily: "var(--font-body)" }}>— a friend</p>
        </div>
      </section>

      {/* SECTION 3.98 — BOOKING (cozy, the moment of commitment) */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <h2 style={{ fontFamily: "var(--font-display)" }} className="text-5xl italic text-center mb-6">Reserve Your Layer</h2>
        <p className="opacity-70 mb-12 text-center max-w-md">We have one opening. It has your name on it. It always did.</p>
        <div className="max-w-md w-full space-y-4 p-8 rounded-3xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(168,116,90,0.2)" }}>
          <div>
            <label className="text-xs tracking-widest uppercase opacity-70" style={{ color: "#a8745a" }}>Your Name</label>
            <div className="mt-1 px-4 py-3 rounded-xl text-base" style={{ background: "rgba(255,255,255,0.7)", color: "#5a3322" }}>(we already have it)</div>
          </div>
          <div>
            <label className="text-xs tracking-widest uppercase opacity-70" style={{ color: "#a8745a" }}>Preferred Date</label>
            <div className="mt-1 px-4 py-3 rounded-xl text-base" style={{ background: "rgba(255,255,255,0.7)", color: "#5a3322" }}>tonight</div>
          </div>
          <div>
            <label className="text-xs tracking-widest uppercase opacity-70" style={{ color: "#a8745a" }}>Layer to Surrender</label>
            <div className="mt-1 px-4 py-3 rounded-xl text-base" style={{ background: "rgba(255,255,255,0.7)", color: "#5a3322" }}>all of it</div>
          </div>
          <button className="w-full mt-4 py-4 rounded-xl text-sm tracking-[0.3em] uppercase" style={{ background: "#5a3322", color: "#f8ede4" }}>
            Confirm Appointment
          </button>
          <p className="text-xs text-center opacity-60 italic" style={{ color: "#5a3322" }}>by clicking, you have already arrived.</p>
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
