import { AppNavigation, type AppRoute } from "./AppNavigation";

type Props = {
  current: AppRoute;
  className?: string;
};

export function AppHeader({ current, className = "" }: Props) {
  return (
    <header className={`app-header ${className}`.trim()}>
      <div className="brand-lockup">
        <div>
          <p className="eyebrow">digital fashion smart mirror</p>
          <h1>MimickMe™</h1>
        </div>
      </div>
      <AppNavigation current={current} />
    </header>
  );
}
