import {
    Box,
    Button,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Text,
} from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { loginWithKeychain } from '@/lib/hive/client-functions';
interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}
declare global {
    interface Window {
        hive_keychain: any; // Define the type as `any` or specify a more detailed type if you know it.
    }
}
export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const [isKeychainInstalled, setIsKeychainInstalled] = useState(false);
    const [username, setUsername] = useState('');

    useEffect(() => {
        if (window.hive_keychain) {
            setIsKeychainInstalled(true);
        } else {
            setIsKeychainInstalled(false);
        }
    }, []);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    };

    const handleLogin = async () => {
        if (isKeychainInstalled) {
            //console.log('Logging in with username:', username);
            const login = await loginWithKeychain(username);
            //console.log(login?.login.success)
            if (login?.login.success) localStorage.setItem('username', username)
        } else {
            alert('Hive Keychain is not installed!');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay bg="rgba(0, 0, 0, 0.6)" backdropFilter="blur(10px)" />
            <ModalContent>
                <ModalHeader>Login</ModalHeader>
                <ModalBody>
                    <Text mb={2}>Username</Text>
                    <Input
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        colorScheme="primary"
                        onClick={handleLogin}
                        isDisabled={!isKeychainInstalled}
                    >
                        Login
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
