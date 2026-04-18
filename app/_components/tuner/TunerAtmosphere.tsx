/**
 * Tuner v1 — atmosphere layer
 * Grain overlay (DESIGN.md §1) + 2-3 drifting gold orbs behind the panel.
 * Disabled under prefers-reduced-motion via tuner.css @media query.
 */
export function TunerAtmosphere() {
  return (
    <>
      <div className="tuner-grain" aria-hidden="true" />
      <div className="tuner-orb tuner-orb-a" aria-hidden="true" />
      <div className="tuner-orb tuner-orb-b" aria-hidden="true" />
      <div className="tuner-orb tuner-orb-c" aria-hidden="true" />
    </>
  )
}
