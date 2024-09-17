'use client';
import { Flex, IconButton, Menu, MenuButton, MenuList, MenuItem, Button } from '@chakra-ui/react';
import { FaTh, FaBars, FaPen, FaSort } from 'react-icons/fa'; 
import { useRouter } from 'next/navigation';

interface TopBarProps {
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;
    setQuery: (query: string) => void;
}

export default function TopBar({ viewMode, setViewMode, setQuery }: TopBarProps) {
    const router = useRouter(); 

    return (
        <Flex justifyContent="space-between" mb={4}>
            <IconButton
                aria-label="Compose"
                icon={<FaPen />}  
                onClick={() => router.push('/compose')}  
                variant="outline"  
            />
            <Flex justifyContent="flex-end">
                <IconButton
                    aria-label="Grid View"
                    icon={<FaTh />} 
                    onClick={() => setViewMode('grid')}
                    isActive={viewMode === 'grid'}
                    variant={viewMode === 'grid' ? 'solid' : 'outline'}  
                />
                <IconButton
                    aria-label="List View"
                    icon={<FaBars />}  
                    onClick={() => setViewMode('list')}
                    isActive={viewMode === 'list'}
                    variant={viewMode === 'list' ? 'solid' : 'outline'}
                    ml={4}
                />
                <Menu>
                    <MenuButton
                        as={Button}
                        aria-label="Sort Options"
                        leftIcon={<FaSort />} 
                        variant="outline"
                        ml={4}
                    >
                        Sort
                    </MenuButton>
                    <MenuList>
                        <MenuItem onClick={() => setQuery('created')}>Recent</MenuItem>
                        <MenuItem onClick={() => setQuery('trending')}>Trending</MenuItem>
                        <MenuItem onClick={() => setQuery('hot')}>Hot</MenuItem>
                    </MenuList>
                </Menu>
            </Flex>
        </Flex>
    );
}
