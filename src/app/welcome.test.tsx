import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WELCOME_FADE_MS,
  WELCOME_SEEN_KEY,
  WELCOME_SHOW_MS,
  WELCOME_TAGLINE,
  WelcomeSplash,
} from './layout/WelcomeSplash';

describe('WelcomeSplash', () => {
  beforeEach(() => {
    sessionStorage.removeItem(WELCOME_SEEN_KEY);
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the logo, name and tagline, then fades away on its own', () => {
    render(<WelcomeSplash />);
    const splash = screen.getByTestId('welcome');
    expect(splash).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Jasminum')).toBeInTheDocument();
    expect(screen.getByText(WELCOME_TAGLINE)).toBeInTheDocument();
    expect(sessionStorage.getItem(WELCOME_SEEN_KEY)).toBe('1');

    act(() => vi.advanceTimersByTime(WELCOME_SHOW_MS));
    expect(splash).toHaveAttribute('data-leaving');
    act(() => vi.advanceTimersByTime(WELCOME_FADE_MS));
    expect(screen.queryByTestId('welcome')).toBeNull();
  });

  it('a tap or a key press skips it', () => {
    const { unmount } = render(<WelcomeSplash />);
    fireEvent.pointerDown(window);
    act(() => vi.advanceTimersByTime(WELCOME_FADE_MS));
    expect(screen.queryByTestId('welcome')).toBeNull();
    unmount();

    sessionStorage.removeItem(WELCOME_SEEN_KEY);
    render(<WelcomeSplash />);
    fireEvent.keyDown(window, { key: 'Enter' });
    act(() => vi.advanceTimersByTime(WELCOME_FADE_MS));
    expect(screen.queryByTestId('welcome')).toBeNull();
  });

  it('does not show again in the same session (e.g. after a reload)', () => {
    sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
    render(<WelcomeSplash />);
    expect(screen.queryByTestId('welcome')).toBeNull();
  });
});
