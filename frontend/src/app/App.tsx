import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router";

import { HistoryPage } from "../features/history/HistoryPage";
import {
  loadTheme,
  saveTheme,
  type ThemeName,
} from "../features/typing/storage";
import { AccountDialog } from "../features/account/AccountDialog";
import { AuthProvider } from "../features/account/AuthProvider";
import { useAuth } from "../features/account/auth-context";
import { TypingPage } from "../features/typing/TypingPage";

const THEMES: readonly ThemeName[] = ["paper", "nocturne", "tide"];

function AppFrame() {
  const [theme, setTheme] = useState<ThemeName>(loadTheme);
  const [accountOpen, setAccountOpen] = useState(false);
  const auth = useAuth();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
    const themeColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--canvas")
      .trim();
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColor);
  }, [theme]);

  const cycleTheme = () => {
    const index = THEMES.indexOf(theme);
    setTheme(THEMES[(index + 1) % THEMES.length] ?? "nocturne");
  };

  return (
    <div className="app-frame">
      <header className="site-header">
        <Link to="/" className="wordmark" aria-label="Rill home">
          <span>Rill</span>
          <small aria-hidden="true">typing practice</small>
        </Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/" end>test</NavLink>
          <NavLink to="/history">history</NavLink>
          <button type="button" onClick={cycleTheme} aria-label={`Theme: ${theme}. Change theme.`}>
            {theme}
          </button>
          <button
            type="button"
            className="account-trigger"
            onClick={() => setAccountOpen(true)}
            aria-haspopup="dialog"
          >
            {auth.user?.username ?? "account"}
          </button>
        </nav>
      </header>
      <div
        className="sync-notice"
        role={auth.syncNotice === null ? undefined : "alert"}
        hidden={auth.syncNotice === null}
      >
        <span>{auth.syncNotice}</span>
        <button type="button" onClick={auth.clearSyncNotice}>
          dismiss
        </button>
      </div>
      <Routes>
        <Route path="/" element={<TypingPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="site-footer">
        <span>tab · restart</span>
        <span>built for the daily practice</span>
      </footer>
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppFrame />
      </AuthProvider>
    </BrowserRouter>
  );
}
