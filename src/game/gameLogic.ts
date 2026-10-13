export type BrickKind = "normal" | "tough" | "bomb" | "steel" | "power";
export type PowerUpKind = "wide" | "multiball" | "pierce" | "slow" | "shield" | "laser" | "tripleLaunch" | "splitStorm";
export type GameStatus = "ready" | "playing" | "won" | "lost";
export type EffectKind = "brick-pop" | "bomb" | "powerup" | "wall-hit" | "paddle-hit" | "life-lost";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  piercingUntil: number;
}

export interface Paddle extends Rect {
  baseWidth: number;
  speed: number;
  wideUntil: number;
  laserUntil: number;
}

export interface Brick extends Rect {
  id: number;
  kind: BrickKind;
  hp: number;
  maxHp: number;
  color: string;
  powerUp?: PowerUpKind;
}

export interface PowerUp {
  id: number;
  kind: PowerUpKind;
  x: number;
  y: number;
  vy: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  speedMultiplier: number;
  layout: string[];
}

export interface ArcadeEffect {
  kind: EffectKind;
  x: number;
  y: number;
  text?: string;
}

export interface GameState {
  levelId: number;
  width: number;
  height: number;
  time: number;
  status: GameStatus;
  score: number;
  combo: number;
  energy: number;
  lives: number;
  nextBallId: number;
  nextPowerUpId: number;
  paddle: Paddle;
  balls: Ball[];
  bricks: Brick[];
  pendingPowerUps: PowerUp[];
  effects: ArcadeEffect[];
  shieldActive: boolean;
}

export interface StepInput {
  pointerX?: number;
  moveAxis?: number;
  launch?: boolean;
  ultimate?: boolean;
}

export interface GameLayoutOptions {
  width?: number;
  height?: number;
  brickColumns?: number;
}

const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;
const BRICK_WIDTH = 64;
const BRICK_HEIGHT = 24;
const BRICK_GAP = 6;
const BRICK_TOP = 78;
const BRICK_LEFT = 55;
const PADDLE_Y = 548;
const BONUS_POWERUP_DROP_INTERVAL = 3;
export const MAX_BALLS = 48;

const LEVELS: LevelConfig[] = [
  { id: 1, name: "入门墙", speedMultiplier: 1, layout: ["NNNNNNNNNN", "NNNNNNNNNN", ".........."] },
  { id: 2, name: "双层防线", speedMultiplier: 1.05, layout: ["TTNNNNTTNN", "NNNTTNNNTT", "NNNNNNNNNN"] },
  { id: 3, name: "爆破教学", speedMultiplier: 1.1, layout: ["NNNBBBNNNN", "NNTNNNNTNN", "NNNNNNNNNN"] },
  { id: 4, name: "狭窄通道", speedMultiplier: 1.14, layout: ["SSNNTTNNSS", "NNNNBBNNNN", "SSNNNNNNSS"] },
  { id: 5, name: "多球狂潮", speedMultiplier: 1.18, layout: ["PMPNMPNMPN", "NNNTTTNNNN", "NBNNNNNNBN"] },
  { id: 6, name: "穿透清屏", speedMultiplier: 1.22, layout: ["PPPPPPPPPP", "TTTTTTTTTT", "NNNNNNNNNN", "NNNNNNNNNN"] },
  { id: 7, name: "反弹迷宫", speedMultiplier: 1.26, layout: ["SNNNNNNNNS", "NSBBBBBBSN", "NNSTTTTSNN", "NNNNNNNNNN"] },
  { id: 8, name: "压迫阵型", speedMultiplier: 1.32, layout: ["TTTTTTTTTT", "TNNNNNNNNT", "TNBPBBPNBT", "NNNNNNNNNN"] },
  { id: 9, name: "道具混战", speedMultiplier: 1.38, layout: ["PMLWXIPSPX", "NBNBNBNBNB", "TTNTTNTTNN", "NNNNNNNNNN"] },
  { id: 10, name: "核心堡垒", speedMultiplier: 1.48, layout: ["SSSTTTTSSS", "NNBBBBBBNN", "NNTTLXTTNN", "PPNNCCNNPP"] },
];

const BRICK_THEME: Record<BrickKind, string> = {
  normal: "#30f2ff",
  tough: "#ffcc33",
  bomb: "#ff375f",
  steel: "#7c8ba1",
  power: "#9cff3a",
};

export function getLevelConfigs(): LevelConfig[] {
  return LEVELS.map((level) => ({
    ...level,
    layout: [...level.layout],
  }));
}

