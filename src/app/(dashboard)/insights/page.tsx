import styles from "../coming-soon.module.css";

export default function InsightsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.emoji}>📊</div>
      <h1 className={styles.title}>Insights</h1>
      <p className={styles.subtitle}>
        Relationship analytics and trends — see how your mood, gratitude, and
        communication patterns evolve over time.
      </p>
      <span className={styles.badge}>🚧 Coming Soon</span>
    </div>
  );
}
