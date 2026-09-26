import type { ReactNode } from "react";
import { href } from "../nav/router";
import { Icon, BrandMark, type IconName } from "./Icon";

export type Tab = "search" | "home" | "live" | "movies" | "series" | "settings";

const RAIL: { tab: Tab; label: string; icon: IconName; to: string }[] = [
  { tab: "search", label: "بحث", icon: "search", to: "/search" },
  { tab: "home", label: "الرئيسية", icon: "home", to: "/" },
  { tab: "live", label: "مباشر", icon: "live", to: "/live" },
  { tab: "movies", label: "أفلام", icon: "movies", to: "/movies" },
  { tab: "series", label: "مسلسلات", icon: "series", to: "/series" },
  { tab: "settings", label: "الإعدادات", icon: "settings", to: "/settings" },
];

const TABS: { tab: Tab; label: string; icon: IconName; to: string }[] = [
  { tab: "home", label: "الرئيسية", icon: "home", to: "/" },
  { tab: "live", label: "مباشر", icon: "live", to: "/live" },
  { tab: "movies", label: "أفلام", icon: "movies", to: "/movies" },
  { tab: "series", label: "مسلسلات", icon: "series", to: "/series" },
  { tab: "settings", label: "المزيد", icon: "more", to: "/settings" },
];

/**
 * الإطار العام: على التلفاز والشاشات العريضة قائمة جانبية ثابتة (يمين الشاشة في RTL) والمحتوى يتمرر وحده؛
 * على الجوال شريط سفلي ثابت.
 */
export function Shell({ wide, active, children }: { wide: boolean; active: Tab | null; children: ReactNode }) {
  if (wide) {
    return (
      <div className="shell-wide">
        <nav className="navrail" aria-label="القائمة" data-nav-region="rail">
          <BrandMark />
          {RAIL.map((item) => (
            <a key={item.tab} href={href(item.to)} className={item.tab === active ? "is-active" : undefined} aria-current={item.tab === active ? "page" : undefined}>
              <Icon name={item.icon} size={24} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <main className="shell-main" data-nav-region="main">
          {children}
        </main>
      </div>
    );
  }
  return (
    <div className="shell-phone">
      <main data-nav-region="main">{children}</main>
      <nav className="tabbar" aria-label="التنقل الرئيسي">
        {TABS.map((item) => (
          <a key={item.tab} href={href(item.to)} className={item.tab === active ? "is-active" : undefined} aria-current={item.tab === active ? "page" : undefined}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
