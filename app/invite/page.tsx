// pages/invite.tsx
'use client';
import { useState } from 'react';
import { createInvitation } from '@/lib/supabase/supabaseService';
import { useToast, Box, FormControl, FormLabel, Input, Button, Heading } from '@chakra-ui/react';
import { sendInvite } from '@/lib/hive/server-functions';

const InvitePage = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [referral, setReferral] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const inviteCode = await createInvitation(email, name, referral);
      sendEmail(email, inviteCode);
      toast({
        title: 'Invitation Sent.',
        description: `An invitation link has been sent to ${email}.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error.',
        description: 'Failed to send the invitation.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }

    setIsLoading(false);
  };

  const sendEmail = (email: string, inviteCode: string) => {
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    sendInvite(email, inviteUrl);
    console.log(`Send email to ${email} with invite link: ${inviteUrl}`);
  };

  return (
    <Box maxW="md" mx="auto" p={4}>
      <Heading as="h1" size="xl" mb={4}>
        Create an Invitation
      </Heading>
      <form onSubmit={handleSubmit}>
        <FormControl id="email" isRequired mb={4}>
          <FormLabel>Email</FormLabel>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter recipient's email"
            required
          />
        </FormControl>

        <FormControl id="name" mb={4}>
          <FormLabel>Name (optional)</FormLabel>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter recipient's name"
          />
        </FormControl>

        <FormControl id="referral" mb={4}>
          <FormLabel>Referral (optional)</FormLabel>
          <Input
            type="text"
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
            placeholder="Enter referral code"
          />
        </FormControl>

        <Button
          type="submit"
          isLoading={isLoading}
          loadingText="Sending..."
          colorScheme="teal"
          width="full"
        >
          Send Invitation
        </Button>
      </form>
    </Box>
  );
};

export default InvitePage;
