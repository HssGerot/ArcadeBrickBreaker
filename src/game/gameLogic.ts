export type BrickKind = "normal" | "tough" | "bomb" | "steel" | "power";
export type PowerUpKind = "wide" | "multiball" | "pierce" | "slow" | "shield" | "laser";
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

const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;
const BRICK_WIDTH = 64;
const BRICK_HEIGHT = 24;
const BRICK_GAP = 6;
const BRICK_TOP = 78;
const BRICK_LEFT = 55;
const PADDLE_Y = 548;

const LEVELS: LevelConfig[] = [
  { id: 1, name: "入门墙", speedMultiplier: 1, layout: ["NNNNNNNNNN", "NNNNNNNNNN", ".........."] },
  { id: 2, name: "双层防线", speedMultiplier: 1.05, layout: ["TTNNNNTTNN", "NNNTTNNNTT", "NNNNNNNNNN"] },
  { id: 3, name: "爆破教学", speedMultiplier: 1.1, layout: ["NNNBBBNNNN", "NNTNNNNTNN", "NNNNNNNNNN"] },
  { id: 4, name: "狭窄通道", speedMultiplier: 1.14, layout: ["SSNNTTNNSS", "NNNNBBNNNN", "SSNNNNNNSS"] },
  { id: 5, name: "多球狂潮", speedMultiplier: 1.18, layout: ["PMPNMPNMPN", "NNNTTTNNNN", "NBNNNNNNBN"] },
  { id: 6, name: "穿透清屏", speedMultiplier: 1.22, layout: ["PPPPPPPPPP", "TTTTTTTTTT", "NNNNNNNNNN", "NNNNNNNNNN"] },
  { id: 7, name: "反弹迷宫", speedMultiplier: 1.26, layout: ["SNNNNNNNNS", "NSBBBBBBSN", "NNSTTTTSNN", "NNNNNNNNNN"] },
  { id: 8, name: "压迫阵型", speedMultiplier: 1.32, layout: ["TTTTTTTTTT", "TNNNNNNNNT", "TNBPBBPNBT", "NNNNNNNNNN"] },
  { id: 9, name: "道具混战", speedMultiplier: 1.38, layout: ["PMPWPIPSPP", "NBNBNBNBNB", "TTNTTNTTNN", "NNNNNNNNNN"] },
  { id: 10, name: "核心堡垒", speedMultiplier: 1.48, layout: ["SSSTTTTSSS", "NNBBBBBBNN", "NNTTTTTTNN", "PPNNCCNNPP"] },
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

export function createGameState(levelId = 1): GameState {
  const level = LEVELS.find((item) => item.id === levelId) ?? LEVELS[0];
  const speed = 280 * level.speedMultiplier;
  return {
    levelId: level.id,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    time: 0,
    status: "ready",
    score: 0,
    combo: 0,
    energy: 0,
    lives: 3,
    nextBallId: 2,
    nextPowerUpId: 1,
    paddle: {
      x: BOARD_WIDTH / 2 - 58,
      y: PADDLE_Y,
      width: 116,
      height: 16,
      baseWidth: 116,
      speed: 780,
      wideUntil: 0,
      laserUntil: 0,
    },
    balls: [
      {
        id: 1,
        x: BOARD_WIDTH / 2,
        y: PADDLE_Y - 18,
        vx: speed * 0.42,
        vy: -speed,
        radius: 7,
        piercingUntil: 0,
      },
    ],
    bricks: createBricks(level),
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
    if (!input.launch) {
      return state;
    }
    state.status = "playing";
  } else if (state.status !== "playing") {
    return state;
  }

  movePaddle(state, dt, input);
  updateBalls(state, dt);
  updatePowerUps(state, dt);
  updateWinLoss(state);
  return state;
}

function createBricks(level: LevelConfig): Brick[] {
  const bricks: Brick[] = [];
  let id = 1;
  for (let row = 0; row < level.layout.length; row++) {
    const line = level.layout[row];
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
        x: BRICK_LEFT + col * (BRICK_WIDTH + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
      });
    }
  }
  return bricks;
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
    ball.y = state.paddle.y - 18;
    ball.vx = speed * 0.42;
    ball.vy = -speed;
  }
}

function updateBalls(state: GameState, dt: number): void {
  const activeBalls: Ball[] = [];
  for (const ball of state.balls) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.radius < 16 || ball.x + ball.radius > state.width - 16) {
      ball.vx *= -1;
      ball.x = clamp(ball.x, 16 + ball.radius, state.width - 16 - ball.radius);
      state.effects.push({ kind: "wall-hit", x: ball.x, y: ball.y });
    }
    if (ball.y - ball.radius < 44) {
      ball.vy = Math.abs(ball.vy);
      ball.y = 44 + ball.radius;
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

    if (ball.y - ball.radius <= state.height) {
      activeBalls.push(ball);
    } else if (state.shieldActive) {
      state.shieldActive = false;
      ball.y = state.height - 36;
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
    state.pendingPowerUps.push({
      id: state.nextPowerUpId++,
      kind: brick.powerUp ?? randomPowerUp(brick.id),
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      vy: 150,
    });
  }
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
      radius: 7,
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
  const powerUps: PowerUpKind[] = ["wide", "multiball", "pierce", "slow", "shield", "laser"];
  return powerUps[seed % powerUps.length];
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
