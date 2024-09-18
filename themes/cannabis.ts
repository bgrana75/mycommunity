
import { swiperStyles } from './swiperStyles';
import { extendTheme } from '@chakra-ui/react';
import { Oswald, Roboto } from 'next/font/google';

const oswald = Oswald({
    weight: ['400', '700'],
    subsets: ['latin'],
});

const roboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
});

export const cannabisTheme = extendTheme({
    colors: {
        background: '#ffffff',  // Clean white background
        text: '#212121',  // Dark neutral text color
        primary: '#4caf50',  // Leaf green for primary elements
        secondary: '#2e7d32',  // Darker green for secondary actions
        accent: '#aee571',  // Lime green for accents and highlights
        muted: '#f0f4c3',  // Pale green for muted elements or backgrounds
        border: '#e0e0e0',  // Light gray border for cards or sections
        error: '#d32f2f',  // Red for errors
        success: '#66bb6a',  // Green for success messages
        warning: '#ffb300',  // Orange for warnings
    },
    fonts: {
        heading: oswald.style.fontFamily + ', sans-serif',
        body: roboto.style.fontFamily + ', sans-serif',
        mono: '"Courier New", monospace',
    },
    fontSizes: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
        '5xl': '48px',
        '6xl': '64px',
    },
    fontWeights: {
        normal: 300,
        medium: 400,
        bold: 900,
    },
    lineHeights: {
        normal: 'normal',
        none: 1,
        shorter: 1.25,
        short: 1.375,
        base: 1.5,
        tall: 1.625,
        taller: '2',
    },
    borders: {
        tb1: '1px solid #ffcc00',  // Nouns yellow border
        borderRadius: '8px',
    },
    space: {
        px: '1px',
        0: '0',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
    },
    sizes: {
        max: 'max-content',
        min: 'min-content',
        full: '100%',
        '3xs': '14rem',
        '2xs': '16rem',
        xs: '20rem',
        sm: '24rem',
        md: '28rem',
        lg: '32rem',
        xl: '36rem',
        '2xl': '42rem',
        '3xl': '48rem',
        '4xl': '56rem',
        '5xl': '64rem',
        '6xl': '72rem',
        '7xl': '80rem',
        container: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
        },
    },
    shadows: {
        xs: '0 0 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        outline: '0 0 0 3px rgba(66, 153, 225, 0.6)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        none: 'none',
        'dark-lg': 'rgba(0, 0, 0, 0.4) 0px 10px 15px -3px, rgba(0, 0, 0, 0.3) 0px 4px 6px -2px',
    },
    styles: {
        global: {
            ...swiperStyles, // Apply Swiper styles globally
        },
    },
    components: {
        Button: {
            baseStyle: {
                fontWeight: 'bold',
                textTransform: 'uppercase',
                borderRadius: 'base',
            },
            sizes: {
                sm: {
                    fontSize: 'sm',
                    px: 4,
                    py: 3,
                },
                md: {
                    fontSize: 'md',
                    px: 6,
                    py: 4,
                },
            },
            variants: {
                solid: {
                    bg: 'primary',
                    color: 'white',
                    _hover: {
                        bg: 'secondary',
                    },
                },
                outline: {
                    borderColor: 'primary',
                    color: 'primary',
                    _hover: {
                        bg: 'muted',
                    },
                },
                ghost: {
                    color: 'primary',
                    _hover: {
                        bg: 'muted',
                    },
                },
            },
        },
        Input: {
            baseStyle: {
                field: {
                    borderColor: 'border',
                    _focus: {
                        borderColor: 'primary',
                        boxShadow: 'outline',
                    },
                },
            },
            sizes: {
                md: {
                    field: {
                        fontSize: 'md',
                        px: 4,
                        py: 2,
                    },
                },
            },
            variants: {
                outline: {
                    field: {
                        borderColor: 'border',
                        _hover: {
                            borderColor: 'primary',
                        },
                        _focus: {
                            borderColor: 'primary',
                            boxShadow: 'outline',
                        },
                    },
                },
                filled: {
                    field: {
                        bg: 'muted',
                        _hover: {
                            bg: 'muted',
                        },
                        _focus: {
                            bg: 'muted',
                            borderColor: 'primary',
                        },
                    },
                },
            },
        },
        Text: {
            baseStyle: {
                color: 'text',
            },
        },
    },
});
