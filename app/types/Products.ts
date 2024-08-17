// types/Product.ts
export interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    category: string;
    stock: number;
    rating: number;
    tags?: string[];  // Optional tags for categorization
}
