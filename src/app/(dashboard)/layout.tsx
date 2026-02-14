"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./dashboard.module.css";

const navItems = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/challenges", label: "Challenges", icon: "🔮" },
  { href: "/personal", label: "Private Therapy", icon: "💬" },
  { href: "/mood", label: "Mood Tracker", icon: "🫶" },
  { href: "/love-languages", label: "Love Languages", icon: "💕" },
  { href: "/gratitude", label: "Gratitude", icon: "✨" },
  { href: "/insights", label: "Insights", icon: "📊" },
];

const secondaryNavItems = [
  { href: "/exercises", label: "Exercises", icon: "📚" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.dashboardLayout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/dashboard" className={styles.sidebarLogo}>
            Kuxani<span className={styles.sidebarLogoDot}>.</span>
          </Link>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.sidebarSectionLabel}>Main</div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.sidebarLink} ${
                pathname === item.href ? styles.sidebarLinkActive : ""
              }`}
            >
              <span className={styles.sidebarIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarSectionLabel}>More</div>
            {secondaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.sidebarLink} ${
                  pathname === item.href ? styles.sidebarLinkActive : ""
                }`}
              >
                <span className={styles.sidebarIcon}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>K</div>
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>Partner</div>
              <div className={styles.sidebarUserEmail}>partner@kuxani.app</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className={styles.mainContent}>{children}</main>

      {/* ── Emergency De-escalation Button ── */}
      <button
        className={styles.emergencyBtn}
        title="Emergency De-escalation"
        aria-label="Emergency De-escalation Mode"
      >
        🚨
      </button>
    </div>
  );
}
