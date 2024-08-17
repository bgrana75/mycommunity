import { Box, Flex, Text, VStack, HStack, Button, Input } from '@chakra-ui/react';
import RightSidebar from './components/RightSideBar';

export default function Home() {
  return (
    <Box bg="background" color="text" minH="100vh">
      {/* Header */}
      <Box bg="secondary" px={{ base: 4, md: 6 }} py={4}>
        <Flex justify="space-between" align="center">
          <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold">
            HackerFeed
          </Text>
          <Input
            placeholder="Search HackerFeed"
            maxW="400px"
            bg="muted"
            borderColor="border"
            _placeholder={{ color: 'text' }}
            display={{ base: 'none', md: 'block' }}
          />
          <Button variant="solid" colorScheme="primary">
            Tweet
          </Button>
        </Flex>
      </Box>

      <Flex direction={{ base: 'column', md: 'row' }}>
        {/* Sidebar */}
        <Box
          as="nav"
          bg="muted"
          p={4}
          w={{ base: 'full', md: '20%' }}
          minH={{ base: 'auto', md: '100vh' }}
          display={{ base: 'none', md: 'block' }}
        >
          <VStack spacing={4} align="start">
            <Button variant="ghost" w="full">
              Home
            </Button>
            <Button variant="ghost" w="full">
              Explore
            </Button>
            <Button variant="ghost" w="full">
              Notifications
            </Button>
            <Button variant="ghost" w="full">
              Messages
            </Button>
            <Button variant="ghost" w="full">
              Profile
            </Button>
            <Button variant="ghost" w="full">
              More
            </Button>
          </VStack>
        </Box>

        {/* Main Feed */}
        <Box flex="1" p={4}>
          <VStack spacing={4} align="stretch">
            {/* Tweet Composer */}
            <Box bg="muted" p={4} borderRadius="md">
              <Input
                placeholder="What's happening?"
                bg="background"
                borderColor="border"
                mb={3}
                _placeholder={{ color: 'text' }}
              />
              <HStack justify="space-between">
                <HStack>
                  <Button variant="ghost">Image</Button>
                  <Button variant="ghost">GIF</Button>
                  <Button variant="ghost">Poll</Button>
                </HStack>
                <Button variant="solid" colorScheme="primary">
                  Tweet
                </Button>
              </HStack>
            </Box>

            {/* Example Tweet */}
            <Box bg="muted" p={4} borderRadius="md">
              <Text fontWeight="bold" mb={2}>
                HackerUser
              </Text>
              <Text>
                Just hacked into the mainframe! #HackerLife #Code
              </Text>
              <HStack justify="space-between" mt={3}>
                <Button variant="ghost">Like</Button>
                <Button variant="ghost">Comment</Button>
                <Button variant="ghost">Share</Button>
              </HStack>
            </Box>
          </VStack>
        </Box>

        {/* Right Sidebar */}
        <RightSidebar />

        {/* Footer Navigation for Mobile */}
        <Box
          as="nav"
          position="fixed"
          bottom="0"
          left="0"
          right="0"
          bg="secondary"
          p={2}
          borderTop="1px solid"
          borderColor="border"
          display={{ base: 'block', md: 'none' }}
        >
          <HStack justify="space-around">
            <Button variant="ghost">Home</Button>
            <Button variant="ghost">Explore</Button>
            <Button variant="ghost">Notifications</Button>
            <Button variant="ghost">Messages</Button>
          </HStack>
        </Box>
      </Flex>
    </Box>
  );
}
