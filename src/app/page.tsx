import Link from "next/link";
import styles from "./page.module.css";
import FooterPhrase from "./FooterPhrase";

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* ── Header ── */}
      <header className={styles.landingHeader}>
        <div className={styles.landingLogo}>
          Kuxani<span className={styles.landingLogoDot}>.</span>
        </div>
        <nav className={styles.landingNav}>
          <Link href="/login" className="btn btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Get Started
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>💜 AI-Powered Couples Therapy</div>
        <h1 className={styles.heroTitle}>
          Harmonize Your{" "}
          <span className={styles.heroTitleGradient}>Perspectives</span>,<br />
          Heal Together
        </h1>
        <p className={styles.heroSubtitle}>
          A collaborative platform where couples work together to understand
          each other, resolve conflicts constructively, and build a stronger
          relationship — guided by AI with therapeutic expertise.
        </p>
        <div className={styles.heroActions}>
          <Link href="/signup" className={styles.heroCta}>
            Start Your Journey
          </Link>
          <Link href="#how-it-works" className="btn btn-secondary btn-lg">
            How It Works
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.features}>
        <h2 className={`heading-2 ${styles.featuresTitle}`}>
          Everything You Need to{" "}
          <span className={styles.heroTitleGradient}>Grow Together</span>
        </h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconPurple}`}>
              🔮
            </div>
            <h3>Challenges</h3>
            <p>
              Each partner writes their perspective independently. Our AI
              creates a neutral synthesis that validates both viewpoints without
              blame.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconPink}`}>
              💬
            </div>
            <h3>Private Therapy</h3>
            <p>
              Your own safe space with the AI therapist. Explore personal
              patterns, process emotions, and prepare for shared conversations.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconAmber}`}>
              🎙️
            </div>
            <h3>Live Voice Sessions</h3>
            <p>
              Real-time voice conversations with the AI therapist — like a live
              couples therapy session, right from your browser.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconGreen}`}>
              📊
            </div>
            <h3>Pattern Recognition</h3>
            <p>
              AI analyzes your history to identify recurring dynamics, triggers,
              and growth areas — helping you break negative cycles.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconPurple}`}>
              🫶
            </div>
            <h3>Mood & Gratitude</h3>
            <p>
              Daily check-ins, emotion tracking, and gratitude journaling.
              Celebrate your partner and track your emotional landscape.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconPink}`}>
              🚨
            </div>
            <h3>De-escalation Mode</h3>
            <p>
              Quick-access during heated moments: guided breathing, cooling
              timer, and immediate AI de-escalation prompts.
            </p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className={styles.howItWorks} id="how-it-works">
        <div className={styles.howItWorksInner}>
          <h2 className={`heading-2 ${styles.howItWorksTitle}`}>
            How Kuxani Works
          </h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <h3>Create a Challenge</h3>
              <p>
                Name the issue and categorize it. Both partners are invited to
                share their perspective.
              </p>
            </div>
            <div className={styles.step}>
              <h3>Write Your Side</h3>
              <p>
                Each partner independently describes what happened and how they
                feel — privately, without influence.
              </p>
            </div>
            <div className={styles.step}>
              <h3>AI Synthesis</h3>
              <p>
                Our AI reads both perspectives and creates a neutral, empathetic
                summary that validates both sides.
              </p>
            </div>
            <div className={styles.step}>
              <h3>Discuss & Resolve</h3>
              <p>
                Chat together with AI guidance. Make requests, accept
                commitments, and grow stronger as a couple.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.landingFooter}>
        <p>
          <FooterPhrase />
        </p>
      </footer>
    </div>
  );
}
