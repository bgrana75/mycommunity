'use client';
import {
  Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Stack, Text, useToast,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { describeRule, hasRule, suggestRules, type FilterableContent, type MuteRule } from '@snapie/content-filter';
import { useContentFilter } from '@/hooks/useContentFilter';

interface Props {
  item: FilterableContent & { author?: string };
  isOpen: boolean;
  onClose: () => void;
}

/** Offers rules built from this post's own app and tags, so people don't have
 *  to guess which hashtag a game uses. Lazy-loaded from Snap.tsx. */
export default function HideLikeThisModal({ item, isOpen, onClose }: Props) {
  const { prefs, addRule, removeRule } = useContentFilter();
  const toast = useToast();
  const suggestions = useMemo(() => suggestRules(item), [item]);

  const choose = (rule: MuteRule) => {
    addRule(rule);
    onClose();
    toast({
      title: `Hidden: ${describeRule(rule)}`,
      description: 'Manage this in Settings → Content filters.',
      status: 'success',
      duration: 6000,
      isClosable: true,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered>
      <ModalOverlay />
      <ModalContent bg="surface" borderColor="surfaceBorder" borderWidth="1px">
        <ModalHeader fontSize="md">Hide posts like this</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {suggestions.length === 0 ? (
            <Text fontSize="sm" color="overlay.500">
              This post has no app or hashtags to filter by.
            </Text>
          ) : (
            <Stack spacing={2}>
              {suggestions.map(({ rule, label }) => {
                const active = hasRule(prefs, rule);
                return (
                  <Button
                    key={label}
                    size="sm"
                    variant={active ? 'solid' : 'outline'}
                    justifyContent="flex-start"
                    onClick={() => (active ? removeRule(rule) : choose(rule))}
                    aria-pressed={active}
                  >
                    {active ? `✓ ${label} (click to unhide)` : label}
                  </Button>
                );
              })}
            </Stack>
          )}
          <Text fontSize="xs" color="overlay.500" mt={4}>
            Applies to snaps, waves, comments and blog posts. Synced to your account when you&apos;re logged in.
          </Text>
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
