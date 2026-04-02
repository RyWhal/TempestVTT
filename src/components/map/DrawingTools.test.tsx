/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DrawingTools } from './DrawingTools';
import { useMapStore } from '../../stores/mapStore';
import { useSessionStore } from '../../stores/sessionStore';

describe('DrawingTools', () => {
  beforeEach(() => {
    useMapStore.setState({
      drawingTool: null,
      drawingColor: '#000000',
      drawingStrokeWidth: 4,
      drawingEmoji: '🌲',
      drawingEmojiScale: 1,
      fogToolMode: null,
      effectPaintMode: false,
    });
    useSessionStore.setState({
      session: null,
      currentUser: {
        username: 'GM',
        characterId: null,
        isGm: true,
      },
      players: [],
      connectionStatus: 'connected',
    });
  });

  it('replaces stroke buttons with a slider and removes the triangle tool', () => {
    render(<DrawingTools />);

    expect(screen.getByRole('slider', { name: /stroke width/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /triangle/i })).toBeNull();
  });

  it('renders visually separated sections for each draw control group', () => {
    render(<DrawingTools />);

    const sections = [
      screen.getByTestId('drawing-section-tools'),
      screen.getByTestId('drawing-section-colors'),
      screen.getByTestId('drawing-section-stroke'),
      screen.getByTestId('drawing-section-emoji'),
    ];

    expect(sections).toHaveLength(4);
    sections.slice(1).forEach((section) => {
      expect(section.className).toContain('border-t');
      expect(section.className).toContain('pt-3');
    });
  });
});