export function createGameState(levelId = 1, layoutOptions: GameLayoutOptions = {}): GameState {
  const level = LEVELS.find((item) => item.id === levelId) ?? LEVELS[0];
  const boardLayout = resolveBoardLayout(level, layoutOptions);
  const speed = 280 * level.speedMultiplier;
  return {
    levelId: level.id,
    width: boardLayout.width,
    height: boardLayout.height,
    time: 0,
    status: "ready",
    score: 0,
    combo: 0,
    energy: 0,
    lives: 3,
    nextBallId: 2,
    nextPowerUpId: 1,
    paddle: {
      x: boardLayout.width / 2 - boardLayout.paddleWidth / 2,
      y: boardLayout.paddleY,
      width: boardLayout.paddleWidth,
      height: boardLayout.paddleHeight,
      baseWidth: boardLayout.paddleWidth,
      speed: boardLayout.width * 0.98,
      wideUntil: 0,
      laserUntil: 0,
    },
    balls: [
      {
        id: 1,
        x: boardLayout.width / 2,
        y: boardLayout.paddleY - boardLayout.ballRadius - 11,
        vx: speed * 0.42,
        vy: -speed,
        radius: boardLayout.ballRadius,
        piercingUntil: 0,
      },
    ],
    bricks: createBricks(level, boardLayout),
    pendingPowerUps: [],
    effects: [],
    shieldActive: false,
  };
}

export function stepGame(inputState: GameState, dt: number, input: StepInput = {}): GameState {
  const state = cloneState(inputState);
  state.time += dt;
  state.effects = [];

  if (state.status === "ready") {
    movePaddle(state, dt, input);
    holdBallsOnPaddle(state);
    updatePowerUps(state, dt);
    if (!input.launch && state.status === "ready") {
      return state;
    }
    if (input.launch) {
      state.status = "playing";
    }
  } else if (state.status !== "playing") {
    return state;
  }

  movePaddle(state, dt, input);
  updateBalls(state, dt);
  updatePowerUps(state, dt);
  updateWinLoss(state);
  return state;
}

interface BoardLayout {
  width: number;
  height: number;
  brickWidth: number;
  brickHeight: number;
  brickGap: number;
  brickTop: number;
  brickLeft: number;
  brickColumns: number;
  paddleY: number;
  paddleWidth: number;
  paddleHeight: number;
  ballRadius: number;
}

function resolveBoardLayout(level: LevelConfig, options: GameLayoutOptions): BoardLayout {
  const width = Math.max(320, Math.round(options.width ?? BOARD_WIDTH));
  const height = Math.max(520, Math.round(options.height ?? BOARD_HEIGHT));
  const naturalColumns = Math.max(...level.layout.map((line) => line.length));
  const brickColumns = Math.max(8, Math.round(options.brickColumns ?? naturalColumns));

  if (!options.width && !options.height && !options.brickColumns) {
    return {
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      brickWidth: BRICK_WIDTH,
      brickHeight: BRICK_HEIGHT,
      brickGap: BRICK_GAP,
      brickTop: BRICK_TOP,
      brickLeft: BRICK_LEFT,
      brickColumns: naturalColumns,
      paddleY: PADDLE_Y,
      paddleWidth: 116,
      paddleHeight: 16,
      ballRadius: 7,
    };
  }

  const sideMargin = Math.max(14, Math.round(width * 0.045));
  const brickGap = 0;
  const brickWidth = Math.floor((width - sideMargin * 2 - brickGap * (brickColumns - 1)) / brickColumns);
  return {
    width,
    height,
    brickWidth,
    brickHeight: Math.max(16, Math.round(height * 0.03)),
    brickGap,
    brickTop: Math.max(62, Math.round(height * 0.11)),
    brickLeft: Math.round((width - (brickWidth * brickColumns + brickGap * (brickColumns - 1))) / 2),
    brickColumns,
    paddleY: height - Math.max(48, Math.round(height * 0.08)),
    paddleWidth: clamp(Math.round(width * 0.25), 74, 132),
    paddleHeight: Math.max(14, Math.round(height * 0.024)),
    ballRadius: clamp(Math.round(width * 0.018), 5, 8),
  };
}

function createBricks(level: LevelConfig, boardLayout: BoardLayout): Brick[] {
  const bricks: Brick[] = [];
  let id = 1;
  for (let row = 0; row < level.layout.length; row++) {
    const line = resizeLayoutRow(level.layout[row], boardLayout.brickColumns);
    for (let col = 0; col < line.length; col++) {
      const token = line[col];
      if (token === ".") {
        continue;
      }
      const { kind, hp, powerUp } = brickFromToken(token);
      bricks.push({
        id: id++,
        kind,
        hp,
        maxHp: hp,
        color: BRICK_THEME[kind],
        powerUp,
        x: boardLayout.brickLeft + col * (boardLayout.brickWidth + boardLayout.brickGap),
        y: boardLayout.brickTop + row * (boardLayout.brickHeight + boardLayout.brickGap),
        width: boardLayout.brickWidth,
        height: boardLayout.brickHeight,
      });
    }
  }
  return bricks;
}

