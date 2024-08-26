import React, { useRef } from 'react';
import { Box, Image, IconButton, Wrap, Input, Button } from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';

interface ImageUploaderProps {
    onUpload: (files: File[]) => void;
    onRemove: (index: number) => void;
    images: File[];
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onUpload, onRemove, images }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        onUpload(files);
    };

    const triggerFileInput = () => {
        if (inputRef.current) {
            inputRef.current.click();
        }
    };

    return (
        <Box onClick={triggerFileInput}>

            <Input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                hidden
            />

        </Box>
    );
};

export default ImageUploader;
