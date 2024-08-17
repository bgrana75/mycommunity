// pages/buy.tsx
import { Container } from '@chakra-ui/react';
import ProductList from '../components/store/ProductList';
import { Product } from '../types/Products';

const dummyProducts: Product[] = [
    {
        id: 1,
        name: 'Product 1',
        description: 'This is a description of product 1.',
        price: 19.99,
        imageUrl: 'https://via.placeholder.com/600x400.png?text=Product+Image+1',
        category: 'Category 1',
        stock: 10,
        rating: 4.5,
    },
    {
        id: 2,
        name: 'Product 2',
        description: 'This is a description of product 2.',
        price: 29.99,
        imageUrl: 'https://via.placeholder.com/600x400.png?text=Product+Image+2',
        category: 'Category 2',
        stock: 5,
        rating: 4.0,
    },
    {
        id: 3,
        name: 'Product 3',
        description: 'This is a description of product 3.',
        price: 9.99,
        imageUrl: 'https://via.placeholder.com/600x400.png?text=Product+Image+3',
        category: 'Category 3',
        stock: 20,
        rating: 3.5,
    },
];

export default function Store() {
    return (
        <Container maxW="container.lg">
            <ProductList products={dummyProducts} columns={3} />
        </Container>
    );
}
