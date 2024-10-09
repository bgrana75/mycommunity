// pages/invite-code.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInvitationByCode } from '@/lib/supabase/supabaseService';
import { checkAccountName } from '@/lib/hive/client-functions';
import { createAccount, generatePassword, getPrivateKeys } from '@/lib/hive/server-functions';
import {
  Box,
  Heading,
  Text,
  Input,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Checkbox,
  useToast,
  IconButton,
} from '@chakra-ui/react';
import { CopyIcon } from '@chakra-ui/icons'; // Import CopyIcon from Chakra UI

const InviteCodePage = () => {
  const { code } = useParams();
  const router = useRouter();
  const toast = useToast(); // Initialize toast
  const [invitation, setInvitation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsed, setIsUsed] = useState(false);
  const [username, setUsername] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [isChecked, setIsChecked] = useState(false);

  const inviteCode = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const invite = await getInvitationByCode(inviteCode);
        if (!invite || invite.is_used || new Date(invite.expires_at) < new Date()) {
          throw new Error('Invalid or expired invitation.');
        }
        setInvitation(invite);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (inviteCode) {
      fetchInvitation();
    }
  }, [inviteCode]);

  const handleUseInvite = () => {
    setIsUsed(true);
    router.push('/account-creation');
  };

  const handleUsernameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setUsername(newUsername);

    if (newUsername) {
      try {
        const suggestedUsername = await checkAccountName(newUsername);

        if (suggestedUsername && suggestedUsername.toLowerCase().startsWith(newUsername.toLowerCase())) {
          setIsAvailable(false);
        } else {
          setIsAvailable(true);
        }
      } catch (err) {
        console.error('Error checking username:', err);
        setIsAvailable(false);
      }
    } else {
      setIsAvailable(null);
    }
  };

  const handleGenerateKeys = async () => {
    try {
      const newPassword = await generatePassword();
      setPassword(newPassword);
      const generatedKeys = await getPrivateKeys(username, newPassword);
      setKeys(generatedKeys);
    } catch (err) {
      console.error('Error generating keys:', err);
      setKeys([]);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard!",
        description: "Your text has been copied to clipboard.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }).catch((err) => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleCreateAccount = async () => {
    try {
      if (password) {
        await createAccount(username, password);
        toast({
          title: "Account created!",
          description: "Your account has been successfully created.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        // Optionally, you can redirect to another page after account creation
        // router.push('/somepage');
      }
    } catch (error) {
      console.error('Error creating account:', error);
      toast({
        title: "Account creation failed",
        description: "There was an issue creating your account. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error || !invitation) {
    return (
      <Box maxW="lg" mx="auto" p={6}>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Error:</AlertTitle>
          <AlertDescription>{error || 'Invalid or expired invitation.'}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  return (
    <Box maxW="xl" mx="auto" p={6}> {/* Increased maxW for a larger box */}
      <Heading as="h1" size="xl" mb={4}>
        You are invited to join Hive!
      </Heading>
      <Text>Email: {invitation.email}</Text>
      {isUsed ? (
        <Text>This invitation has already been used.</Text>
      ) : (
        <>
          <Input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={handleUsernameChange}
            mt={4}
            mb={2}
          />
          {isAvailable === true && (
            <Text color="green.500" mb={2}>
              Username is available!
            </Text>
          )}
          {isAvailable === false && (
            <Text color="red.500" mb={2}>
              Username is already taken.
            </Text>
          )}
          {password ? (
            <>
              <Box mt={4}>
                <Heading as="h3" size="lg" mb={2}>
                  Generated Password
                  <IconButton
                    icon={<CopyIcon />}
                    onClick={() => handleCopyToClipboard(password)}
                    aria-label="Copy password to clipboard"
                    size="sm"
                    ml={2}
                  />
                </Heading>
                <Text>{password}</Text>
                <Heading as="h3" size="lg" mt={4} mb={2}>
                  Generated Keys
                  <IconButton
                    icon={<CopyIcon />}
                    onClick={() => handleCopyToClipboard(JSON.stringify(keys))}
                    aria-label="Copy keys to clipboard"
                    size="sm"
                    ml={2}
                  />
                </Heading>
                <Text fontSize="xs" whiteSpace="pre-wrap">{JSON.stringify(keys, null, 2)}</Text>
              </Box>
              <Checkbox
                isChecked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                mt={4}
              >
                I have copied my keys and password.
              </Checkbox><br />
              <Button
                onClick={handleCreateAccount}
                isDisabled={!isChecked} // Disable if checkbox is not checked
                colorScheme="teal"
                mt={4}
              >
                Create Account
              </Button>
            </>
          ) : (
            <Button
              onClick={handleGenerateKeys}
              disabled={!isAvailable || !username}
              colorScheme="teal"
              mt={2}
            >
              Generate Keys
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

export default InviteCodePage;
