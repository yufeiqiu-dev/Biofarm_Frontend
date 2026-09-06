import styles from "./SearchBar.module.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type SearchBarProps = {
  placeholder?: string;
  basePath?: string;
  /**
   * The accessible name, when the placeholder is not a good one.
   *
   * Passing `aria-label` to this component does nothing - it is neither
   * declared nor spread, and TypeScript will not catch it because hyphenated
   * JSX attribute names are exempt from prop checking. So it is a real prop.
   */
  label?: string;
};

export function SearchBar({
  placeholder = "Search products...",
  label,
  basePath = "/products",
}: SearchBarProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedSearch = searchTerm.trim();

    if (!trimmedSearch) {
      navigate(basePath);
      return;
    }

    navigate(`${basePath}?search=${encodeURIComponent(trimmedSearch)}`);
  };

  return (
    <form className={styles.searchForm} onSubmit={handleSubmit} role="search">
      <input
        type="search"
        className={styles.searchInput}
        placeholder={placeholder}
        // The placeholder is not a label: it vanishes as soon as anything is
        // typed, and screen readers are inconsistent about announcing it.
        aria-label={label ?? placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button type="submit" className={styles.searchButton}>
        Search
      </button>
    </form>
  );
}