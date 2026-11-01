import "./styles/loading/loading.css";

const STRIPE_COUNT = 42;
const STRIPE_WIDTHS = [5, 6, 8, 10, 14, 16, 18];

// Deterministic pseudo-random generator (not Math.random) so the
// server-rendered markup and the client's first render match
// exactly — Next.js would otherwise flag a hydration mismatch.
function seededFraction(seed) {
  const x = Math.sin(seed * 999.7) * 43758.5453;
  return x - Math.floor(x);
}

// Every stripe is fully described here: where it sits, how wide
// and faint it is, how fast it moves, and — critically — which
// direction it flows. Direction strictly alternates by index, so
// there is never a stripe left ambiguous or idle.
const stripes = Array.from({ length: STRIPE_COUNT }, (_, i) => {
  const left = -6 + (112 / (STRIPE_COUNT - 1)) * i; // spread edge-to-edge, a bit past both sides
  const width = STRIPE_WIDTHS[i % STRIPE_WIDTHS.length];
  const opacity = 0.08 + seededFraction(i) * 0.24;
  const duration = 2.4 + seededFraction(i + 0.37) * 2.1; // 2.4s – 4.5s, fast + continuous
  const delay = -(seededFraction(i + 0.71) * duration); // phase-staggered, never clumped
  const direction = i % 2 === 0 ? "up" : "down";

  return {
    key: i,
    direction,
    style: {
      "--left": `${left}%`,
      "--w": `${width}px`,
      "--op": opacity,
      "--dur": `${duration.toFixed(2)}s`,
      "--delay": `${delay.toFixed(2)}s`,
    },
  };
});

export default function Loading() {
  return (
    <div className="home-loading" role="status" aria-live="polite" aria-label="Loading">
      <div className="home-loading__stripes">
        {stripes.map((s) => (
          <span
            key={s.key}
            className={`home-loading__stripe home-loading__stripe--${s.direction}`}
            style={s.style}
          />
        ))}
      </div>

      <div className="home-loading__center">
        <div className="home-loading__mark">VSR</div>
        <span className="home-loading__text">Loading</span>
      </div>
    </div>
  );
}