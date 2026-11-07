import { describe, expect, it } from 'vitest';
import { parseRuleInput } from './ContentFiltersSettings';

describe('parseRuleInput', () => {
  it('parses tags, apps and app+tag', () => {
    expect(parseRuleInput(' #Scroddle ')).toEqual({ kind: 'tag', tag: '#Scroddle' });
    expect(parseRuleInput('app:hiveword')).toEqual({ kind: 'app', app: 'hiveword' });
    expect(parseRuleInput('APP: hivesuite #hivegaming')).toEqual({ kind: 'app_tag', app: 'hivesuite', tag: 'hivegaming' });
    expect(parseRuleInput('two words')).toBeNull();
    expect(parseRuleInput('')).toBeNull();
  });
});
