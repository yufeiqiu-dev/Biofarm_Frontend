import shared from "../../styles/shared.module.css";
import styles from "./AboutPage.module.css";

export function AboutPage() {
  return (
    <div className={shared.page}>
      <h1 className={styles.title}>About us</h1>
      <p className={styles.meta}>2021-11-03</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Company Profile</h2>
        <p className={styles.paragraph}>
          Oasis Biofarm specializes in the development of diagnostic kits and new
          drugs for neurodegenerative diseases. We aim to establish a
          comprehensive pipeline in the fields of neurodegenerative disease
          diagnosis, early screening, and treatment, including antibody lead
          optimization, diagnostic kit development, assay platform
          establishment, and antibody drug development. Our goal is to address
          issues such as low sensitivity and specificity of antibody reagents in
          early blood-based diagnostics for neurodegenerative diseases, unstable
          detection platforms, and a lack of interventions in therapeutic drugs.
        </p>
        <p className={styles.paragraph}>
          Founded by internationally renowned scientists with over thirty years
          of research experience in neuroscience, our R&amp;D team possesses
          strong capabilities in identifying and discovering novel molecular
          markers for Alzheimer&apos;s disease (AD), Parkinson&apos;s disease
          (PD), and other neurodegenerative conditions. We aim to provide new
          engines for early diagnosis and treatment, as well as for clinical
          detection and intervention, supporting China’s brain science research,
          clinical detection, and treatment efforts.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mission</h2>
        <p className={styles.paragraph}>
          To support life sciences research and promote the development of
          public health.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Vision</h2>
        <p className={styles.paragraph}>
          To become a professional supplier of high-quality antibody diagnostic
          kits.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Core Values</h2>
        <ul className={styles.list}>
          <li>Integrity</li>
          <li>Rigor</li>
          <li>Dedication</li>
          <li>Innovation</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Contact</h2>
        <div className={styles.contactGrid}>
          <div className={styles.contactItem}>
            <div className={styles.contactLabel}>
              Technical Support Contact (WeChat/Phone)
            </div>
            <div className={styles.contactValue}>+86 15158063297 (Red Book)</div>
          </div>
          <div className={styles.contactItem}>
            <div className={styles.contactLabel}>Sales Contact (WeChat/Phone)</div>
            <div className={styles.contactValue}>+86 18069766167</div>
          </div>
          <div className={styles.contactItem}>
            <div className={styles.contactLabel}>Sales Service Email</div>
            <a className={styles.emailLink} href="mailto:hh@oasisbiofarm.net">
              hh@oasisbiofarm.net
            </a>
          </div>
          <div className={styles.contactItem}>
            <div className={styles.contactLabel}>Technical Support Email</div>
            <a className={styles.emailLink} href="mailto:support@oasisbiofarm.net">
              support@oasisbiofarm.net
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

