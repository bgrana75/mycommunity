// components/store/ProductCard.tsx
import { Box, Image, Text, VStack, Button } from '@chakra-ui/react';
import { Product } from '@/app/types/Products';

interface ProductCardProps {
    product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
    return (
        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p={4} bg="muted">
            <Image src={product.imageUrl} alt={product.name} borderRadius="md" mb={4} />
            <VStack spacing={2} align="start">
                <Text fontWeight="bold" fontSize="lg">{product.name}</Text>
                <Text fontSize="sm" color="gray.500">${product.price.toFixed(2)}</Text>
                <Text noOfLines={3}>{product.description}</Text>
                <Button colorScheme="primary" w="full">
                    Buy Now
                </Button>
            </VStack>
        </Box>
    );
}
