import { useEffect, useState } from 'react';
import { fetchNewNotifications } from '@/lib/hive/client-functions';
import { Box, Text, Stack, Spinner } from '@chakra-ui/react';
import { useAioha } from '@aioha/react-ui';
import { Notifications } from '@hiveio/dhive';
import NotificationItem from './NotificationItem'; // 

export default function NotificationsComp() {
  const { user } = useAioha();
  const [notifications, setNotifications] = useState<Notifications[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); 

  useEffect(() => {
    const loadNotifications = async () => {
      if (user) {
        try {
          setIsLoading(true);
          const newNotifications = await fetchNewNotifications(user);
          setNotifications(newNotifications);
        } catch (error) {
          console.error("Failed to fetch notifications:", error);
        } finally {
          setIsLoading(false); 
        }
      }
    };

    loadNotifications();
  }, [user]);

  return (
    <Box p={4} w="full">
      <Text fontSize="2xl" fontWeight="bold" mb={4}>
        Notifications
      </Text>
      {isLoading ? ( 
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
