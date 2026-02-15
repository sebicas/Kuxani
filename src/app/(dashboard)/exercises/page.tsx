import styles from "../coming-soon.module.css";

export default function ExercisesPage() {
  return (
    <div className={styles.container}>
      <div className={styles.emoji}>📚</div>
      <h1 className={styles.title}>Exercises</h1>
      <p className={styles.subtitle}>
        Couples therapy exercises and activities designed to deepen your
        connection, build trust, and strengthen communication skills.
      </p>
      <span className={styles.badge}>🚧 Coming Soon</span>
    </div>
  );
}