function resizeLayoutRow(row: string, columns: number): string {
  if (row.length === columns) {
    return row;
  }
  if (columns <= 0 || row.length === 0) {
    return row;
  }
  let resized = "";
  for (let index = 0; index < columns; index++) {
    const sourceIndex = Math.min(row.length - 1, Math.floor((index / columns) * row.length));
    resized += row[sourceIndex];
  }
  return resized;
}

function brickFromToken(token: string): Pick<Brick, "kind" | "hp" | "powerUp"> {
  switch (token) {
    case "T":
      return { kind: "tough", hp: 2 };
    case "C":
      return { kind: "tough", hp: 3 };
    case "B":
      return { kind: "bomb", hp: 1 };
    case "S":
      return { kind: "steel", hp: Number.POSITIVE_INFINITY };
    case "M":
      return { kind: "power", hp: 1, powerUp: "multiball" };
    case "W":
      return { kind: "power", hp: 1, powerUp: "wide" };
    case "I":
      return { kind: "power", hp: 1, powerUp: "pierce" };
    case "L":
      return { kind: "power", hp: 1, powerUp: "tripleLaunch" };
    case "X":
      return { kind: "power", hp: 1, powerUp: "splitStorm" };
    case "P":
      return { kind: "power", hp: 1 };
    default:
      return { kind: "normal", hp: 1 };
  }
}

function movePaddle(state: GameState, dt: number, input: StepInput): void {
  const targetWidth = state.time < state.paddle.wideUntil ? state.paddle.baseWidth * 1.45 : state.paddle.baseWidth;
  state.paddle.width = targetWidth;
  if (typeof input.pointerX === "number") {
    state.paddle.x = input.pointerX - state.paddle.width / 2;
  } else if (typeof input.moveAxis === "number") {
    state.paddle.x += input.moveAxis * state.paddle.speed * dt;
  }
  state.paddle.x = clamp(state.paddle.x, 20, state.width - state.paddle.width - 20);
}

function holdBallsOnPaddle(state: GameState): void {
  const speed = 280 * (LEVELS.find((level) => level.id === state.levelId)?.speedMultiplier ?? 1);
  for (const ball of state.balls) {
    ball.x = state.paddle.x + state.paddle.width / 2;
    ball.y = state.paddle.y - ball.radius - 11;
    ball.vx = speed * 0.42;
    ball.vy = -speed;
  }
}

function updateBalls(state: GameState, dt: number): void {
  const activeBalls: Ball[] = [];
  const bounds = playBoundsFor(state);
  for (const ball of state.balls) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.radius < bounds.left || ball.x + ball.radius > bounds.right) {
      ball.vx *= -1;
      ball.x = clamp(ball.x, bounds.left + ball.radius, bounds.right - ball.radius);
      state.effects.push({ kind: "wall-hit", x: ball.x, y: ball.y });
    }
    if (ball.y - ball.radius < bounds.top) {
      ball.vy = Math.abs(ball.vy);
      ball.y = bounds.top + ball.radius;
      state.effects.push({ kind: "wall-hit", x: ball.x, y: ball.y });
    }

    if (circleIntersectsRect(ball, state.paddle) && ball.vy > 0) {
      const offset = (ball.x - (state.paddle.x + state.paddle.width / 2)) / (state.paddle.width / 2);
      const speed = Math.max(270, Math.hypot(ball.vx, ball.vy));
      ball.vx = clamp(offset, -1, 1) * speed * 0.82;
      ball.vy = -Math.sqrt(Math.max(speed * speed - ball.vx * ball.vx, 1));
      ball.y = state.paddle.y - ball.radius - 1;
      state.combo = 0;
      state.effects.push({ kind: "paddle-hit", x: ball.x, y: ball.y });
    }

    collideBricks(state, ball);

    if (ball.y - ball.radius <= bounds.bottom) {
      activeBalls.push(ball);
    } else if (state.shieldActive) {
      state.shieldActive = false;
      ball.y = bounds.bottom - 24;
      ball.vy = -Math.abs(ball.vy);
      activeBalls.push(ball);
      state.effects.push({ kind: "wall-hit", x: ball.x, y: ball.y, text: "SHIELD" });
    }
  }

  state.balls = activeBalls;
  if (state.balls.length === 0) {
    state.lives -= 1;
    state.combo = 0;
    state.effects.push({ kind: "life-lost", x: state.width / 2, y: state.height - 80 });
    if (state.lives > 0) {
      resetBall(state);
      state.status = "ready";
    }
  }
}

