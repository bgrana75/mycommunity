import React, { useState, useEffect } from 'react';
import { Input, Center, Spinner } from '@chakra-ui/react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { IGif } from '@giphy/js-types';

interface GiphySelectorProps {
    apiKey: string;
    onSelect: (gif: IGif, e: React.SyntheticEvent<HTMLElement>) => void;
}

const GiphySelector: React.FC<GiphySelectorProps> = ({ apiKey, onSelect }) => {
    const gf = new GiphyFetch(apiKey);
    const [searchTerm, setSearchTerm] = useState('skateboard funny');
    const [gifs, setGifs] = useState<IGif[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchGifs = async () => {
            setIsLoading(true);
            const { data } = searchTerm
                ? await gf.search(searchTerm, { limit: 10 })
                : await gf.trending({ limit: 10 });
            setGifs(data);
            setIsLoading(false);
        };

        fetchGifs();
    }, [searchTerm]);

    const handleSearchTermChange = (value: string) => {
        setSearchTerm(value);
    };

    // Custom handler to prevent default behavior
    const handleGifClick = (gif: IGif, e: React.SyntheticEvent<HTMLElement>) => {
        e.persist(); // Persist the event
        onSelect(gif, e); // Call the onSelect with synthetic event
    };

    return (
        <>
            <Input
                placeholder="Type to search..."
                onChange={(e) => handleSearchTermChange(e.target.value)}
                m={4}
            />
            {isLoading && <Spinner />}
            <Center>
                <Grid
                    width={450}
                    columns={3}
                    fetchGifs={(offset: any) => gf.search(searchTerm, { offset, limit: 10 })}
                    onGifClick={handleGifClick}
                />
            </Center>
        </>
    );
};

export default GiphySelector;
