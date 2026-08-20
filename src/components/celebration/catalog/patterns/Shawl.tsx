"use client";

const SHAWL_BASE = "#d63b2f";
const SHAWL_TRIM = "#e0a934";
const PETAL = "#fff8ec";

/** One of CelebrationModal's randomized scenarios: a Pavlovo Posad-style
 * floral shawl unfurling — a rotated square scaling out from its center,
 * with a small flower motif (same petal shapes as MatryoshkaMark's apron)
 * fading in on top once it settles. */
export default function Shawl() {
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="shawl-unfurl relative" style={{ width: 72, height: 72, background: SHAWL_BASE, transform: "rotate(45deg)" }}>
        <span className="absolute" style={{ inset: 6, border: `2px solid ${SHAWL_TRIM}` }} />
        <span className="khokhloma-petal absolute rounded-full" style={{ width: 12, aspectRatio: "1", top: "20%", left: "50%", marginLeft: -6, background: PETAL, animationDelay: "0.3s" }} />
        <span className="khokhloma-petal absolute rounded-full" style={{ width: 12, aspectRatio: "1", top: "50%", left: "78%", marginTop: -6, background: PETAL, animationDelay: "0.4s" }} />
        <span className="khokhloma-petal absolute rounded-full" style={{ width: 12, aspectRatio: "1", top: "78%", left: "50%", marginLeft: -6, background: PETAL, animationDelay: "0.5s" }} />
        <span className="khokhloma-petal absolute rounded-full" style={{ width: 12, aspectRatio: "1", top: "50%", left: "22%", marginTop: -6, background: PETAL, animationDelay: "0.6s" }} />
        <span className="khokhloma-petal absolute rounded-full" style={{ width: 14, aspectRatio: "1", top: "50%", left: "50%", marginLeft: -7, marginTop: -7, background: SHAWL_TRIM, animationDelay: "0.7s" }} />
      </div>
    </div>
  );
}
