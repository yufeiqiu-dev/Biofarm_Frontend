import type { Product } from "../types/product_type";

export const mockProducts: Product[] = [
  {
    id: "1",
    catolog_id: "OOK",
    name: "Organic Lettuce",
    description: "Fresh hydroponic lettuce grown locally.",
    price: 4.5,
    imageUrl: "https://via.placeholder.com/300x200?text=Lettuce",
    variants: [
      {
        id: "1",
        catolog_id: "OOK",
        size_value: 10,
        size_unit: "g",
        price: 4.5,
        stock: 100,
      },
    ],
  },
  {
    id: "2",
    catolog_id: "WAS",
    name: "Cherry Tomatoes",
    description: "Sweet cherry tomatoes, perfect for salads.",
    price: 5.2,
    imageUrl: "https://via.placeholder.com/300x200?text=Tomatoes",
    variants: [
      {
        id: "2",
        catolog_id: "WAS",
        size_value: 10,
        size_unit: "g",
        price: 5.2,
        stock: 100,
      },
    ],
  },
  {
    id: "3",
    catolog_id: "CSA",
    name: "Cucumbers",
    description: "Crisp cucumbers grown without pesticides.",
    price: 3.9,
    imageUrl: "https://via.placeholder.com/300x200?text=Cucumbers",
    variants: [
      {
        id: "3",
        catolog_id: "CSA",
        size_value: 10,
        size_unit: "g",
        price: 3.9,
        stock: 100,
      },
    ],
  },
];