import React, { useEffect, useState } from 'react';
import { Input, Center, Spinner, InputGroup, InputRightElement } from '@chakra-ui/react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch, GifsResult } from '@giphy/js-fetch-api';
import { IGif } from '@giphy/js-types';
import { FaSearch } from 'react-icons/fa';

interface GiphySelectorProps {
    apiKey: string;
    onSelect: (gif: IGif, e: React.SyntheticEvent<HTMLElement>) => void;
}

const GiphySelector: React.FC<GiphySelectorProps> = ({ apiKey, onSelect }) => {
    const gf = new GiphyFetch(apiKey);
    const [searchTerm, setSearchTerm] = useState('skateboard funny');
    const [isLoading, setIsLoading] = useState(false);
    const [key, setKey] = useState(0); // Add a key state to force re-render

    const fetchGifs = async (offset: number): Promise<GifsResult> => {
        setIsLoading(true);
        const result = searchTerm
            ? await gf.search(searchTerm, { offset, limit: 10 })
            : await gf.trending({ offset, limit: 10 });
        setIsLoading(false);
        return result;
    };

    const handleSearchTermChange = (value: string) => {
        setSearchTerm(value);
    };

    const handleSearchIconClick = () => {
        fetchGifs(0); // Fetch GIFs from the start when the search icon is clicked
        setKey(key + 1); // Increment the key to force re-render of the Grid component
    };

    const handleGifClick = (gif: IGif, e: React.SyntheticEvent<HTMLElement>) => {
        onSelect(gif, e);
    };

    useEffect(() => {
        fetchGifs(0);
        setKey(key + 1); // Increment the key to force re-render of the Grid component
    }
        , [searchTerm]);

    return (
        <>
            <InputGroup>
                <InputRightElement>
                    {isLoading ? <Spinner /> : <FaSearch cursor="pointer" onClick={handleSearchIconClick} />}
                </InputRightElement>
                <Input
                    pr="4.5rem"
                    placeholder="Type to search..."
                    value={searchTerm}
                    onChange={(e) => handleSearchTermChange(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            fetchGifs(0); // Allows pressing Enter to search
                            setKey(key + 1); // Increment the key to force re-render of the Grid component
                        }
                    }}
                />
            </InputGroup>
            <Center mt={4}>
                <Grid
                    key={key} // Use the key prop to force re-rendering when the search term changes
                    width={450}
                    columns={3}
                    fetchGifs={fetchGifs} // Use the fetchGifs function to get GIFs based on the current search term
                    onGifClick={handleGifClick}
                />
            </Center>
        </>
    );
};

export default GiphySelector;
