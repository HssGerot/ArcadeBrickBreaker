const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createGameState,
  getLevelConfigs,
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

test("clearing all breakable bricks marks the level as won", () => {
  const state = createGameState(1);
  state.status = "playing";
  state.bricks = state.bricks.filter((brick) => brick.kind === "steel");

  const next = stepGame(state, 1 / 60, { pointerX: state.paddle.x });

  assert.equal(next.status, "won");
});
