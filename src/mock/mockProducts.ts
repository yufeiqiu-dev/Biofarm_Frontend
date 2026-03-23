import type { Product } from "../types/product_type";

export const mockProducts: Product[] = [
  {
    id: "1",
    cat_id: "OOK",
    name: "Organic Lettuce",
    description: "Fresh hydroponic lettuce grown locally.",
    price: 4.5,
    imageUrl: "https://via.placeholder.com/300x200?text=Lettuce",
  },
  {
    id: "2",
    cat_id: "WAS",
    name: "Cherry Tomatoes",
    description: "Sweet cherry tomatoes, perfect for salads.",
    price: 5.2,
    imageUrl: "https://via.placeholder.com/300x200?text=Tomatoes",
  },
  {
    id: "3",
    cat_id: "CSA",
    name: "Cucumbers",
    description: "Crisp cucumbers grown without pesticides.",
    price: 3.9,
    imageUrl: "https://via.placeholder.com/300x200?text=Cucumbers",
  },
];