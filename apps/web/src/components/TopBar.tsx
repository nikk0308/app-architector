interface TopBarProps {
  theme: "dark" | "light";
  language: "ua" | "en";
  onThemeChange: (theme: "dark" | "light") => void;
  onLanguageChange: (language: "ua" | "en") => void;
  labels?: {
    subtitle?: string;
    theme?: string;
    language?: string;
  };
}

export function TopBar({ theme, language, onThemeChange, onLanguageChange, labels }: TopBarProps) {
  const subtitle = labels?.subtitle ?? (language === "ua" ? "Лабораторія AI-архітектури" : "AI-assisted architecture lab");

  return (
    <header className="app-topbar">
      <div className="brand-lockup">
        <img src="/app-icon.png" alt="App Architector" className="brand-logo" />
        <div>
          <strong>App Architector</strong>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="topbar-controls">
        <div className="segmented-control" aria-label={labels?.theme ?? "Theme"}>
          <button className={theme === "dark" ? "seg-btn active" : "seg-btn"} type="button" onClick={() => onThemeChange("dark")}>DARK</button>
          <button className={theme === "light" ? "seg-btn active" : "seg-btn"} type="button" onClick={() => onThemeChange("light")}>LIGHT</button>
        </div>
        <div className="segmented-control" aria-label={labels?.language ?? "Language"}>
          <button className={language === "en" ? "seg-btn active" : "seg-btn"} type="button" onClick={() => onLanguageChange("en")}>EN</button>
          <button className={language === "ua" ? "seg-btn active" : "seg-btn"} type="button" onClick={() => onLanguageChange("ua")}>UA</button>
        </div>
      </div>
    </header>
  );
}