function collideBricks(state: GameState, ball: Ball): void {
  for (const brick of [...state.bricks]) {
    if (!circleIntersectsRect(ball, brick)) {
      continue;
    }
    if (brick.kind === "steel") {
      ball.vy *= -1;
      state.effects.push({ kind: "wall-hit", x: ball.x, y: ball.y });
      return;
    }

    brick.hp -= 1;
    state.combo += 1;
    const comboMultiplier = comboMultiplierFor(state.combo);
    state.score += 100 * comboMultiplier;
    state.energy = clamp(state.energy + 8, 0, 100);

    if (brick.hp <= 0) {
      destroyBrick(state, brick);
    } else {
      brick.color = "#ff8a33";
      state.effects.push({ kind: "brick-pop", x: brick.x + brick.width / 2, y: brick.y + brick.height / 2, text: `x${comboMultiplier}` });
    }

    if (ball.piercingUntil <= state.time) {
      ball.vy *= -1;
      return;
    }
  }
}

function destroyBrick(state: GameState, brick: Brick): void {
  removeBrick(state, brick.id);
  state.effects.push({ kind: brick.kind === "bomb" ? "bomb" : "brick-pop", x: brick.x + brick.width / 2, y: brick.y + brick.height / 2 });

  if (brick.kind === "bomb") {
    const nearby = state.bricks.filter((item) => item.kind !== "steel" && distanceBetweenCenters(item, brick) <= BRICK_WIDTH * 1.6);
    for (const item of nearby) {
      removeBrick(state, item.id);
      state.score += 100;
      state.energy = clamp(state.energy + 4, 0, 100);
      state.effects.push({ kind: "brick-pop", x: item.x + item.width / 2, y: item.y + item.height / 2 });
    }
  }

  if (brick.kind === "power") {
    spawnPowerUp(state, brick, brick.powerUp ?? randomPowerUp(brick.id));
  } else if (shouldDropBonusPowerUp(brick)) {
    spawnPowerUp(state, brick, randomPowerUp(brick.id + state.levelId));
  }
}

function shouldDropBonusPowerUp(brick: Brick): boolean {
  return (brick.kind === "normal" || brick.kind === "tough") && brick.id % BONUS_POWERUP_DROP_INTERVAL === 0;
}

function spawnPowerUp(state: GameState, brick: Brick, kind: PowerUpKind): void {
  state.pendingPowerUps.push({
    id: state.nextPowerUpId++,
    kind,
    x: brick.x + brick.width / 2,
    y: brick.y + brick.height / 2,
    vy: 170,
  });
}

function updatePowerUps(state: GameState, dt: number): void {
  const remaining: PowerUp[] = [];
  for (const powerUp of state.pendingPowerUps) {
    powerUp.y += powerUp.vy * dt;
    const rect = { x: powerUp.x - 12, y: powerUp.y - 12, width: 24, height: 24 };
    if (rectIntersects(rect, state.paddle)) {
      applyPowerUp(state, powerUp.kind);
      state.effects.push({ kind: "powerup", x: powerUp.x, y: powerUp.y, text: powerUp.kind.toUpperCase() });
    } else if (powerUp.y < state.height + 30) {
      remaining.push(powerUp);
    }
  }
  state.pendingPowerUps = remaining;
}

function applyPowerUp(state: GameState, kind: PowerUpKind): void {
  switch (kind) {
    case "wide":
      state.paddle.wideUntil = state.time + 8;
      break;
    case "multiball":
      splitBalls(state);
      break;
    case "tripleLaunch":
      tripleLaunch(state);
      break;
    case "splitStorm":
      splitStorm(state);
      break;
    case "pierce":
      for (const ball of state.balls) {
        ball.piercingUntil = state.time + 6;
      }
      break;
    case "slow":
      for (const ball of state.balls) {
        ball.vx *= 0.78;
        ball.vy *= 0.78;
      }
      break;
    case "shield":
      state.shieldActive = true;
      break;
    case "laser":
      state.paddle.laserUntil = state.time + 5;
      break;
  }
}

