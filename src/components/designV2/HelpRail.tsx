import { useId, useRef, useState, type KeyboardEvent } from "react";
import { HELP_RAIL } from "./constants";

const TABS = [
  { key: "why", label: HELP_RAIL.tabWhy },
  { key: "how", label: HELP_RAIL.tabHow },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/**
 * Right-hand 286px help rail shown next to the editor steps.
 * Card 1: step checklist. Card 2: "Why this step" / "How it works" tabs,
 * following the WAI-ARIA tabs pattern (roving tabindex, arrow-key navigation,
 * tab ↔ tabpanel association). Content is placeholder-only for now.
 */
const HelpRail = () => {
  const [tab, setTab] = useState<TabKey>("why");
  const baseId = useId();
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  const tabId = (key: TabKey) => `${baseId}-tab-${key}`;
  const panelId = (key: TabKey) => `${baseId}-panel-${key}`;

  const activate = (key: TabKey) => {
    setTab(key);
    tabRefs.current[key]?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((t) => t.key === tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    activate(TABS[next].key);
  };

  return (
    <aside className="nd-help-rail" aria-label={HELP_RAIL.ariaLabel}>
      <div className="nd-card">
        <div className="nd-card-head">
          <span className="nd-card-title">{HELP_RAIL.checklist}</span>
        </div>
        <div className="nd-checklist" />
      </div>

      <div className="nd-card nd-card-tabs">
        <div className="nd-tabs" role="tablist" aria-label={HELP_RAIL.tablistLabel}>
          {TABS.map(({ key, label }) => {
            const active = key === tab;
            return (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[key] = el;
                }}
                id={tabId(key)}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={panelId(key)}
                tabIndex={active ? 0 : -1}
                className={`nd-tab ${active ? "nd-tab-active" : ""}`}
                onClick={() => setTab(key)}
                onKeyDown={onTabKeyDown}
              >
                {label}
              </button>
            );
          })}
        </div>
        {TABS.map(({ key }) => (
          <div
            key={key}
            id={panelId(key)}
            role="tabpanel"
            aria-labelledby={tabId(key)}
            tabIndex={0}
            hidden={key !== tab}
            className="nd-card-body"
          />
        ))}
      </div>
    </aside>
  );
};

export default HelpRail;
