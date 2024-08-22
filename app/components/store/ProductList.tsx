// components/store/ProductList.tsx
import { Box, SimpleGrid, Text } from '@chakra-ui/react';
import { Product } from '@/app/types/Products';
import ProductCard from './ProductCard';

interface ProductListProps {
    products: Product[];
    columns: 1 | 2 | 3 | 4;
}

export default function ProductList({ products, columns }: ProductListProps) {
    return (
        <Box as="section" py={8}>
            <Text fontSize="2xl" fontWeight="bold" mb={4}>
                Products
            </Text>
            <SimpleGrid columns={{ base: 1, sm: columns }} spacing={4}>
                {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </SimpleGrid>
        </Box>
    );
}
