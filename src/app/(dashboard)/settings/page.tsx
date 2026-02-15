import styles from "../coming-soon.module.css";

export default function SettingsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.emoji}>⚙️</div>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.subtitle}>
        Manage your profile, notification preferences, and relationship
        settings — all in one place.
      </p>
      <span className={styles.badge}>🚧 Coming Soon</span>
    </div>
  );
}
