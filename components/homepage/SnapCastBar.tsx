'use client';
import { Box, Button, HStack, IconButton, Text, useToast } from '@chakra-ui/react';
import { FaVolumeUp, FaVolumeMute, FaLink } from 'react-icons/fa';
import { useUserSettings } from '@/hooks/useUserSettings';

interface SnapCastBarProps {
  author: string;
  permlink: string;
  live: boolean;
  onToggle: () => void;
  newCount: number;
  onShowNew: () => void;
}

/** Live toggle, sound toggle and share link for a Snap-Cast, plus the floating
 *  "N new snaps" pill shown when the reader has scrolled away from the top. */
export default function SnapCastBar({ author, permlink, live, onToggle, newCount, onShowNew }: SnapCastBarProps) {
  const { settings, update } = useUserSettings();
  const toast = useToast();

  function copyLink() {
    const url = `${window.location.origin}/@${author}/${permlink}?snapcast=1`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Snap-Cast link copied', description: 'Anyone opening it joins live.', status: 'success', duration: 2500 });
  }

  return (
    <>
      <HStack spacing={2} mb={3}>
        <Button
          size="sm"
          borderRadius="full"
          variant={live ? 'solid' : 'outline'}
          colorScheme={live ? 'red' : undefined}
          onClick={onToggle}
          aria-pressed={live}
        >
          {live ? '● Live' : 'Go live'}
        </Button>
        {live && (
          <>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={settings.snapCastSound ? 'Mute new-snap sound' : 'Play sound on new snaps'}
              icon={settings.snapCastSound ? <FaVolumeUp /> : <FaVolumeMute />}
              onClick={() => update({ snapCastSound: !settings.snapCastSound })}
            />
            <IconButton size="sm" variant="ghost" aria-label="Copy Snap-Cast link" icon={<FaLink />} onClick={copyLink} />
          </>
        )}
      </HStack>
      {live && newCount > 0 && (
        <Box position="fixed" top="72px" left="50%" transform="translateX(-50%)" zIndex={20}>
          <Button size="sm" borderRadius="full" colorScheme="blue" boxShadow="lg" onClick={onShowNew}>
            <Text>↑ {newCount} new {newCount === 1 ? 'snap' : 'snaps'}</Text>
          </Button>
        </Box>
      )}
    </>
  );
}
