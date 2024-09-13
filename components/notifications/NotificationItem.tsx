import { Box, Avatar, Text, HStack, IconButton, Link } from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons'; // Import the external link icon
import { Notifications } from '@hiveio/dhive';

interface NotificationItemProps {
  notification: Notifications;
}

export default function NotificationItem({ notification }: NotificationItemProps) {
  console.log(notification);
  const author = notification.msg.trim().split(' ')[0].slice(1);

  const formattedDate = new Date(notification.date + 'Z').toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // 24-hour format
  });

  return (
    <HStack
      spacing={4}
      p={4}
      borderWidth="1px"
      borderRadius="none"
      bg="muted"
      w="full"
      align="stretch"
    >
      <Avatar src={`https://images.hive.blog/u/${author}/avatar/sm`} name='' />
      <Box flex="1"> {/* Ensure Box takes up remaining space */}
        <Text fontWeight="semibold">{author}</Text>
        <Text>{notification.msg}</Text>
        <Text fontSize="sm">
          {formattedDate}
        </Text>
      </Box>
      {notification.url && (
        <Link href={'/' + notification.url}>
          <IconButton
            aria-label="Open notification"
            icon={<ExternalLinkIcon />}
            variant="ghost"
            size="lg"
            isRound
            alignSelf="center" // Center the icon vertically
          />
        </Link>
      )}
    </HStack>
  );
}
