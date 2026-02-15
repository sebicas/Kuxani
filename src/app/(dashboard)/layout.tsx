"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth/client";
import { NotificationProvider } from "@/lib/notifications/NotificationProvider";
import styles from "./dashboard.module.css";

const navItems = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/challenges", label: "Challenges", icon: "🔮" },
  { href: "/personal", label: "Private Therapy", icon: "💬" },
  { href: "/mood", label: "Mood Tracker", icon: "🫶" },
  { href: "/love-languages", label: "Love Languages", icon: "💕" },
  { href: "/gratitude", label: "Gratitude", icon: "✨" },
  { href: "/checkins", label: "Weekly Check-In", icon: "📋" },
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
  const router = useRouter();
  const { data: session } = useSession();
  const [coupleId, setCoupleId] = useState<string | null>(null);

  const userName = session?.user?.name || "Partner";
  const userEmail = session?.user?.email || "";
  const userInitial = userName.charAt(0).toUpperCase();
  const currentUserId = session?.user?.id || null;

  // Fetch couple ID for real-time notifications
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/couples")
      .then((r) => r.json())
      .then((data) => {
        if (data.couple?.id) setCoupleId(data.couple.id);
      })
      .catch(() => {});
  }, [session?.user]);

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
            <div className={styles.sidebarAvatar}>{userInitial}</div>
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>{userName}</div>
              <div className={styles.sidebarUserEmail}>{userEmail}</div>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() =>
              signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                  },
                },
              })
            }
            title="Sign out"
          >
            <span className={styles.sidebarIcon}>🚪</span>
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className={styles.mainContent}>
        <NotificationProvider coupleId={coupleId} currentUserId={currentUserId}>
          {children}
        </NotificationProvider>
      </main>

      {/* ── Emergency De-escalation Button ── */}
      <Link
        href="/deescalation"
        className={styles.emergencyBtn}
        title="Emergency De-escalation"
        aria-label="Emergency De-escalation Mode"
      >
        🚨
      </Link>
    </div>
  );
}
