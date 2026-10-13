const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createGameState,
  getLevelConfigs,
  MAX_BALLS,
  stepGame,
} = require("../dist-test/src/game/gameLogic.js");

test("defines ten classic arcade levels with increasing pressure", () => {
  const levels = getLevelConfigs();

  assert.equal(levels.length, 10);
  assert.equal(levels[0].name, "入门墙");
  assert.equal(levels[9].name, "核心堡垒");
  assert.ok(levels[9].speedMultiplier > levels[0].speedMultiplier);
  assert.ok(levels.some((level) => level.layout.some((row) => row.includes("B"))));
  assert.ok(levels.some((level) => level.layout.some((row) => row.includes("S"))));
  assert.ok(levels.some((level) => level.layout.some((row) => row.includes("L"))));
  assert.ok(levels.some((level) => level.layout.some((row) => row.includes("X"))));
});

test("new level waits for launch before the ball moves", () => {
  const state = createGameState(1);
  const before = state.balls[0];

  const waiting = stepGame(state, 1, { pointerX: state.paddle.x + state.paddle.width / 2 });

  assert.equal(waiting.status, "ready");
  assert.equal(waiting.balls[0].x, before.x);
  assert.equal(waiting.balls[0].y, before.y);

  const launched = stepGame(waiting, 1 / 60, { launch: true });

  assert.equal(launched.status, "playing");
  assert.ok(launched.balls[0].y < before.y);
});

test("can create a portrait board layout with denser brick columns", () => {
  const state = createGameState(1, { width: 360, height: 640, brickColumns: 22 });

  assert.equal(state.width, 360);
  assert.equal(state.height, 640);
  assert.ok(state.paddle.y > 560);
  assert.ok(state.paddle.width < 100);
  assert.ok(Math.max(...state.bricks.map((brick) => brick.x + brick.width)) < state.width - 12);
  assert.ok(state.bricks.filter((brick) => brick.y === state.bricks[0].y).length >= 22);
});

test("portrait top bricks sit edge to edge like pixels", () => {
  const state = createGameState(1, { width: 360, height: 640, brickColumns: 22 });
  const firstRow = state.bricks
    .filter((brick) => brick.y === state.bricks[0].y)
    .sort((a, b) => a.x - b.x);

  for (let index = 1; index < firstRow.length; index++) {
    assert.equal(firstRow[index].x, firstRow[index - 1].x + firstRow[index - 1].width);
  }
});

test("scores combo hits and charges ultimate energy", () => {
  const state = createGameState(1);
  state.status = "playing";
  const brick = state.bricks.find((item) => item.kind === "normal");
  state.balls = [
    {
      id: 99,
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      vx: 0,
      vy: -260,
      radius: 6,
      piercingUntil: 0,
    },
  ];

  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x });

  assert.equal(next.bricks.some((item) => item.id === brick.id), false);
  assert.equal(next.combo, 1);
  assert.equal(next.score, 100);
  assert.equal(next.energy, 8);
  assert.ok(next.effects.some((effect) => effect.kind === "brick-pop"));
});

test("bomb bricks destroy nearby bricks for chain-clear payoff", () => {
  const state = createGameState(3);
  state.status = "playing";
  const bomb = state.bricks.find((item) => item.kind === "bomb");
  state.balls = [
    {
      id: 1,
      x: bomb.x + bomb.width / 2,
      y: bomb.y + bomb.height / 2,
      vx: 0,
      vy: -280,
      radius: 6,
      piercingUntil: 0,
    },
  ];

  const before = state.bricks.length;
  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x });

  assert.ok(before - next.bricks.length >= 2);
  assert.ok(next.score >= 300);
  assert.ok(next.effects.some((effect) => effect.kind === "bomb"));
});

test("multiball power-up splits one active ball into three", () => {
  const state = createGameState(5);
  state.status = "playing";
  state.pendingPowerUps.push({
    id: 1,
    kind: "multiball",
    x: state.paddle.x,
    y: state.paddle.y,
    vy: 120,
  });

  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x });

  assert.equal(next.balls.length, 3);
  assert.ok(next.effects.some((effect) => effect.kind === "powerup"));
});

