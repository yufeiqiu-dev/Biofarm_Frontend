import styles from "./Pager.module.css";

interface Props {
  /** Zero-based. */
  page: number;
  pageSize: number;
  /** How many items there are in total, not how many are on this page. */
  total: number;
  onPage: (page: number) => void;
  /** Distinguishes this pager from any other on the page, for screen readers. */
  label: string;
  /** Set while a page is being fetched, so the controls cannot be double-clicked. */
  busy?: boolean;
}

/**
 * Previous / Next with a count.
 *
 * The count is not decoration: "Next" with no idea how many pages there are is
 * a button you press until it stops doing anything. Knowing you are on 1–50 of
 * 62 tells you there is one more page and roughly what is on it.
 *
 * Renders nothing at all when everything fits on one page, so callers can drop
 * it in unconditionally rather than repeating the same guard.
 */
export function Pager({ page, pageSize, total, onPage, label, busy = false }: Props) {
  if (total <= pageSize) return null;

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const firstShown = total === 0 ? 0 : page * pageSize + 1;
  const lastShown = Math.min((page + 1) * pageSize, total);

  return (
    <nav className={styles.pager} aria-label={label}>
      <span className={styles.count}>
        {firstShown}–{lastShown} of {total}
      </span>
      <button
        type="button"
        className={styles.button}
        onClick={() => onPage(Math.max(0, page - 1))}
        disabled={page === 0 || busy}
      >
        Previous
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => onPage(Math.min(lastPage, page + 1))}
        disabled={page >= lastPage || busy}
      >
        Next
      </button>
    </nav>
  );
}
