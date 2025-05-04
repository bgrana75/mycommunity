import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';

// Import your existing themes
import forestTheme from '@/themes/forest';
import blueSkyTheme from '@/themes/bluesky';
import hackerTheme from '@/themes/hacker';
import nounsDaoTheme from '@/themes/nounish';
import windows95Theme from '@/themes/windows95';
import hiveBRTheme from '@/themes/hivebr';
import cannabisTheme from '@/themes/cannabis';
import gayTheme from '@/themes/gay';

// Map of available themes
export const themeMap = {
    forest: forestTheme,
    bluesky: blueSkyTheme,
    hacker: hackerTheme,
    nounish: nounsDaoTheme,
    windows95: windows95Theme,
    hiveBR: hiveBRTheme,
    cannabis: cannabisTheme,
    gay: gayTheme, // Add the new theme here
};

// Define the types
export type ThemeName = keyof typeof themeMap;  // Export ThemeName type
interface ThemeContextProps {
    themeName: ThemeName;
    setThemeName: (themeName: ThemeName) => void;
    theme: any;
}

// Create a Context for the theme
const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

// Custom hook to use the ThemeContext
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

// ThemeProvider component to manage and provide theme state
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const defaultTheme = process.env.NEXT_PUBLIC_THEME as ThemeName; // Default theme
    const [themeName, setThemeName] = useState<ThemeName>(
        themeMap[defaultTheme] ? defaultTheme : 'hacker'
    );
    const [theme, setTheme] = useState(themeMap[themeName]);

    useEffect(() => {
        const savedThemeName = localStorage.getItem('theme') as ThemeName;
        if (savedThemeName && themeMap[savedThemeName]) {
            setThemeName(savedThemeName);
            setTheme(themeMap[savedThemeName]);
        }
    }, []);

    const changeTheme = (newThemeName: ThemeName) => {
        setThemeName(newThemeName);
        setTheme(themeMap[newThemeName]);
        localStorage.setItem('theme', newThemeName);
    };

    // Add global styles to ensure body background matches theme
    const styles = {
        global: {
            'html, body': {
                bg: 'background',
                color: 'text',
            }
        }
    };

    // Extend the selected theme with our global styles
    const extendedTheme = extendTheme({ styles }, theme);

    return (
        <ThemeContext.Provider value={{ themeName, setThemeName: changeTheme, theme }}>
            <ChakraProvider theme={extendedTheme}>{children}</ChakraProvider>
        </ThemeContext.Provider>
    );
};
