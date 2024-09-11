'use client';

import { Box, Text, VStack, Button, Image, Card, CardBody, CardFooter, HStack } from '@chakra-ui/react';
import { Product } from '@/types/Products';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { useState } from 'react';
import ReactCardFlip from 'react-card-flip';

interface ProductCardProps {
    product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const discountedPrice = product.price * 0.75;

    return (
        <ReactCardFlip isFlipped={isFlipped} flipDirection="horizontal">
            {/* Front Side */}
            <Card key="front" borderWidth="1px" borderRadius="lg" overflow="hidden" p={1} bg="muted" h={'440px'}>
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
                                    <Image
                                        objectFit={'cover'}
                                        src={url}
                                        alt={product.name}
                                        style={{ borderRadius: 'md', marginBottom: '1rem', width: '100%' }}
                                    />
                                </Box>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                    <VStack spacing={2} align="start" mt={3}>
                        <Text fontWeight="bold" fontSize="lg">{product.name}</Text>
                        <HStack>
                            <Text fontSize="sm" color="gray.500">
                                <del>${product.price.toFixed(2)} USD</del>
                            </Text>
                            <Text fontSize="sm" color={'red'}>${discountedPrice.toFixed(2)} HBD</Text>
                        </HStack>
                        <Text noOfLines={3}>{product.description}</Text>
                    </VStack>
                </CardBody>
                <CardFooter>
                    <Button colorScheme="primary" w="full" onClick={() => setIsFlipped(true)}>
                        Buy Now
                    </Button>
                </CardFooter>
            </Card>

            {/* Back Side */}
            <Card key="back" borderWidth="1px" borderRadius="lg" overflow="hidden" p={1} bg="muted" h={'440px'}>
                <CardBody display="flex" justifyContent="center" alignItems="center">
                    <VStack>

                        <Box m={2} fontSize="lg" fontWeight="bold" color={'text'}>
                            ${discountedPrice.toFixed(2)} HBD
                        </Box>
                    </VStack>
                </CardBody>
                <CardFooter>
                    <Button colorScheme="primary" w="full" onClick={() => setIsFlipped(false)}>
                        Go Back
                    </Button>
                </CardFooter>
            </Card>
        </ReactCardFlip>
    );
}