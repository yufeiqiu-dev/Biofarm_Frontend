import type { Product } from "../types/product_type";

export const mockProducts: Product[] = [
  {
    id: "1",
    cat_id: "OOK",
    name: "Organic Lettuce",
    description: "Fresh hydroponic lettuce grown locally.",
    image_url: "https://placehold.co/600x400",
    variants: [
      {
        id: "99",
        catalog_id: "OOK-1",
        size_value: 10,
        size_unit: "g",
        price: 4.5,
        stock: 100,
      },
    ],
  },
  {
    id: "2",
    cat_id: "WAS",
    name: "Cherry Tomatoes",
    description: "Sweet cherry tomatoes, perfect for salads.",
    image_url: "https://dummyimage.com/600x400/cccccc/000000&text=Test+Image",
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
    cat_id: "CSA",
    name: "Cucumbers",
    description: "Crisp cucumbers grown without pesticides.",
    image_url: "https://dummyimage.com/600x400/cccccc/000000&text=Test+Image",
    variants: [
      {
        id: "3",
        catalog_id: "CSA-01",
        size_value: 10,
        size_unit: "g",
        price: 3.9,
        stock: 100,
      },
    ],
  },
];