test("normal bricks have a higher deterministic chance to drop power-ups", () => {
  const state = createGameState(1);
  state.status = "playing";
  const brick = state.bricks.find((item) => item.kind === "normal" && item.id % 3 === 0);
  state.balls = [
    {
      id: 1,
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      vx: 0,
      vy: -280,
      radius: 6,
      piercingUntil: 0,
    },
  ];

  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x });

  assert.equal(next.pendingPowerUps.length, 1);
  assert.ok(next.pendingPowerUps[0].y >= brick.y + brick.height / 2);
});

test("dropped triple launch power-up adds three balls without removing existing balls", () => {
  const state = createGameState(1);
  state.status = "playing";
  state.balls = [
    { id: 1, x: 260, y: 360, vx: -140, vy: -240, radius: 7, piercingUntil: 0 },
    { id: 2, x: 420, y: 360, vx: 140, vy: -240, radius: 7, piercingUntil: 0 },
  ];
  state.nextBallId = 3;
  state.pendingPowerUps.push({
    id: 1,
    kind: "tripleLaunch",
    x: state.paddle.x + state.paddle.width / 2,
    y: state.paddle.y,
    vy: 120,
  });

  const next = stepGame(state, 1 / 60, {
    pointerX: state.paddle.x + state.paddle.width / 2,
  });

  assert.equal(next.status, "playing");
  assert.equal(next.balls.length, 5);
  assert.ok(next.balls.some((ball) => ball.id === 1));
  assert.ok(next.balls.some((ball) => ball.id === 2));
  assert.ok(next.balls.every((ball) => ball.vy < 0));
  assert.ok(next.effects.some((effect) => effect.kind === "powerup" && effect.text === "TRIPLE"));
});

test("split storm splits every active ball into three total balls", () => {
  const state = createGameState(1);
  state.status = "playing";
  state.balls = [
    { id: 1, x: 300, y: 360, vx: -150, vy: -250, radius: 7, piercingUntil: 0 },
    { id: 2, x: 500, y: 390, vx: 160, vy: -240, radius: 7, piercingUntil: 0 },
  ];

  state.pendingPowerUps.push({
    id: 1,
    kind: "splitStorm",
    x: state.paddle.x + state.paddle.width / 2,
    y: state.paddle.y,
    vy: 120,
  });

  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x + state.paddle.width / 2 });

  assert.equal(next.balls.length, 6);
  assert.ok(next.effects.some((effect) => effect.kind === "powerup" && effect.text === "SPLIT"));
});

test("split storm respects the maximum ball limit", () => {
  const state = createGameState(1);
  state.status = "playing";
  state.balls = Array.from({ length: MAX_BALLS - 1 }, (_, index) => ({
    id: index + 1,
    x: 80 + index * 4,
    y: 360,
    vx: index % 2 === 0 ? 140 : -140,
    vy: -260,
    radius: 7,
    piercingUntil: 0,
  }));
  state.nextBallId = MAX_BALLS + 1;

  state.pendingPowerUps.push({
    id: 1,
    kind: "splitStorm",
    x: state.paddle.x + state.paddle.width / 2,
    y: state.paddle.y,
    vy: 120,
  });

  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x + state.paddle.width / 2 });

  assert.equal(next.balls.length, MAX_BALLS);
});

test("portrait balls bounce inside the visible play frame", () => {
  const state = createGameState(1, { width: 360, height: 640, brickColumns: 14 });
  state.status = "playing";
  state.bricks = [];
  state.balls = [
    {
      id: 1,
      x: state.width / 2,
      y: 60,
      vx: 0,
      vy: -300,
      radius: 7,
      piercingUntil: 0,
    },
  ];

  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x + state.paddle.width / 2 });

  assert.ok(next.balls[0].y >= 69);
  assert.ok(next.balls[0].vy > 0);
});

test("clearing all breakable bricks marks the level as won", () => {
  const state = createGameState(1);
  state.status = "playing";
  state.bricks = state.bricks.filter((brick) => brick.kind === "steel");

  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x });

  assert.equal(next.status, "won");
});
