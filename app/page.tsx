import { Box, Flex, Text, VStack, HStack, Button, Input } from '@chakra-ui/react';

export default function Home() {
  return (
    <Box bg="background" color="text" minH="100vh">
      {/* Header */}
      <Box bg="secondary" px={6} py={4}>
        <Flex justify="space-between" align="center">
          <Text fontSize="2xl" fontWeight="bold">
            HackerFeed
          </Text>
          <Input
            placeholder="Search HackerFeed"
            maxW="400px"
            bg="muted"
            borderColor="border"
            _placeholder={{ color: 'text' }}
          />
          <Button variant="solid" colorScheme="primary">
            Tweet
          </Button>
        </Flex>
      </Box>

      <Flex>
        {/* Sidebar */}
        <Box as="nav" bg="muted" p={4} w="20%" minH="100vh">
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

        {/* Footer */}
        <Box as="footer" bg="secondary" p={4} textAlign="center">
          <Text>&copy; 2024 HackerFeed. All rights reserved.</Text>
        </Box>
      </Flex>
    </Box>
  );
}
