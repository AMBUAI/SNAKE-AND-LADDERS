// Pure board geometry module, completely independent of game rules.
// Classic 10x10 boustrophedon (alternating) layout:
// Square 1 is bottom-left; Square 10 is bottom-right;
// Square 11 is directly above 10; Square 20 is above 1;
// Square 100 is top-left.

export interface SquareGridCoords {
  square: number;
  /** 0 = bottom row, 9 = top row */
  rowFromBottom: number;
  /** 0 = top visual row, 9 = bottom visual row */
  visualRow: number;
  /** 0 = left col, 9 = right col */
  col: number;
}

export function getSquareCoords(square: number): SquareGridCoords {
  if (square < 1 || square > 100 || !Number.isInteger(square)) {
    throw new RangeError(`Invalid board square: ${square}`);
  }
  const zeroIdx = square - 1;
  const rowFromBottom = Math.floor(zeroIdx / 10);
  const offsetInRow = zeroIdx % 10;
  const isEvenRowFromBottom = rowFromBottom % 2 === 0;
  const col = isEvenRowFromBottom ? offsetInRow : 9 - offsetInRow;
  const visualRow = 9 - rowFromBottom;

  return {
    square,
    rowFromBottom,
    visualRow,
    col,
  };
}

/**
 * Returns the center of a square in a 0..100 SVG coordinate space.
 */
export function getSquareCenterPercent(square: number): { x: number; y: number } {
  const { col, visualRow } = getSquareCoords(square);
  return {
    x: (col + 0.5) * 10,
    y: (visualRow + 0.5) * 10,
  };
}

/**
 * Returns all 100 square numbers ordered top-left to bottom-right for CSS Grid rendering.
 */
export function getVisualGridSquares(): number[] {
  const squares: number[] = [];
  for (let visualRow = 0; visualRow < 10; visualRow++) {
    const rowFromBottom = 9 - visualRow;
    const isEvenRowFromBottom = rowFromBottom % 2 === 0;
    for (let col = 0; col < 10; col++) {
      const offsetInRow = isEvenRowFromBottom ? col : 9 - col;
      squares.push(rowFromBottom * 10 + offsetInRow + 1);
    }
  }
  return squares;
}

/**
 * Deterministic visual offsets (in % of board width/height, where 1 cell = 10%)
 * so 2 to 6 overlapping tokens on the same square remain clearly separated.
 */
export function getMultiTokenOffset(
  indexInSquare: number,
  totalInSquare: number
): { dx: number; dy: number; scale: number } {
  if (totalInSquare <= 1) {
    return { dx: 0, dy: 0, scale: 1 };
  }
  if (totalInSquare === 2) {
    const offsets = [
      { dx: -1.75, dy: -0.9 },
      { dx: 1.75, dy: 0.9 },
    ];
    return { ...offsets[indexInSquare % 2], scale: 0.84 };
  }
  if (totalInSquare === 3) {
    const offsets = [
      { dx: 0, dy: -1.9 },
      { dx: -1.8, dy: 1.5 },
      { dx: 1.8, dy: 1.5 },
    ];
    return { ...offsets[indexInSquare % 3], scale: 0.78 };
  }
  if (totalInSquare === 4) {
    const offsets = [
      { dx: -1.8, dy: -1.6 },
      { dx: 1.8, dy: -1.6 },
      { dx: -1.8, dy: 1.6 },
      { dx: 1.8, dy: 1.6 },
    ];
    return { ...offsets[indexInSquare % 4], scale: 0.74 };
  }
  // 5 or 6 tokens: neat 3x2 grid inside the square
  const offsets = [
    { dx: -2.2, dy: -1.6 },
    { dx: 0, dy: -1.6 },
    { dx: 2.2, dy: -1.6 },
    { dx: -2.2, dy: 1.6 },
    { dx: 0, dy: 1.6 },
    { dx: 2.2, dy: 1.6 },
  ];
  return { ...offsets[indexInSquare % 6], scale: 0.66 };
}
