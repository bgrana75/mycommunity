'use client';

import { Box, Text, VStack, Button, Image, Card, CardBody, CardFooter } from '@chakra-ui/react';
import { Product } from '@/app/types/Products';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface ProductCardProps {
    product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
    return (
        <Card borderWidth="1px" borderRadius="lg" overflow="hidden" p={1} bg="muted">

            <CardBody>
                <Swiper
                    spaceBetween={8}
                    slidesPerView={1}
                    pagination={{ clickable: true }}
                    navigation={true}
                    modules={[Navigation, Pagination]}
                >
                    {product.imageUrls.map((url, index) => (
                        <SwiperSlide key={index}>
                            <Box h="200px" w="300px">
                                <Image objectFit={'cover'} src={url} alt={product.name} style={{ borderRadius: 'md', marginBottom: '1rem', width: '100%' }} />
                            </Box>
                        </SwiperSlide>
                    ))}
                </Swiper>
                <VStack spacing={2} align="start">
                    <Text fontWeight="bold" fontSize="lg">{product.name}</Text>
                    <Text fontSize="sm" color="gray.500">${product.price.toFixed(2)} HBD</Text>
                    <Text noOfLines={3}>{product.description} </Text>
                </VStack>
            </CardBody>
            <CardFooter>
                <Button colorScheme="primary" w="full">
                    Buy Now
                </Button>
            </CardFooter>
        </Card>

    );
}
