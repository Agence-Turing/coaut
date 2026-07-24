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

export default Wave;
