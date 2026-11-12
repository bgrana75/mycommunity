// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SiteFooter from './SiteFooter';

afterEach(cleanup);

describe('SiteFooter', () => {
  it('renders a dofollow Powered by Hive link to https://hive.io', () => {
    render(<SiteFooter />);

    const link = screen.getByRole('link', { name: 'Powered by Hive' });
    expect(link.getAttribute('href')).toBe('https://hive.io');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(link.getAttribute('rel')).not.toMatch(/nofollow|ugc|sponsored/i);
  });
});
