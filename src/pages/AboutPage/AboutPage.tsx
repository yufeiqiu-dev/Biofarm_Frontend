import styles from "./AboutPage.module.css";

const VALUES = [
  { icon: "◆", title: "Integrity", desc: "Honest science, transparent results, and ethical practice at every step." },
  { icon: "◈", title: "Rigor", desc: "Validated methodologies and precise standards that meet the demands of clinical research." },
  { icon: "◉", title: "Dedication", desc: "Committed to advancing diagnostics for conditions that affect millions worldwide." },
  { icon: "◇", title: "Innovation", desc: "Pioneering novel biomarkers and detection platforms that set new benchmarks." },
];

const STATS = [
  { value: "30+", label: "Years in Neuroscience" },
  { value: "2", label: "Disease Areas" },
  { value: "AD · PD", label: "Alzheimer's & Parkinson's" },
];

export function AboutPage() {
  return (
    <div className={styles.root}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTag}>Life Sciences · Diagnostics</div>
          <h1 className={styles.heroTitle}>
            Precision diagnostics for<br />neurodegenerative disease
          </h1>
          <p className={styles.heroSub}>
            Oasis Biofarm develops high-sensitivity antibody kits and biomarker
            platforms that enable early blood-based screening for Alzheimer's
            and Parkinson's disease.
          </p>
        </div>
      </section>

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsRow}>
          {STATS.map((s) => (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Company profile */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Company Profile</div>
          <h2 className={styles.sectionTitle}>Building the pipeline for early neurological diagnosis</h2>
          <p className={styles.paragraph}>
            We specialize in the development of diagnostic kits and therapeutic
            leads for neurodegenerative diseases — with a comprehensive pipeline
            spanning antibody lead optimization, diagnostic kit development,
            assay platform establishment, and antibody drug development.
          </p>
          <p className={styles.paragraph}>
            Founded by internationally renowned scientists with over thirty years
            of research experience in neuroscience, our R&amp;D team excels at
            identifying and discovering novel molecular markers for Alzheimer's
            disease (AD), Parkinson's disease (PD), and related conditions.
            Our goal is to directly address low sensitivity and specificity of
            current blood-based diagnostics — delivering reliable, early
            detection tools that support China's brain science research and
            clinical practice.
          </p>
        </section>

        {/* Mission + Vision */}
        <div className={styles.missionGrid}>
          <div className={styles.missionCard}>
            <div className={styles.missionIcon}>◎</div>
            <h3 className={styles.missionTitle}>Mission</h3>
            <p className={styles.missionText}>
              To support life sciences research and promote the development of public health
              through precision diagnostic tools that reach clinicians when it matters most.
            </p>
          </div>
          <div className={styles.missionCard}>
            <div className={styles.missionIcon}>◈</div>
            <h3 className={styles.missionTitle}>Vision</h3>
            <p className={styles.missionText}>
              To become a globally recognised supplier of high-quality antibody
              diagnostic kits — setting the standard for early neurological screening.
            </p>
          </div>
        </div>

        {/* Core Values */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Core Values</div>
          <h2 className={styles.sectionTitle}>What guides our work</h2>
          <div className={styles.valuesGrid}>
            {VALUES.map((v) => (
              <div key={v.title} className={styles.valueCard}>
                <span className={styles.valueIcon}>{v.icon}</span>
                <h4 className={styles.valueTitle}>{v.title}</h4>
                <p className={styles.valueDesc}>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Contact Us</div>
          <h2 className={styles.sectionTitle}>Get in touch</h2>
          <div className={styles.contactGrid}>
            <div className={styles.contactCard}>
              <div className={styles.contactRole}>Technical Support</div>
              <div className={styles.contactDetail}>WeChat / Phone</div>
              <a className={styles.contactValue} href="tel:+8615158063297">
                +86 151 5806 3297
              </a>
            </div>
            <div className={styles.contactCard}>
              <div className={styles.contactRole}>Sales</div>
              <div className={styles.contactDetail}>WeChat / Phone</div>
              <a className={styles.contactValue} href="tel:+8618069766167">
                +86 180 6976 6167
              </a>
            </div>
            <div className={styles.contactCard}>
              <div className={styles.contactRole}>Sales Email</div>
              <div className={styles.contactDetail}>Service enquiries</div>
              <a className={styles.contactValue} href="mailto:hh@oasisbiofarm.net">
                hh@oasisbiofarm.net
              </a>
            </div>
            <div className={styles.contactCard}>
              <div className={styles.contactRole}>Technical Email</div>
              <div className={styles.contactDetail}>Assay & kit support</div>
              <a className={styles.contactValue} href="mailto:support@oasisbiofarm.net">
                support@oasisbiofarm.net
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
