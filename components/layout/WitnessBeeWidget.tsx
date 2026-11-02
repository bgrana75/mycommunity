'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

const POLL_MS = 4000;
const STRIKES = 3;
const FRAMES = ['a', 'b', 'c'] as const;
type Frame = (typeof FRAMES)[number];
// wind-up, mid-swing, strike — one hammer blow per cycle
const FRAME_MS: Record<Frame, number> = { a: 380, b: 110, c: 320 };

const bob = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
`;
const hexFly = keyframes`
  0%   { transform: translate(0, 0) rotate(0deg) scale(0.4); opacity: 0; }
  15%  { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(1); opacity: 0; }
`;

interface Hex {
  id: number;
  dx: number;
  dy: number;
  rot: number;
}

function Hexagon() {
  return (
    <svg viewBox="0 0 100 100" width="26" height="26" aria-hidden>
      <polygon
        points="50,4 91,27 91,73 50,96 9,73 9,27"
        fill="#4cc4ff"
        stroke="#e8f8ff"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WitnessBeeWidget() {
  const [frame, setFrame] = useState<Frame>('a');
  const [forging, setForging] = useState(false);
  const [block, setBlock] = useState<number | null>(null);
  const [hexes, setHexes] = useState<Hex[]>([]);
  const lastBlock = useRef<number | null>(null);
  const hexId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const forge = useCallback(() => {
    if (timers.current.length) return; // already mid-sequence
    setForging(true);
    let t = 0;
    for (let i = 0; i < STRIKES; i++) {
      later(() => setFrame('a'), t);
      t += FRAME_MS.a;
      later(() => setFrame('b'), t);
      t += FRAME_MS.b;
      later(() => {
        setFrame('c');
        const id = ++hexId.current;
        const side = id % 2 ? 1 : -1;
        const hex = { id, dx: side * (40 + Math.random() * 70), dy: -(90 + Math.random() * 80), rot: side * (120 + Math.random() * 200) };
        setHexes((h) => [...h, hex]);
        later(() => setHexes((h) => h.filter((x) => x.id !== id)), 1300);
      }, t);
      t += FRAME_MS.c;
    }
    later(() => {
      setFrame('a');
      setForging(false);
      timers.current = [];
    }, t + 150);
  }, [later]);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch('/api/witness-status');
        if (!res.ok) return;
        const { lastBlock: next } = await res.json();
        if (stopped || typeof next !== 'number') return;
        if (lastBlock.current !== null && next > lastBlock.current) forge();
        lastBlock.current = next;
        setBlock(next);
      } catch {
        // widget just keeps idling
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [forge]);

  return (
    <Box px={3} pt={3} pb={1} textAlign="center" userSelect="none">
      <Box
        position="relative"
        w="170px"
        h="238px"
        mx="auto"
        cursor="pointer"
        onClick={forge}
        title="Snapie, hammering out blocks"
        sx={{ '@media (prefers-reduced-motion: reduce)': { '& *': { animation: 'none !important' } } }}
      >
        <Box
          position="absolute"
          inset={0}
          animation={forging ? undefined : `${bob} 3.2s ease-in-out infinite`}
        >
          {FRAMES.map((f) => (
            <Box
              key={f}
              as="img"
              src={`/snapie-bee/hammer-${f}.webp`}
              alt={f === 'a' ? 'Snapie the witness bee' : ''}
              position="absolute"
              inset={0}
              w="100%"
              h="100%"
              opacity={frame === f ? 1 : 0}
              draggable={false}
            />
          ))}
          {hexes.map((h) => (
            <Box
              key={h.id}
              position="absolute"
              left="29%"
              top="85%"
              ml="-13px"
              mt="-13px"
              pointerEvents="none"
              style={{ ['--dx' as string]: `${h.dx}px`, ['--dy' as string]: `${h.dy}px`, ['--rot' as string]: `${h.rot}deg` }}
              animation={`${hexFly} 1.2s ease-out forwards`}
            >
              <Hexagon />
            </Box>
          ))}
        </Box>
      </Box>
      <Text fontSize="xs" color="overlay.500" mt={1}>
        {forging ? 'Snapie just signed a block!' : 'Snapie witness'}
        {block !== null && (
          <Text as="span" color="overlay.400">
            {' '}· #{block.toLocaleString()}
          </Text>
        )}
      </Text>
    </Box>
  );
}
