import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NovaDock } from './NovaDock';
import { navIndex } from './nav';

describe('NovaDock', () => {
  it('renders all five destinations with the camera in the centre', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <NovaDock />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual(['Map', 'Chat', 'Camera', 'Stories', 'Spotlight']);
    expect(screen.getByLabelText('Chat')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Camera')).not.toHaveAttribute('aria-current');
  });

  it('maps paths to dock indexes', () => {
    expect(navIndex('/')).toBe(2);
    expect(navIndex('/chat')).toBe(1);
    expect(navIndex('/chat/123')).toBe(-1);
    expect(navIndex('/settings')).toBe(-1);
  });
});
