import { useState } from 'react';
import { Box, Button, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text } from '@chakra-ui/react';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    showMemoField?: boolean;
    showUsernameField?: boolean; // New prop to show the username field
    onConfirm: (amount: number, username?: string, memo?: string) => void; // Include username in the onConfirm callback
}

export default function WalletModal ({ isOpen, onClose, title, description, showMemoField = false, showUsernameField = false, onConfirm }: WalletModalProps) {
    const [amount, setAmount] = useState<number>(0);
    const [memo, setMemo] = useState<string>('');
    const [username, setUsername] = useState<string>(''); // State to hold username

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(parseFloat(e.target.value) || 0);
    };

    const handleMemoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMemo(e.target.value);
    };

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(e.target.value);
    };

    const handleConfirm = () => {
        onConfirm(amount, showUsernameField ? username : undefined, showMemoField ? memo : undefined);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>{title}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {description && <Text fontSize={'small'} mb={4}>{description}</Text>}
                    <Box mb={4}>
                        <Input
                            type="number"
                            placeholder="Enter amount"
                            value={amount}
                            onChange={handleAmountChange}
                            min={0}
                        />
                    </Box>
                    {showUsernameField && (
                        <Box mb={4}>
                            <Input
                                placeholder="Enter username"
                                value={username}
                                onChange={handleUsernameChange}
                            />
                        </Box>
                    )}
                    {showMemoField && (
                        <Box mb={4}>
                            <Input
                                placeholder="Enter memo (optional)"
                                value={memo}
                                onChange={handleMemoChange}
                            />
                        </Box>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button ml={3} onClick={handleConfirm}>Confirm</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
