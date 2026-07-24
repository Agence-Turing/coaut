const WAVE_PATH =
  "M1000 0v48.568c-181.438 26.517-338.45-105.36-500.355 0C337.741-56.792 180.729 75.085 0 48.568V0h1000Z";

function Wave({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 52.176"
      preserveAspectRatio="none"
      aria-hidden
      className={`block w-full ${flip ? "-scale-y-100" : ""} ${className}`}
    >
      <path d={WAVE_PATH} fill="currentColor" />
    </svg>
  );
}

/** Bande décorative sombre aux bords ondulés, posée entre deux sections claires. */
export function WaveBand({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`text-ink ${className}`}>
      <Wave flip className="h-10 md:h-14 -mb-px" />
      <Wave className="h-10 md:h-14 -scale-x-100" />
    </div>
  );
}

export default Wave;
