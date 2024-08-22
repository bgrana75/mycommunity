// pages/buy.tsx
import { Container } from '@chakra-ui/react';
import ProductList from '../components/store/ProductList';
import { dummyProducts } from '../components/store/Products';

export default function Store() {
    return (
        <Container maxW="container.lg">
            <ProductList products={dummyProducts} columns={3} />
        </Container>
    );
}
