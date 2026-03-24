import type { Product } from "../types/product_type";

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Organic Lettuce",
    description: "Fresh hydroponic lettuce grown locally.",
    imageUrl: "https://placehold.co/600x400",
    variants: [
      {
        id: "99",
        catalog_id: "OOK",
        size_value: 10,
        size_unit: "g",
        price: 4.5,
        stock: 100,
      },
    ],
  },
  {
    id: "2",
    name: "Cherry Tomatoes",
    description: "Sweet cherry tomatoes, perfect for salads.",
    imageUrl: "https://dummyimage.com/600x400/cccccc/000000&text=Test+Image",
    variants: [
      {
        id: "29",
        catalog_id: "WAS-01",
        size_value: 10,
        size_unit: "g",
        price: 5.2,
        stock: 100,
      },
      {
        id: "33",
        catalog_id: "WAS-02",
        size_value: 100,
        size_unit: "g",
        price: 52,
        stock: 100,
      },
    ],
  },
  {
    id: "3",
    name: "Cucumbers",
    description: "Crisp cucumbers grown without pesticides.",
    imageUrl: "https://dummyimage.com/600x400/cccccc/000000&text=Test+Image",
    variants: [
      {
        id: "3",
        catalog_id: "CSA",
        size_value: 10,
        size_unit: "g",
        price: 3.9,
        stock: 100,
      },
    ],
  },
];