'use client';
import React, { useEffect, useState } from 'react';
import { Box, Select, Button, Text } from '@chakra-ui/react';
import { useTheme, ThemeName, themeMap } from '../themeProvider'; // Import the ThemeName type and themeMap

const Settings = () => {
    const { themeName, setThemeName } = useTheme();
    const [selectedTheme, setSelectedTheme] = useState<ThemeName>(themeName); // Use ThemeName type

    useEffect(() => {
        setSelectedTheme(themeName);
    }, [themeName]);

    const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newTheme = event.target.value as ThemeName; // Cast to ThemeName type
        setSelectedTheme(newTheme);
        setThemeName(newTheme); // This updates the theme globally via context
    };

    return (
        <Box p={5}>
            <Text fontSize="2xl" mb={4}>
                Settings
            </Text>
            <Select value={selectedTheme} onChange={handleThemeChange} mb={4}>
                {Object.keys(themeMap).map((theme) => (
                    <option key={theme} value={theme}>
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </option>
                ))}
            </Select>
            <Button colorScheme="teal">Theme Updated!</Button>
        </Box>
    );
};

export default Settings;
