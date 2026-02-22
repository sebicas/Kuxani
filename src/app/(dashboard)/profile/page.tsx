"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import styles from "./profile.module.css";

const VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "marin", "nova", "onyx", "sage", "shimmer", "verse",
] as const;

interface ProfileData {
  id: string;
  name: string;
  email: string;
  image: string | null;
  phone: string | null;
  description: string | null;
  partner: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    phone: string | null;
    description: string | null;
    coupleStatus: string;
    coupleName: string | null;
  } | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Voice preference
  const [voicePreference, setVoicePreference] = useState("sage");
  const [savingVoice, setSavingVoice] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceCacheRef = useRef<Map<string, Blob>>(new Map());
  const [_preloadProgress, setPreloadProgress] = useState(0);

  const showToast = useCallback((message: string, error = false) => {
    setToast({ message, error });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const [profileRes, settingsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/profile/settings"),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data);
          setEditName(data.name);
          setEditPhone(data.phone ?? "");
          setEditDescription(data.description ?? "");
        }

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setVoicePreference(data.voicePreference ?? "sage");
        }
      } catch {
        showToast("Failed to load profile", true);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [showToast]);

  // Preload all voice samples once profile is loaded
  useEffect(() => {
    if (!profile?.name) return;

    let cancelled = false;
    const firstName = profile.name.split(" ")[0];

    async function preloadVoice(voice: string) {
      if (voiceCacheRef.current.has(voice)) return;
      try {
        const res = await fetch("/api/profile/voice-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice, name: firstName }),
        });
        if (res.ok && !cancelled) {
          const blob = await res.blob();
          voiceCacheRef.current.set(voice, blob);
          setPreloadProgress(voiceCacheRef.current.size);
        }
      } catch {
        // Silently skip — will fetch on demand as fallback
      }
    }

    async function preloadAll() {
      // Load 3 voices at a time to avoid overwhelming the server
      for (let i = 0; i < VOICES.length; i += 3) {
        if (cancelled) break;
        const batch = VOICES.slice(i, i + 3);
        await Promise.all(batch.map(preloadVoice));
      }
    }

    preloadAll();
    return () => { cancelled = true; };
  }, [profile?.name]);

  // Save profile edits
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone || null,
          description: editDescription || null,
        }),
      });

      if (res.ok) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                name: editName,
                phone: editPhone || null,
                description: editDescription || null,
              }
            : prev
        );
        setEditing(false);
        showToast("Profile updated");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to save", true);
      }
    } catch {
      showToast("Failed to save", true);
    } finally {
      setSaving(false);
    }
  }

  // Save voice preference
  async function handleVoiceChange(voice: string) {
    setVoicePreference(voice);
    setSavingVoice(true);
    try {
      const res = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voicePreference: voice }),
      });

      if (res.ok) {
        showToast(`Voice set to ${voice}`);
      } else {
        showToast("Failed to save voice preference", true);
      }
    } catch {
      showToast("Failed to save voice preference", true);
    } finally {
      setSavingVoice(false);
    }

    // Auto-preview the voice
    previewVoice(voice);
  }

  // Play a TTS preview — uses preloaded cache, falls back to on-demand
  async function previewVoice(voice: string) {
    // Stop any currently playing preview
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPreviewingVoice(voice);
    try {
      let blob = voiceCacheRef.current.get(voice);

      // Fallback: fetch on demand if not yet preloaded
      if (!blob) {
        const res = await fetch("/api/profile/voice-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voice,
            name: profile?.name?.split(" ")[0] || "there",
          }),
        });

        if (!res.ok) {
          showToast("Failed to preview voice", true);
          setPreviewingVoice(null);
          return;
        }

        blob = await res.blob();
        voiceCacheRef.current.set(voice, blob);
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch {
      showToast("Failed to preview voice", true);
      setPreviewingVoice(null);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading profile...</div>;
  }

  if (!profile) {
    return <div className={styles.loading}>Unable to load profile.</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Profile</h1>

      {/* ── Personal Info ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>👤</span>
            Personal Information
          </h2>
          {!editing && (
            <button className={styles.editBtn} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Full Name</label>
                <input
                  className={styles.fieldInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email</label>
                <input
                  className={styles.fieldInput}
                  value={profile.email}
                  disabled
                  style={{ opacity: 0.6 }}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Phone</label>
                <input
                  className={styles.fieldInput}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className={styles.fieldFull}>
                <label className={styles.fieldLabel}>Description</label>
                <textarea
                  className={styles.fieldTextarea}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Tell us a little about yourself..."
                  rows={3}
                />
              </div>
            </div>
            <div className={styles.editActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setEditing(false);
                  setEditName(profile.name);
                  setEditPhone(profile.phone ?? "");
                  setEditDescription(profile.description ?? "");
                }}
              >
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving || !editName.trim()}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Full Name</span>
              <span className={styles.fieldValue}>{profile.name}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Email</span>
              <span className={styles.fieldValue}>{profile.email}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Phone</span>
              <span className={profile.phone ? styles.fieldValue : styles.fieldEmpty}>
                {profile.phone || "Not set"}
              </span>
            </div>
            <div className={styles.fieldFull}>
              <span className={styles.fieldLabel}>Description</span>
              <span className={profile.description ? styles.fieldValue : styles.fieldEmpty}>
                {profile.description || "No description yet"}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Partner Info ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>💕</span>
            Partner
          </h2>
        </div>

        {profile.partner ? (
          <div className={styles.partnerCard}>
            <div className={styles.partnerAvatar}>
              {profile.partner.name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.partnerInfo}>
              <div className={styles.partnerName}>{profile.partner.name}</div>
              <div className={styles.partnerEmail}>{profile.partner.email}</div>
            </div>
            <span className={styles.partnerStatus}>
              {profile.partner.coupleStatus}
            </span>
          </div>
        ) : (
          <div className={styles.noPartner}>
            No partner connected yet.{" "}
            <Link href="/dashboard" className={styles.inviteLink}>
              Invite your partner
            </Link>
          </div>
        )}
      </section>

      {/* ── Settings ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>⚙️</span>
            Settings
          </h2>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            AI Voice Preference
            {savingVoice && <span className={styles.voiceSaving}> saving...</span>}
          </span>
          <div className={styles.voiceGrid}>
            {VOICES.map((voice) => (
              <button
                key={voice}
                className={
                  voicePreference === voice
                    ? styles.voiceOptionActive
                    : styles.voiceOption
                }
                onClick={() => handleVoiceChange(voice)}
                disabled={previewingVoice === voice}
              >
                <span className={styles.voiceCheck}>
                  {previewingVoice === voice
                    ? "🔊"
                    : voicePreference === voice
                    ? "●"
                    : "○"}
                </span>
                <span className={styles.voiceName}>{voice}</span>
                {previewingVoice === voice && (
                  <span className={styles.voicePlaying}>Playing...</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Toast ── */}
      {toast && (
        <div className={toast.error ? styles.toastError : styles.toast}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
