export function ScreenLoader() {
  return (
    <div className="grid h-full place-items-center" role="progressbar" aria-label="Loading">
      <div className="h-12 w-12 animate-spin rounded-full ring-aurora [mask:radial-gradient(farthest-side,transparent_calc(100%-4px),#000_calc(100%-3px))]" />
    </div>
  );
}
