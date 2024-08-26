import { extendTheme } from '@chakra-ui/react';
import { swiperStyles } from './swiperStyles';

export const windows95Theme = extendTheme({
    initialColorMode: 'light',
    useSystemColorMode: false,
    colors: {
        background: '#C0C0C0', // Light gray background
        text: '#000000', // Black text
        primary: '#000080', // Navy blue for primary actions
        secondary: '#008080', // Teal for secondary elements
        accent: '#800080', // Purple for accents
        muted: '#D3D3D3', // Light gray for muted elements
        border: '#A9A9A9', // Dark gray for borders
        error: '#FF0000', // Bright red for errors
        success: '#008000', // Green for success messages
        warning: '#FFA500', // Orange for warnings
    },
    fonts: {
        heading: '"Tahoma", sans-serif', // Tahoma was commonly used in Windows 95
        body: '"Tahoma", sans-serif', // Tahoma for body text
        mono: '"Courier New", monospace', // Monospace for code-like elements
    },
    fontSizes: {
        xs: '10px',
        sm: '12px',
        md: '14px',
        lg: '16px',
        xl: '18px',
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '28px',
        '5xl': '32px',
        '6xl': '36px',
    },
    fontWeights: {
        normal: 400,
        medium: 600,
        bold: 700,
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
        border: '2px solid #A9A9A9', // Solid dark gray border
        borderRadius: '0px', // Sharp, rectangular corners typical of Windows 95
    },
    radii: {
        none: '0',
        sm: '4px',
        base: '0px',
        md: '12px',
        lg: '16px',
        full: '9999px', // For fully rounded corners
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
        xs: '0 0 2px 0 rgba(0, 0, 0, 0.5)',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        outline: '0 0 0 3px rgba(0, 0, 0, 0.6)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.8)',
        none: 'none',
        'dark-lg': 'rgba(0, 0, 0, 0.5) 0px 10px 15px -3px, rgba(0, 0, 0, 0.3) 0px 4px 6px -2px',
    },
    components: {
        Button: {
            baseStyle: {
                fontWeight: 'bold',
                textTransform: 'uppercase',
                borderRadius: 'none', // No rounded corners, reflecting the boxy style of Windows 95
            },
            sizes: {
                sm: {
                    fontSize: 'sm',
                    px: 4,
                    py: 2,
                },
                md: {
                    fontSize: 'md',
                    px: 6,
                    py: 3,
                },
            },
            variants: {
                solid: {
                    bg: 'primary',
                    color: 'background',
                    _hover: {
                        bg: 'accent',
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
