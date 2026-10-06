/** Share → Add to Home Screen, the only way to install on an iPhone. */
export function IosSteps() {
  const share = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-3px]" aria-label="Share">
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
  const add = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="inline-block align-[-3px]" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
  return (
    <ol className="space-y-3 text-left">
      {[
        <>Open this site in <strong className="text-fg">Safari</strong>.</>,
        <>Tap the Share button {share} at the bottom of the screen.</>,
        <>Scroll down and tap <strong className="text-fg">Add to Home Screen</strong> {add}.</>,
        <>Tap <strong className="text-fg">Add</strong>. The Coastline Prints icon appears on your home screen.</>,
      ].map((step, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
