// themes/swiperStyles.ts
export const swiperStyles = {
    '.swiper-button-next, .swiper-button-prev': {
        color: 'white',
        bg: 'primary.500',
        borderRadius: 'full',
        p: 2,
        _hover: {
            bg: 'primary.600',
        },
    },
    '.swiper-pagination-bullet': {
        bg: 'accent',
        _active: {
            bg: 'primary',
        },
    },
};
