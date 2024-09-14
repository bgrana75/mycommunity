import { useState, useEffect } from 'react';
import useHiveAccount from "@/hooks/useHiveAccount";
import { Box, Grid, GridItem, Text, Icon, HStack, Divider, Spinner, useDisclosure } from "@chakra-ui/react";
import { FaExchangeAlt, FaPiggyBank, FaStore, FaShoppingCart, FaArrowDown, FaShareAlt, FaDollarSign, FaArrowUp, FaPaperPlane } from "react-icons/fa";
import { Account, Asset } from '@hiveio/dhive'; // Adjust import based on actual usage
import { convertVestToHive } from '@/lib/hive/client-functions'; // Import the async function
import { extractNumber } from '@/lib/utils/extractNumber';
import WalletModal from '@/components/wallet/WalletModal'; // Import the new generic modal component
import { useRouter } from 'next/navigation';
import { useAioha } from '@aioha/react-ui';

interface MainWalletProps {
    username: string;
}

export default function MainWallet({ username }: MainWalletProps) {

    const router = useRouter()

    const { user, aioha } = useAioha()

    const { hiveAccount, isLoading, error } = useHiveAccount(username);
    const { isOpen, onOpen, onClose } = useDisclosure();

    const [modalContent, setModalContent] = useState<{ title: string, description?: string, showMemoField?: boolean, showUsernameField?: boolean } | null>(null);
    const [hivePower, setHivePower] = useState<string | undefined>(undefined);

    useEffect(() => {
        const fetchHivePower = async () => {
            if (hiveAccount?.vesting_shares) {
                try {
                    const power = (await convertVestToHive(Number(extractNumber(String(hiveAccount.vesting_shares))))).toFixed(3);
                    setHivePower(power.toString()); // Set the Hive Power as a string
                } catch (err) {
                    console.error("Failed to convert vesting shares to Hive power", err);
                }
            }
        };

        fetchHivePower();
    }, [hiveAccount?.vesting_shares]);

    const handleModalOpen = (title: string, description?: string, showMemoField?: boolean, showUsernameField?: boolean) => {
        setModalContent({ title, description, showMemoField, showUsernameField });
        onOpen();
    };

    const handleConfirm = (amount: number, username?: string, memo?: string) => {
        if (!modalContent) return;

        switch (modalContent.title) {
            case 'Send Hive':
                // Handle Send Hive logic here
                console.log('Send Hive - Amount:', amount, 'To:', username, 'Memo:', memo);
                break;
            case 'Send HBD':
                // Handle Send HBD logic here
                console.log('Send HBD - Amount:', amount, 'To:', username, 'Memo:', memo);
                break;
            case 'Delegate':
                // Handle Delegate logic here
                console.log('Delegate - Amount:', amount, 'To:', username);
                break;
            default:
                console.log('Default action - Amount:', amount, 'Memo:', memo);
                break;
        }
        onClose();
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <Spinner size="xl" color="primary" />
            </Box>
        );
    }

    if (error) {
        return <Text color="red.500">Failed to load account information.</Text>;
    }

    // Extract numeric values
    const balance = hiveAccount?.balance ? extractNumber(String(hiveAccount.balance)) : "N/A";
    const hbdBalance = hiveAccount?.hbd_balance ? extractNumber(String(hiveAccount.hbd_balance)) : "N/A";
    const savingsBalance = hiveAccount?.savings_balance ? extractNumber(String(hiveAccount.savings_balance)) : "N/A";
    const hbdSavingsBalance = hiveAccount?.savings_hbd_balance ? extractNumber(String(hiveAccount.savings_hbd_balance)) : "N/A";

    return (
        <Box p={4} borderWidth="1px" borderRadius="none" bg="muted" m={4}>
            <Grid 
                templateColumns="1fr auto auto" 
                rowGap={4}  
                alignItems="start" 
            >
                <GridItem>
                    <Text fontWeight="semibold">Token</Text>
                </GridItem>
                <GridItem textAlign="right" mr={8}>
                    <Text fontWeight="semibold">Balance</Text>
                </GridItem>
                <GridItem />

                <Divider gridColumn="1 / -1" />

                <GridItem>
                    <Text>Hive</Text>
                </GridItem>
                <GridItem textAlign="right" mr={8}>
                    <Text>{balance}</Text>
                </GridItem>
                <GridItem display="flex" alignItems="center" h={'100%'} >
                    <HStack spacing={3}>
                        <Icon as={FaPaperPlane} w={4} h={4} cursor="pointer" title="Send Hive"
                                onClick={() => handleModalOpen('Send Hive', 'Send Hive to another account', true, true)} 
                        />
                        <Icon as={FaArrowUp} w={4} h={4} cursor="pointer" title="Power Up"
                                onClick={() => handleModalOpen('Power Up', 'Power Up your HIVE to HP')} 
                        />
                        <Icon as={FaExchangeAlt} w={4} h={4} cursor="pointer" title="Convert to HBD"
                                onClick={() => handleModalOpen('Convert Hive', 'Convert Hive to HBD or vice versa')} 
                        />
                        <Icon as={FaPiggyBank} w={4} h={4} cursor="pointer" title="Send Hive to Savings"
                                onClick={() => handleModalOpen('Hive Savings', 'View Hive Savings')} 
                        />
                        <Icon as={FaStore} w={4} h={4} cursor="pointer" title="Hive/HBD Market"
                                onClick={() => router.push('https://hivedex.io/')} 
                        />
                        <Icon as={FaShoppingCart} w={4} h={4} cursor="pointer" title="Buy Hive"
                                onClick={() => router.push(`https://global.transak.com/?apiKey=771c8ab6-b3ba-4450-b69d-ca35e4b25eb8&redirectURL=${window.location.href}&cryptoCurrencyCode=HIVE&defaultCryptoAmount=200&exchangeScreenTitle=Buy%20HIVE&isFeeCalculationHidden=false&defaultPaymentMethod=credit_debit_card&walletAddress=${user}`)} 
                        />
                    </HStack>
                </GridItem>

                <Divider gridColumn="1 / -1" />

                {/* Hive Power (HP) */}
                <GridItem>
                    <Text>Hive Power (HP)</Text>
                </GridItem>
                <GridItem textAlign="right" mr={8}>
                    <Text>{hivePower !== undefined ? hivePower : "Loading..."}</Text>
                </GridItem>
                <GridItem display="flex" alignItems="center" h={'100%'}>
                    <HStack spacing={3}>
                        <Icon as={FaArrowDown} w={4} h={4} cursor="pointer" title="Power Down"
                                onClick={() => handleModalOpen('Power Down', 'Unstake Hive Power')} 
                        />
                        <Icon as={FaShareAlt} w={4} h={4} cursor="pointer" title="Delegate"
                                onClick={() => handleModalOpen('Delegate', 'Delegate HP to another user', false, true)} 
                        />
                    </HStack>
                </GridItem>

                <Divider gridColumn="1 / -1" />

                {/* Hive Backed Dollar (HBD) */}
                <GridItem>
                    <Text>Hive Backed Dollar (HBD)</Text>
                </GridItem>
                <GridItem textAlign="right" mr={8}>
                    <Text>{hbdBalance}</Text>
                </GridItem>
                <GridItem display="flex" alignItems="center" h={'100%'}>
                    <HStack spacing={3}>
                        <Icon as={FaPaperPlane} w={4} h={4} cursor="pointer" title="Send HBD"
                                onClick={() => handleModalOpen('Send HBD', 'Send HBD to another account', true, true)} 
                        />
                        <Icon as={FaExchangeAlt} w={4} h={4} cursor="pointer" title="Convert HBD"
                                onClick={() => handleModalOpen('Convert HBD', 'Convert HBD to Hive')} 
                        />
                        <Icon as={FaPiggyBank} w={4} h={4} cursor="pointer" title="Send HBD to Savings"
                                onClick={() => handleModalOpen('HBD Savings', 'Send HBD to Savings')} 
                        />
                        <Icon as={FaStore} w={4} h={4} cursor="pointer" title="HIVE/HBD Market"
                                onClick={() => handleModalOpen('HBD Store', 'Use HBD in the store')} 
                        />
                    </HStack>
                </GridItem>

                <Divider gridColumn="1 / -1" />

                {/* Hive Savings */}
                <GridItem>
                    <Text>Hive Savings</Text>
                </GridItem>
                <GridItem textAlign="right" mr={8}>
                    <Text>{savingsBalance}</Text>
                </GridItem>
                <GridItem display="flex" alignItems="center" h={'100%'}>
                    <HStack spacing={3}>
                        <Icon as={FaDollarSign} w={4} h={4} cursor="pointer" title="Withdraw From Savings"
                                onClick={() => handleModalOpen('Withdraw Hive Savings', 'Withdraw Hive from Savings')} 
                        />
                    </HStack>
                </GridItem>

                <Divider gridColumn="1 / -1" />

                {/* HBD Savings */}
                <GridItem>
                    <Text>HBD Savings</Text>
                </GridItem>
                <GridItem textAlign="right" mr={8}>
                    <Text>{hbdSavingsBalance}</Text>
                </GridItem>
                <GridItem display="flex" alignItems="center" h={'100%'}>
                    <HStack spacing={3}>
                        <Icon as={FaDollarSign} w={4} h={4} cursor="pointer" title="Withdraw From Savings"
                                onClick={() => handleModalOpen('Withdraw HBD Savings', 'Withdraw HBD from Savings')} 
                        />
                    </HStack>
                </GridItem>
            </Grid>
            <WalletModal
                isOpen={isOpen}
                onClose={onClose}
                title={modalContent?.title || ''}
                description={modalContent?.description}
                showMemoField={modalContent?.showMemoField}
                showUsernameField={modalContent?.showUsernameField} // Pass showUsernameField prop
                onConfirm={handleConfirm}
            />
        </Box>
    );
}
