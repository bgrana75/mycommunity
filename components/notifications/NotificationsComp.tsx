// components/NotificationsComp.tsx
import { useEffect, useState } from 'react';
import { fetchNewNotifications } from '@/lib/hive/client-functions';
import { Box, Text, Stack, Spinner, Button, HStack } from '@chakra-ui/react';
import { useAioha } from '@aioha/react-ui';
import { KeyTypes } from '@aioha/aioha';
import { Notifications } from '@hiveio/dhive';
import NotificationItem from './NotificationItem'; // Import the NotificationItem component

export default function NotificationsComp() {
  const { user, aioha } = useAioha();
  const [notifications, setNotifications] = useState<Notifications[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Add isLoading state

  useEffect(() => {
    const loadNotifications = async () => {
      if (user) {
        try {
          setIsLoading(true); // Set loading to true before fetching
          const newNotifications = await fetchNewNotifications(user);
          setNotifications(newNotifications);
        } catch (error) {
          console.error("Failed to fetch notifications:", error);
        } finally {
          setIsLoading(false); // Set loading to false after fetching
        }
      }
    };

    loadNotifications();
  }, [user]);

  // Function to handle "Mark as Read" button click
  async function handleMarkAsRead () {
    const now = new Date().toISOString(); 
    const json = JSON.stringify(["setLastRead", { date: now }]);
    const result = await aioha.signAndBroadcastTx([
      ['custom_json', {
        required_auths: [],
        required_posting_auths: [user],
        id: 'notify',
        json: json,
      }]
    ], KeyTypes.Posting)
    console.log("Mark as Read clicked", result);
  };

  return (
    <Box p={4} w="full">
    <HStack mb={4} spacing={4} align="center" justify="space-between">
      <Text fontSize="2xl" fontWeight="bold">
        Notifications
      </Text>
      <Button onClick={handleMarkAsRead} colorScheme="blue" size="sm">
        Mark as Read
      </Button>
    </HStack>
      {isLoading ? ( // Show spinner while loading
        <Spinner size="lg" />
      ) : notifications.length > 0 ? (
        <Stack spacing={4} w="full">
          {notifications.map(notification => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </Stack>
      ) : (
        <Text>No notifications</Text>
      )}
    </Box>
  );
}
