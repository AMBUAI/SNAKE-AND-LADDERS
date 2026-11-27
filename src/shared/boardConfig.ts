import type { BoardTransition, PlayerColor } from './types.ts';

export const PLAYER_COLOR_ORDER: readonly PlayerColor[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
];

export interface ColorTheme {
  id: PlayerColor;
  label: string;
  hex: string;
  darkHex: string;
  lightHex: string;
  ringClass: string;
  bgClass: string;
  textClass: string;
  shapeLabel: string;
}

export const PLAYER_COLOR_THEMES: Record<PlayerColor, ColorTheme> = {
  red: {
    id: 'red',
    label: 'Red',
    hex: '#dc2626',
    darkHex: '#991b1b',
    lightHex: '#fee2e2',
    ringClass: 'ring-red-500',
    bgClass: 'bg-red-600',
    textClass: 'text-red-700',
    shapeLabel: 'R',
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    hex: '#2563eb',
    darkHex: '#1e40af',
    lightHex: '#dbeafe',
    ringClass: 'ring-blue-500',
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-700',
    shapeLabel: 'B',
  },
  green: {
    id: 'green',
    label: 'Green',
    hex: '#16a34a',
    darkHex: '#166534',
    lightHex: '#dcfce7',
    ringClass: 'ring-green-600',
    bgClass: 'bg-green-600',
    textClass: 'text-green-700',
    shapeLabel: 'G',
  },
  yellow: {
    id: 'yellow',
    label: 'Yellow',
    hex: '#eab308',
    darkHex: '#a16207',
    lightHex: '#fef9c3',
    ringClass: 'ring-amber-400',
    bgClass: 'bg-amber-400',
    textClass: 'text-amber-700',
    shapeLabel: 'Y',
  },
  purple: {
    id: 'purple',
    label: 'Purple',
    hex: '#9333ea',
    darkHex: '#6b21a8',
    lightHex: '#f3e8ff',
    ringClass: 'ring-purple-500',
    bgClass: 'bg-purple-600',
    textClass: 'text-purple-700',
    shapeLabel: 'P',
  },
  orange: {
    id: 'orange',
    label: 'Orange',
    hex: '#ea580c',
    darkHex: '#9a3412',
    lightHex: '#ffedd5',
    ringClass: 'ring-orange-500',
    bgClass: 'bg-orange-600',
    textClass: 'text-orange-700',
    shapeLabel: 'O',
  },
};

export interface SpriteAssetSpec {
  src: string;
  w: number;
  h: number;
  /** Normalized 0..1 anchor matching `from` square (ladder bottom / snake head) */
  fromAnchor: { x: number; y: number };
  /** Normalized 0..1 anchor matching `to` square (ladder top / snake tail) */
  toAnchor: { x: number; y: number };
}

export interface VisualBoardTransition extends BoardTransition {
  sprite: SpriteAssetSpec;
}

// Classic 1-100 board configuration:
// 8 ladders (from < to) and 8 snakes (from > to), all 32 endpoints strictly unique,
// paired directly with the extracted transparent sprites from the user's artwork.
export const LADDERS: readonly VisualBoardTransition[] = [
  {
    id: 'L1',
    type: 'ladder',
    from: 4,
    to: 25,
    accent: '#b45309',
    sprite: {
      src: '/assets/sprites/ladder_gold_med.png',
      w: 53,
      h: 170,
      fromAnchor: { x: 0.49, y: 0.96 },
      toAnchor: { x: 0.49, y: 0.04 },
    },
  },
  {
    id: 'L2',
    type: 'ladder',
    from: 9,
    to: 31,
    accent: '#78350f',
    sprite: {
      src: '/assets/sprites/ladder_brown_top.png',
      w: 48,
      h: 241,
      fromAnchor: { x: 0.48, y: 0.96 },
      toAnchor: { x: 0.48, y: 0.04 },
    },
  },
  {
    id: 'L3',
    type: 'ladder',
    from: 20,
    to: 38,
    accent: '#15803d',
    sprite: {
      src: '/assets/sprites/ladder_green_top.png',
      w: 46,
      h: 118,
      fromAnchor: { x: 0.49, y: 0.95 },
      toAnchor: { x: 0.49, y: 0.05 },
    },
  },
  {
    id: 'L4',
    type: 'ladder',
    from: 28,
    to: 76,
    accent: '#991b1b',
    sprite: {
      src: '/assets/sprites/ladder_red_top.png',
      w: 54,
      h: 242,
      fromAnchor: { x: 0.46, y: 0.97 },
      toAnchor: { x: 0.45, y: 0.03 },
    },
  },
  {
    id: 'L5',
    type: 'ladder',
    from: 40,
    to: 59,
    accent: '#d97706',
    sprite: {
      src: '/assets/sprites/ladder_gold_short.png',
      w: 50,
      h: 170,
      fromAnchor: { x: 0.48, y: 0.96 },
      toAnchor: { x: 0.48, y: 0.04 },
    },
  },
  {
    id: 'L6',
    type: 'ladder',
    from: 51,
    to: 67,
    accent: '#15803d',
    sprite: {
      src: '/assets/sprites/ladder_green_bottom.png',
      w: 46,
      h: 121,
      fromAnchor: { x: 0.49, y: 0.95 },
      toAnchor: { x: 0.49, y: 0.05 },
    },
  },
  {
    id: 'L7',
    type: 'ladder',
    from: 63,
    to: 81,
    accent: '#78350f',
    sprite: {
      src: '/assets/sprites/ladder_brown_bottom.png',
      w: 48,
      h: 241,
      fromAnchor: { x: 0.48, y: 0.96 },
      toAnchor: { x: 0.48, y: 0.04 },
    },
  },
  {
    id: 'L8',
    type: 'ladder',
    from: 71,
    to: 91,
    accent: '#991b1b',
    sprite: {
      src: '/assets/sprites/ladder_red_bottom.png',
      w: 51,
      h: 243,
      fromAnchor: { x: 0.48, y: 0.96 },
      toAnchor: { x: 0.48, y: 0.04 },
    },
  },
];

