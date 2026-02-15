"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../challenges.module.css";

const CATEGORIES = [
  { value: "communication", label: "Communication", icon: "💬" },
  { value: "finances", label: "Finances", icon: "💰" },
  { value: "parenting", label: "Parenting", icon: "👶" },
  { value: "intimacy", label: "Intimacy", icon: "❤️" },
  { value: "household", label: "Household", icon: "🏠" },
  { value: "trust", label: "Trust", icon: "🤝" },
  { value: "boundaries", label: "Boundaries", icon: "🚧" },
  { value: "family", label: "Family", icon: "👨‍👩‍👧" },
  { value: "work_life", label: "Work / Life Balance", icon: "⚖️" },
  { value: "other", label: "Other", icon: "🔮" },
];

export default function NewChallengePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("communication");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title for this challenge.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category }),
      });

      if (res.ok) {
        const challenge = await res.json();
        router.push(`/challenges/${challenge.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create challenge");
      }
    } catch (err) {
      console.error("Failed to create challenge:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className={styles.listHeader}>
        <div>
          <h1 className="heading-2">New Challenge 🌱</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Describe the issue you&apos;d like to work through together.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.createForm}>
        <div className={styles.formGroup}>
          <label htmlFor="challenge-title" className={styles.formLabel}>
            What&apos;s this challenge about?
          </label>
          <input
            id="challenge-title"
            type="text"
            className="input"
            placeholder="e.g., Disagreement about holiday plans"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="challenge-category" className={styles.formLabel}>
            Category
          </label>
          <select
            id="challenge-category"
            className={styles.formSelect}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p style={{ color: "var(--error)", fontSize: "0.875rem", marginBottom: "var(--space-md)" }}>
            {error}
          </p>
        )}

        <div className={styles.formActions}>
          <Link href="/challenges" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={creating || !title.trim()}
          >
            {creating ? "Creating…" : "Create Challenge"}
          </button>
        </div>
      </form>
    </div>
  );
}
