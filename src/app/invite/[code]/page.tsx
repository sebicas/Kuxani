"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/client";
import styles from "../invite.module.css";

interface InviteInfo {
  valid: boolean;
  creatorName: string;
  error?: string;
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState<string>("");

  // Resolve params and fetch invite info
  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      const resolvedParams = await params;
      const inviteCode = resolvedParams.code;
      if (cancelled) return;
      setCode(inviteCode);

      try {
        const res = await fetch(
          `/api/couples/invite?code=${encodeURIComponent(inviteCode)}`,
        );
        const data = await res.json();

        if (!cancelled) {
          if (res.ok) {
            setInviteInfo(data);
          } else {
            setInviteInfo({
              valid: false,
              creatorName: "",
              error: data.error || "Invalid invite code",
            });
          }
        }
      } catch {
        if (!cancelled) {
          setInviteInfo({
            valid: false,
            creatorName: "",
            error: "Could not verify invite code",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");

    try {
      const res = await fetch("/api/couples/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();

      if (res.ok) {
        setJoined(true);
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        setError(data.error || "Could not join couple");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  // Loading
  if (loading || sessionLoading) {
    return (
      <div className={styles.invitePage}>
        <div className={styles.inviteCard}>
          <div className={styles.inviteLoading}>
            <span className="spinner" />
            Verifying invite...
          </div>
        </div>
      </div>
    );
  }

  // Invalid / expired
  if (!inviteInfo?.valid) {
    return (
      <div className={styles.invitePage}>
        <div className={styles.inviteCard}>
          <div className={styles.inviteError}>
            <div className={styles.inviteErrorIcon}>🔗</div>
            <h1 className={styles.inviteTitle}>
              {inviteInfo?.error === "This invite has already been used"
                ? "Invite Already Used"
                : "Invalid Invite"}
            </h1>
            <p className={styles.inviteDescription}>
              {inviteInfo?.error ||
                "This invite link is invalid or has expired."}
            </p>
            <div className={styles.inviteActions}>
              <Link href="/signup" className="btn btn-primary">
                Create Your Own Account
              </Link>
              <Link href="/login" className="btn btn-secondary">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Successfully joined
  if (joined) {
    return (
      <div className={styles.invitePage}>
        <div className={styles.inviteCard}>
          <div className={styles.inviteSuccess}>
            <div className={styles.inviteSuccessIcon}>💜</div>
            <h1 className={styles.inviteSuccessTitle}>You&apos;re Connected!</h1>
            <p className={styles.inviteDescription}>
              You and {inviteInfo.creatorName} are now connected on Kuxani.
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Valid invite — show join or signup options
  return (
    <div className={styles.invitePage}>
      <div className={styles.inviteCard}>
        <div className={styles.inviteEmoji}>💑</div>
        <h1 className={styles.inviteTitle}>
          <span className={styles.inviteCreatorName}>
            {inviteInfo.creatorName}
          </span>{" "}
          invited you
        </h1>
        <p className={styles.inviteDescription}>
          {inviteInfo.creatorName} wants to start a relationship growth journey
          with you on Kuxani. Together, you&apos;ll resolve conflicts, grow
          closer, and build a stronger connection.
        </p>

        {error && (
          <div
            style={{
              color: "var(--danger)",
              fontSize: "0.875rem",
              marginBottom: "var(--space-md)",
            }}
          >
            {error}
          </div>
        )}

        {session ? (
          /* Logged in — show join button */
          <div className={styles.inviteActions}>
            <button
              onClick={handleJoin}
              className="btn btn-primary btn-lg"
              disabled={joining}
            >
              {joining ? <span className="spinner" /> : "Accept & Join 💜"}
            </button>
          </div>
        ) : (
          /* Not logged in — show signup / login */
          <div className={styles.inviteActions}>
            <Link
              href={`/signup?invite=${code}`}
              className="btn btn-primary btn-lg"
            >
              Create Account & Join
            </Link>
            <div className={styles.inviteDivider}>or</div>
            <Link
              href={`/login?invite=${code}`}
              className="btn btn-secondary"
            >
              I Already Have an Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