export const SNAKES: readonly VisualBoardTransition[] = [
  {
    id: 'S1',
    type: 'snake',
    from: 27,
    to: 6,
    accent: '#eab308',
    sprite: {
      src: '/assets/sprites/snake_yellow_arch.png',
      w: 173,
      h: 168,
      fromAnchor: { x: 0.42, y: 0.14 },
      toAnchor: { x: 0.06, y: 0.96 },
    },
  },
  {
    id: 'S2',
    type: 'snake',
    from: 34,
    to: 14,
    accent: '#16a34a',
    sprite: {
      src: '/assets/sprites/snake_green_arch.png',
      w: 167,
      h: 263,
      fromAnchor: { x: 0.16, y: 0.09 },
      toAnchor: { x: 0.60, y: 0.97 },
    },
  },
  {
    id: 'S3',
    type: 'snake',
    from: 47,
    to: 26,
    accent: '#ec4899',
    sprite: {
      src: '/assets/sprites/snake_pink_tall.png',
      w: 155,
      h: 378,
      fromAnchor: { x: 0.84, y: 0.06 },
      toAnchor: { x: 0.03, y: 0.98 },
    },
  },
  {
    id: 'S4',
    type: 'snake',
    from: 62,
    to: 19,
    accent: '#16a34a',
    sprite: {
      src: '/assets/sprites/snake_green_tall.png',
      w: 80,
      h: 407,
      fromAnchor: { x: 0.76, y: 0.06 },
      toAnchor: { x: 0.06, y: 0.98 },
    },
  },
  {
    id: 'S5',
    type: 'snake',
    from: 64,
    to: 44,
    accent: '#eab308',
    sprite: {
      src: '/assets/sprites/snake_yellow_curl.png',
      w: 127,
      h: 218,
      fromAnchor: { x: 0.20, y: 0.11 },
      toAnchor: { x: 0.45, y: 0.98 },
    },
  },
  {
    id: 'S6',
    type: 'snake',
    from: 87,
    to: 36,
    accent: '#9333ea',
    sprite: {
      src: '/assets/sprites/snake_purple_long.png',
      w: 207,
      h: 337,
      fromAnchor: { x: 0.14, y: 0.08 },
      toAnchor: { x: 0.96, y: 0.98 },
    },
  },
  {
    id: 'S7',
    type: 'snake',
    from: 95,
    to: 75,
    accent: '#16a34a',
    sprite: {
      src: '/assets/sprites/snake_green_arch.png',
      w: 167,
      h: 263,
      fromAnchor: { x: 0.16, y: 0.09 },
      toAnchor: { x: 0.60, y: 0.97 },
    },
  },
  {
    id: 'S8',
    type: 'snake',
    from: 98,
    to: 79,
    accent: '#ec4899',
    sprite: {
      src: '/assets/sprites/snake_pink_tall.png',
      w: 155,
      h: 378,
      fromAnchor: { x: 0.84, y: 0.06 },
      toAnchor: { x: 0.03, y: 0.98 },
    },
  },
];

export const TRANSITION_BY_START: ReadonlyMap<number, BoardTransition> = new Map(
  [...LADDERS, ...SNAKES].map((item) => [item.from, item])
);
