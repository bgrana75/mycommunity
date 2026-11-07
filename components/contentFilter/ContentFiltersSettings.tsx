'use client';
import { Box, Flex, Input, Switch, Tag, TagCloseButton, TagLabel, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { useState, type KeyboardEvent } from 'react';
import { describeRule, type MuteRule } from '@snapie/content-filter';
import { useContentFilter } from '@/hooks/useContentFilter';

/** `#tag`/`tag` → tag rule, `app:name` → app rule, `app:name #tag` → app+tag. */
export function parseRuleInput(raw: string): MuteRule | null {
  const text = raw.trim();
  if (!text) return null;
  const m = text.match(/^app:\s*(\S+)(?:\s+#?(\S+))?$/i);
  if (m) return m[2] ? { kind: 'app_tag', app: m[1], tag: m[2] } : { kind: 'app', app: m[1] };
  if (/\s/.test(text)) return null;
  return { kind: 'tag', tag: text };
}

/** Settings → Content filters: preset switches, then the user's own rules. */
export default function ContentFiltersSettings() {
  const { prefs, catalog, addRule, removeRule, setPreset } = useContentFilter();
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    if (!draft.trim()) return;
    const rule = parseRuleInput(draft);
    if (!rule) { setInvalid(true); return; }
    addRule(rule);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && prefs.rules.length > 0) {
      removeRule(prefs.rules[prefs.rules.length - 1]);
    }
  };

  return (
    <Box>
      {Object.values(catalog).map(preset => (
        <Flex key={preset.id} align="center" justify="space-between" gap={4} mb={4}>
          <Box>
            <Text color="text" fontWeight="medium" fontSize="sm">{preset.label}</Text>
            <Text color="overlay.500" fontSize="xs">{preset.description}</Text>
          </Box>
          <Switch
            isChecked={prefs.presets.includes(preset.id)}
            onChange={e => setPreset(preset.id, e.target.checked)}
            aria-label={preset.label}
          />
        </Flex>
      ))}

      {prefs.rules.length > 0 && (
        <Wrap spacing={2} mb={3}>
          {prefs.rules.map(rule => {
            const label = describeRule(rule);
            return (
              <WrapItem key={label}>
                <Tag size="md" borderRadius="full" colorScheme="red" variant="subtle">
                  <TagLabel>{label}</TagLabel>
                  <TagCloseButton onClick={() => removeRule(rule)} aria-label={`Unhide ${label}`} />
                </Tag>
              </WrapItem>
            );
          })}
        </Wrap>
      )}

      <Input
        placeholder="#hashtag, or app:hiveword — press Enter"
        size="sm"
        borderRadius="10px"
        value={draft}
        isInvalid={invalid}
        onChange={e => { setDraft(e.target.value); setInvalid(false); }}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      <Text color="overlay.500" fontSize="xs" mt={2}>
        Tip: the eye icon on a snap hides posts like it.
      </Text>
    </Box>
  );
}
