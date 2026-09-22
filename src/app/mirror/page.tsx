import Link from "next/link";

export default function MirrorPage() {
  return (
    <main className="route-placeholder">
      <p className="eyebrow">SMART MIRROR</p>
      <h1>Body tracking arrives in Phase 2.</h1>
      <p>The model setup and validation flow is available on the landing page.</p>
      <Link className="button secondary" href="/">Return to model setup</Link>
    </main>
  );
}
