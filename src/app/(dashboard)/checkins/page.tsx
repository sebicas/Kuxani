import styles from "../coming-soon.module.css";

export default function CheckinsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.emoji}>📋</div>
      <h1 className={styles.title}>Weekly Check-In</h1>
      <p className={styles.subtitle}>
        Guided weekly relationship check-ins to help you and your partner stay
        aligned, communicate openly, and grow together.
      </p>
      <span className={styles.badge}>🚧 Coming Soon</span>
    </div>
  );
}