function splitBalls(state: GameState): void {
  const sourceBalls = state.balls.length > 0 ? state.balls.slice(0, 1) : [];
  for (const ball of sourceBalls) {
    const speed = Math.max(270, Math.hypot(ball.vx, ball.vy));
    state.balls = [
      { ...ball, vx: -speed * 0.62, vy: -Math.abs(speed * 0.78) },
      { ...ball, id: state.nextBallId++, vx: 0, vy: -speed },
      { ...ball, id: state.nextBallId++, vx: speed * 0.62, vy: -Math.abs(speed * 0.78) },
    ];
  }
}

function tripleLaunch(state: GameState): void {
  if (state.balls.length >= MAX_BALLS) {
    return;
  }
  const speed = 280 * (LEVELS.find((level) => level.id === state.levelId)?.speedMultiplier ?? 1);
  const centerX = state.paddle.x + state.paddle.width / 2;
  const y = state.paddle.y - (state.balls[0]?.radius ?? 7) - 11;
  const radius = state.balls[0]?.radius ?? 7;
  const launchedBalls: Ball[] = [
    { id: state.nextBallId++, x: centerX - state.paddle.width * 0.22, y, vx: -speed * 0.52, vy: -speed * 0.9, radius, piercingUntil: 0 },
    { id: state.nextBallId++, x: centerX, y, vx: 0, vy: -speed, radius, piercingUntil: 0 },
    { id: state.nextBallId++, x: centerX + state.paddle.width * 0.22, y, vx: speed * 0.52, vy: -speed * 0.9, radius, piercingUntil: 0 },
  ];
  state.balls = [...state.balls, ...launchedBalls].slice(0, MAX_BALLS);
  state.status = "playing";
  state.effects.push({ kind: "powerup", x: centerX, y, text: "TRIPLE" });
}

function splitStorm(state: GameState): void {
  const sourceBalls = [...state.balls];
  const splitBalls: Ball[] = [];
  for (const ball of sourceBalls) {
    if (splitBalls.length >= MAX_BALLS) {
      break;
    }
    const speed = Math.max(270, Math.hypot(ball.vx, ball.vy));
    const velocities = [
      { vx: -speed * 0.72, vy: -Math.abs(speed * 0.7) },
      { vx: 0, vy: -speed },
      { vx: speed * 0.72, vy: -Math.abs(speed * 0.7) },
    ];
    for (let index = 0; index < velocities.length; index++) {
      if (splitBalls.length >= MAX_BALLS) {
        break;
      }
      const velocity = velocities[index];
      splitBalls.push({ ...ball, id: index === 0 ? ball.id : state.nextBallId++, vx: velocity.vx, vy: velocity.vy });
    }
  }
  state.balls = splitBalls;
  state.effects.push({ kind: "powerup", x: state.width / 2, y: state.height * 0.66, text: "SPLIT" });
}

function updateWinLoss(state: GameState): void {
  if (state.bricks.every((brick) => brick.kind === "steel")) {
    state.status = "won";
  } else if (state.lives <= 0 && state.balls.length === 0) {
    state.status = "lost";
  }
}

function resetBall(state: GameState): void {
  const speed = 280 * (LEVELS.find((level) => level.id === state.levelId)?.speedMultiplier ?? 1);
  state.balls = [
    {
      id: state.nextBallId++,
      x: state.paddle.x + state.paddle.width / 2,
      y: state.paddle.y - 18,
      vx: speed * 0.35,
      vy: -speed,
      radius: state.balls[0]?.radius ?? clamp(Math.round(state.width * 0.018), 5, 8),
      piercingUntil: 0,
    },
  ];
}

function comboMultiplierFor(combo: number): number {
  if (combo >= 18) return 5;
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  return 1;
}

function randomPowerUp(seed: number): PowerUpKind {
  const powerUps: PowerUpKind[] = ["wide", "multiball", "pierce", "slow", "shield", "laser", "tripleLaunch", "splitStorm"];
  return powerUps[seed % powerUps.length];
}

function playBoundsFor(state: GameState): { left: number; right: number; top: number; bottom: number } {
  return {
    left: 16,
    right: state.width - 16,
    top: state.width < 430 ? 62 : 44,
    bottom: state.height - 12,
  };
}

function removeBrick(state: GameState, id: number): void {
  state.bricks = state.bricks.filter((brick) => brick.id !== id);
}

function circleIntersectsRect(circle: Ball, rect: Rect): boolean {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function rectIntersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function distanceBetweenCenters(a: Rect, b: Rect): number {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    paddle: { ...state.paddle },
    balls: state.balls.map((ball) => ({ ...ball })),
    bricks: state.bricks.map((brick) => ({ ...brick })),
    pendingPowerUps: state.pendingPowerUps.map((powerUp) => ({ ...powerUp })),
    effects: state.effects.map((effect) => ({ ...effect })),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
