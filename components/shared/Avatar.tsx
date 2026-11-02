'use client';
import { Avatar as ChakraAvatar, Box, Link as ChakraLink, SystemStyleObject, useImage } from '@chakra-ui/react';
import NextLink from 'next/link';
import { ReactNode } from 'react';
import { getHiveAvatarUrl } from '@/lib/utils/avatarUtils';
import {
  AVATAR_TOKEN_PX, AvatarSizeToken, ResponsiveAvatarSize, resolveAvatarToken, urlSizeForAvatarToken,
} from '@/lib/utils/avatarSizing';

const OVERLAY_OFFSETS: Record<string, { top?: string; bottom?: string; left?: string; right?: string }> = {
  'bottom-right': { bottom: '-2px', right: '-2px' },
  'top-right': { top: '-2px', right: '-2px' },
  'bottom-left': { bottom: '-2px', left: '-2px' },
  'top-left': { top: '-2px', left: '-2px' },
};

export interface AvatarProps {
  username: string;
  src?: string;
  size?: AvatarSizeToken | ResponsiveAvatarSize;
  href?: string;
  onClick?: () => void;
  overlay?: ReactNode;
  overlayPlacement?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';
  fallbackSrc?: string;
  sx?: SystemStyleObject;
  flexShrink?: number | string;
}

export function Avatar({
  username, src, size = 'sm', href, onClick, overlay,
  overlayPlacement = 'bottom-right', fallbackSrc, sx, flexShrink,
}: AvatarProps) {
  const token = resolveAvatarToken(size);
  const boxSize = typeof size === 'string' && size in AVATAR_TOKEN_PX ? undefined : size;
  const primarySrc = src ?? getHiveAvatarUrl(username, urlSizeForAvatarToken(token));

  // Chakra's Avatar has no built-in "try a second image, not just initials"
  // fallback, so track the primary image's load status ourselves and swap
  // to fallbackSrc on failure. Only ShortCard uses this today; everywhere
  // else fallbackSrc is undefined and this is a no-op.
  const primaryStatus = useImage({ src: primarySrc });
  const resolvedSrc = fallbackSrc && primaryStatus === 'failed' ? fallbackSrc : primarySrc;

  const avatarEl = (
    <ChakraAvatar
      size={token}
      {...(boxSize ? { boxSize } : {})}
      name={username}
      src={resolvedSrc}
      sx={sx}
    />
  );

  const content = overlay ? (
    <Box position="relative" flexShrink={flexShrink}>
      {avatarEl}
      <Box position="absolute" {...OVERLAY_OFFSETS[overlayPlacement]}>
        {overlay}
      </Box>
    </Box>
  ) : (
    flexShrink !== undefined
      ? <Box flexShrink={flexShrink} display="inline-block" lineHeight={0}>{avatarEl}</Box>
      : avatarEl
  );

  if (href) {
    return (
      <ChakraLink as={NextLink} href={href} prefetch={false} display="inline-block" _hover={{ textDecoration: 'none' }}>
        {content}
      </ChakraLink>
    );
  }

  if (onClick) {
    return (
      <Box as="button" onClick={onClick} display="inline-block" cursor="pointer">
        {content}
      </Box>
    );
  }

  return content;
}
