import type { Product, ProductCategory } from "@/types";

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  price: number;
  points_earned: number;
  description: string;
  active: boolean;
  sort_order: number;
  created_at: Date | string;
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ProductCategory,
    price: Number(row.price),
    pointsEarned: Number(row.points_earned),
    description: row.description,
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
  };
}
