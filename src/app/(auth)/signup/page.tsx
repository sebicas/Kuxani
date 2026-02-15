"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@/lib/auth/client";
import styles from "../auth.module.css";

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authPage}>
          <div className={styles.authCard}>
            <div className={styles.authLogo}>
              Kuxani<span className={styles.authLogoDot}>.</span>
            </div>
            <p className="text-muted">Loading...</p>
          </div>
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  // If there's an invite code, look up the creator's name
  useEffect(() => {
    if (!inviteCode) return;
    fetch(`/api/couples/invite?code=${encodeURIComponent(inviteCode)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setCreatorName(data.creatorName);
        }
      })
      .catch(() => {
        // ignore — just won't show creator name
      });
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message || "Could not create account");
      } else {
        // If there's an invite code, redirect to the invite page to auto-join
        if (inviteCode) {
          router.push(`/invite/${inviteCode}`);
        } else {
          router.push("/dashboard");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <div className={styles.authLogo}>
          Kuxani<span className={styles.authLogoDot}>.</span>
        </div>
        <h1 className={styles.authTitle}>
          {creatorName ? `Join ${creatorName} on Kuxani` : "Begin your journey"}
        </h1>
        <p className={styles.authSubtitle}>
          {creatorName
            ? `${creatorName} invited you to grow together. Create your account to get started.`
            : "Create your account and invite your partner to grow together."}
        </p>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {error && <div className={styles.authError}>{error}</div>}

          <div className={styles.authField}>
            <label htmlFor="name" className={styles.authLabel}>
              Your Name
            </label>
            <input
              id="name"
              type="text"
              className="input"
              placeholder="Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.authField}>
            <label htmlFor="email" className={styles.authLabel}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.authField}>
            <label htmlFor="password" className={styles.authLabel}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? (
              <span className="spinner" />
            ) : inviteCode ? (
              "Create Account & Join 💜"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className={styles.authFooter}>
          Already have an account?{" "}
          <Link
            href={inviteCode ? `/login?invite=${inviteCode}` : "/login"}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
