import { Box, Avatar, Text, HStack } from '@chakra-ui/react';
import { Notifications } from '@hiveio/dhive';

interface NotificationItemProps {
  notification: Notifications; // Adjust type to match the actual Notifications type
}

export default function NotificationItem({ notification }: NotificationItemProps) {
  const author = notification.msg.trim().split(' ')[0].slice(1);
  console.log(author);

  return (
    <HStack
      spacing={4}
      p={4}
      borderWidth="1px"
      borderRadius="none"
      bg="gray.300"
      w="full"
      align="stretch"
    >
      <Avatar src={`https://images.hive.blog/u/${author}/avatar/sm`} name='' />
      <Box flex="1"> {/* Ensure Box takes up remaining space */}
        <Text fontWeight="semibold">{author}</Text>
        <Text>{notification.msg}</Text>
        <Text color="gray.500" fontSize="sm">
          {notification.date}
        </Text>
      </Box>
    </HStack>
  );
}
