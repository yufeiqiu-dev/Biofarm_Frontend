import styles from "./SearchBar.module.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type SearchBarProps = {
  placeholder?: string;
};

export function SearchBar({
  placeholder = "Search products...",
}: SearchBarProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedSearch = searchTerm.trim();

    if (!trimmedSearch) {
      navigate("/products");
      return;
    }

    navigate(`/products?search=${encodeURIComponent(trimmedSearch)}`);
  };

  return (
    <form className={styles.searchForm} onSubmit={handleSubmit}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button type="submit" className={styles.searchButton}>
        Search
      </button>
    </form>
  );
}