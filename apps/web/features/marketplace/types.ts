export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: "Textbooks" | "Electronics" | "Furniture" | "Clothing" | "Other";
  condition: "New" | "Like New" | "Good" | "Fair";
  images: string[];
  seller: {
    id: string;
    username: string;
    name: string;
  };
  createdAt: string;
}
