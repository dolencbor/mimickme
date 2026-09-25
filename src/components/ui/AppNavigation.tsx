import Link from "next/link";

export type AppRoute = "model" | "mirror" | "hologram";

const APP_ROUTES: ReadonlyArray<{ href: string; label: string; route: AppRoute }> = [
  { href: "/", label: "Model", route: "model" },
  { href: "/mirror", label: "Mirror", route: "mirror" },
  { href: "/hologram", label: "Hologram", route: "hologram" },
];

export function AppNavigation({ current }: { current: AppRoute }) {
  return (
    <nav className="app-navigation" aria-label="Primary navigation">
      {APP_ROUTES.map(({ href, label, route }) => {
        const isCurrent = route === current;
        return (
          <Link
            key={route}
            className={`nav-link ${isCurrent ? "active" : ""}`}
            href={href}
            aria-current={isCurrent ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
