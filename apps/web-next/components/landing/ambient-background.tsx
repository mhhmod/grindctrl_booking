/* Ambient page background: three slow-drifting colour fields behind the
   whole page. Pure CSS so there is no scroll listener and no React work
   per frame. See .gc-aurora in globals.css for the performance contract:
   fixed layer, transform and opacity only, static blur, reduced-motion safe. */
import * as React from 'react';

export function AmbientBackground() {
  return (
    <div className="gc-aurora" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
