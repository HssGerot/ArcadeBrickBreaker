import {
    createGameState,
    getLevelConfigs,
    stepGame,
    type ArcadeEffect,
    type Ball,
    type Brick,
    type GameState,
    type PowerUp,
    type PowerUpKind,
} from "./game/gameLogic";

const { regClass } = Laya;

declare global {
    interface Window {
        $_main_?: () => void;
        hideSplashScreen?: () => void;
    }
}

@regClass()
export class Main extends Laya.Script {
    private root!: Laya.Sprite;
    private board!: Laya.Sprite;
    private scanline!: Laya.Sprite;
    private hud!: Laya.Text;
    private message!: Laya.Text;
    private hint!: Laya.Text;
    private state: GameState = createGameState(1);
    private pointerX = 400;
    private moveAxis = 0;
    private pendingLaunch = false;
    private readonly levels = getLevelConfigs();

    onStart() {
        this.root = (this.owner as Laya.Sprite) ?? Laya.stage;
        Laya.stage.bgColor = "#050712";
        this.state = this.createStateForStage(1);
        this.pointerX = this.state.width / 2;
        this.createDisplay();
        this.bindInput();
        this.fitRoot();
        this.render();
    }

    onUpdate(): void {
        const dt = Math.min((Laya.timer.delta || 16.67) / 1000, 1 / 30);
        this.state = stepGame(this.state, dt, {
            pointerX: this.pointerX,
            moveAxis: this.moveAxis,
            launch: this.pendingLaunch,
        });
        this.pendingLaunch = false;
        this.render();
    }

    private createDisplay(): void {
        this.board = new Laya.Sprite();
        this.board.pos(0, 0);
        this.root.addChild(this.board);

        this.scanline = new Laya.Sprite();
        this.root.addChild(this.scanline);

        this.hud = this.createText(18, "#e8f7ff", this.state.width - 40, 42);
        this.root.addChild(this.hud);

        this.message = this.createText(34, "#ffffff", this.state.width - 40, 86);
        this.message.bold = true;
        this.message.align = "center";
        this.root.addChild(this.message);

        this.hint = this.createText(18, "#8ffcff", this.state.width - 40, 54);
        this.hint.align = "center";
        this.root.addChild(this.hint);
    }

    private bindInput(): void {
        Laya.stage.on(Laya.Event.MOUSE_MOVE, this, () => {
            this.pointerX = this.getBoardPointerX();
        });
        Laya.stage.on(Laya.Event.MOUSE_DOWN, this, () => {
            this.pointerX = this.getBoardPointerX();
            if (this.state.status === "ready") {
                this.pendingLaunch = true;
            } else if (this.state.status === "won") {
                this.nextLevel();
            } else if (this.state.status === "lost") {
                this.restartLevel();
            }
        });
        Laya.stage.on(Laya.Event.KEY_DOWN, this, (event: Laya.Event) => {
            const code = event.keyCode;
            if (code === 37 || code === 65) {
                this.moveAxis = -1;
            } else if (code === 39 || code === 68) {
                this.moveAxis = 1;
            } else if (code === 82) {
                this.restartLevel();
            } else if (code === 32) {
                if (this.state.status === "ready") {
                    this.pendingLaunch = true;
                } else if (this.state.status === "won") {
                    this.nextLevel();
                }
            }
        });
        Laya.stage.on(Laya.Event.KEY_UP, this, (event: Laya.Event) => {
            const code = event.keyCode;
            if ((code === 37 || code === 65) && this.moveAxis < 0) {
                this.moveAxis = 0;
            } else if ((code === 39 || code === 68) && this.moveAxis > 0) {
                this.moveAxis = 0;
            }
        });
        Laya.stage.on(Laya.Event.RESIZE, this, this.handleResize);
    }

    private fitRoot(): void {
        const scale = Math.min(Laya.stage.width / this.state.width, Laya.stage.height / this.state.height);
        this.root.scale(scale, scale);
        this.root.pos(
            Math.max((Laya.stage.width - this.state.width * scale) / 2, 0),
            Math.max((Laya.stage.height - this.state.height * scale) / 2, 0),
        );
    }

    private getBoardPointerX(): number {
        const scale = this.root.scaleX || 1;
        return this.clamp((Laya.stage.mouseX - this.root.x) / scale, 0, this.state.width);
    }

    private nextLevel(): void {
        const next = this.state.levelId >= this.levels.length ? 1 : this.state.levelId + 1;
        this.state = this.createStateForStage(next);
        this.pointerX = this.state.width / 2;
    }

    private restartLevel(): void {
        this.state = this.createStateForStage(this.state.levelId);
        this.pointerX = this.state.width / 2;
    }

    private handleResize(): void {
        const currentLevel = this.state.levelId;
        const next = this.createStateForStage(currentLevel);
        if (Math.abs(next.width - this.state.width) > 2 || Math.abs(next.height - this.state.height) > 2) {
            this.state = next;
            this.pointerX = this.state.width / 2;
            this.resizeRoot();
        }
        this.fitRoot();
        this.render();
    }

    private createStateForStage(levelId: number): GameState {
        const stageWidth = Math.max(320, Laya.stage.width || 800);
        const stageHeight = Math.max(520, Laya.stage.height || 600);
        const portrait = stageHeight >= stageWidth;
        if (!portrait) {
            return createGameState(levelId, { width: 800, height: 600, brickColumns: stageWidth >= 1100 ? 12 : 10 });
        }

        const boardWidth = this.clamp(Math.round(stageWidth), 340, 540);
        const boardHeight = this.clamp(Math.round(stageHeight), 600, 920);
        const brickColumns = boardWidth < 390 ? 22 : boardWidth < 480 ? 24 : 26;
        return createGameState(levelId, { width: boardWidth, height: boardHeight, brickColumns });
    }

    private resizeRoot(): void {
        this.root.size(this.state.width, this.state.height);
    }

    private render(): void {
        const g = this.board.graphics;
        g.clear();

        this.layoutText();
        this.drawBackground();
        for (const brick of this.state.bricks) {
            this.drawBrick(brick);
        }
        for (const powerUp of this.state.pendingPowerUps) {
            this.drawPowerUp(powerUp);
        }
        this.drawPaddle();
        for (const ball of this.state.balls) {
            this.drawBall(ball);
        }
        this.drawShield();
        this.drawEffects(this.state.effects);
        this.drawScanline();
        this.renderHud();
        this.renderMessage();
    }

    private drawBackground(): void {
        const g = this.board.graphics;
        g.drawRect(0, 0, this.state.width, this.state.height, "#071022");
        g.drawRect(0, 0, this.state.width, this.state.height, "#071022");
        const frameTop = this.state.width < 430 ? 62 : 44;

        for (let y = 0; y < this.state.height; y += 16) {
            g.drawLine(0, y, this.state.width, y, "#0f1f3e", 1);
        }
        for (let x = 0; x < this.state.width; x += 16) {
            g.drawLine(x, 0, x, this.state.height, "#0b1a35", 1);
        }
        g.drawRect(10, frameTop, this.state.width - 20, this.state.height - frameTop - 12, null, "#b9fff4", 3);
        g.drawRect(15, frameTop + 5, this.state.width - 30, this.state.height - frameTop - 22, null, "#143d75", 2);
        g.drawRect(18, Math.round(this.state.height * 0.72), this.state.width - 36, Math.max(74, this.state.height * 0.15), "#06183199", "#0f9e84", 2);
    }

    private drawBrick(brick: Brick): void {
        const g = this.board.graphics;
        const hpTint = brick.hp < brick.maxHp ? "#ff8a33" : brick.color;
        const cellGap = 0;
        const cellSize = Math.max(8, Math.min(brick.height, Math.floor(brick.width / Math.max(1, Math.round(brick.width / brick.height)))));
        const columns = Math.max(1, Math.floor((brick.width + cellGap) / (cellSize + cellGap)));
        const totalWidth = columns * cellSize + (columns - 1) * cellGap;
        const startX = brick.x + (brick.width - totalWidth) / 2;
        const startY = brick.y + Math.max(0, (brick.height - cellSize) / 2);

        for (let column = 0; column < columns; column++) {
            const x = startX + column * (cellSize + cellGap);
            g.drawRect(x, startY, cellSize, cellSize, hpTint, "#183454", 1);
            g.drawRect(x + 2, startY + 2, Math.max(2, cellSize - 4), 2, "#ffffff44");
        }

        if (brick.kind === "bomb") {
            g.drawCircle(brick.x + brick.width / 2, brick.y + brick.height / 2, Math.max(4, brick.height * 0.24), "#ffffff");
        } else if (brick.kind === "steel") {
            g.drawLine(brick.x + 8, brick.y + 5, brick.x + brick.width - 8, brick.y + brick.height - 5, "#c8d4ff", 2);
        } else if (brick.kind === "power") {
            g.drawCircle(brick.x + brick.width / 2, brick.y + brick.height / 2, Math.max(4, brick.height * 0.22), "#050712", "#ffffff", 2);
        }
    }

    private drawPaddle(): void {
        const paddle = this.state.paddle;
        const g = this.board.graphics;
        g.drawRect(paddle.x - 8, paddle.y + 5, paddle.width + 16, 10, "#00000088");
        g.drawRect(paddle.x, paddle.y, paddle.width, paddle.height, "#f7f7ff", "#02050c", 3);
        g.drawRect(paddle.x + 7, paddle.y + 4, Math.max(6, paddle.width - 14), Math.max(3, paddle.height * 0.28), "#22ffe6");
    }

    private drawBall(ball: Ball): void {
        const g = this.board.graphics;
        const isPiercing = ball.piercingUntil > this.state.time;
        g.drawCircle(ball.x + 2, ball.y + 2, ball.radius + 1, "#00000088");
        g.drawCircle(ball.x, ball.y, ball.radius, isPiercing ? "#ff9df1" : "#ffffff", "#02050c", 2);
    }

    private drawPowerUp(powerUp: PowerUp): void {
        const g = this.board.graphics;
        const color = this.powerUpColor(powerUp.kind);
        g.drawRect(powerUp.x - 14, powerUp.y - 10, 28, 20, color, "#02050c", 3);
        if (powerUp.kind === "splitStorm") {
            g.drawLine(powerUp.x - 7, powerUp.y - 5, powerUp.x + 7, powerUp.y + 5, "#02050c", 2);
            g.drawLine(powerUp.x + 7, powerUp.y - 5, powerUp.x - 7, powerUp.y + 5, "#02050c", 2);
        } else if (powerUp.kind === "tripleLaunch") {
            g.drawCircle(powerUp.x - 6, powerUp.y, 3, "#02050c");
            g.drawCircle(powerUp.x, powerUp.y, 3, "#02050c");
            g.drawCircle(powerUp.x + 6, powerUp.y, 3, "#02050c");
        } else {
            g.drawLine(powerUp.x - 7, powerUp.y, powerUp.x + 7, powerUp.y, "#02050c", 2);
            g.drawLine(powerUp.x, powerUp.y - 7, powerUp.x, powerUp.y + 7, "#02050c", 2);
        }
    }

    private drawShield(): void {
        if (!this.state.shieldActive) {
            return;
        }
        this.board.graphics.drawRect(24, this.state.height - 30, this.state.width - 48, 4, "#1bffef");
    }

    private drawEffects(effects: ArcadeEffect[]): void {
        const g = this.board.graphics;
        for (const effect of effects) {
            if (effect.kind === "bomb") {
                g.drawCircle(effect.x, effect.y, 34, "#ff375f55", "#ffffff", 2);
            } else if (effect.kind === "brick-pop") {
                g.drawCircle(effect.x, effect.y, 14, "#ffffff33", "#1bffef", 1);
            } else if (effect.kind === "powerup") {
                g.drawCircle(effect.x, effect.y, 22, "#9cff3a66", "#ffffff", 2);
            }
        }
    }

    private drawScanline(): void {
        const g = this.scanline.graphics;
        g.clear();
        this.scanline.pos(0, 0);
        for (let y = 0; y < this.state.height; y += 6) {
            g.drawLine(0, y, this.state.width, y, "#00000022", 1);
        }
    }

    private renderHud(): void {
        const level = this.levels[this.state.levelId - 1];
        const combo = this.state.combo > 1 ? `  COMBO x${this.state.combo}` : "";
        if (this.state.width < 430) {
            this.hud.text = `LV ${this.state.levelId}/10  SCORE ${this.state.score}\nLIFE ${this.state.lives}  ENERGY ${Math.round(this.state.energy)}%${combo}`;
        } else {
            this.hud.text = `LV ${this.state.levelId}/10 ${level.name}    SCORE ${this.state.score}    LIFE ${this.state.lives}    ENERGY ${Math.round(this.state.energy)}%${combo}`;
        }
    }

    private renderMessage(): void {
        if (this.state.status === "won") {
            this.message.text = this.state.levelId === this.levels.length ? "ALL CLEAR!" : "STAGE CLEAR!";
            this.hint.text = "点击进入下一关 / R 重开";
        } else if (this.state.status === "lost") {
            this.message.text = "GAME OVER";
            this.hint.text = "点击或按 R 重试";
        } else if (this.state.status === "ready") {
            this.message.text = "READY";
            this.hint.text = "点击发射  |  接住掉落道具";
        } else {
            this.message.text = "";
            this.hint.text = this.state.width < 430 ? "滑动挡板  |  接住掉落道具" : "鼠标/手指移动挡板，A/D 或方向键也可控制";
        }
    }

    private layoutText(): void {
        const margin = 18;
        this.hud.width = this.state.width - margin * 2;
        this.hud.height = this.state.width < 430 ? 52 : 36;
        this.hud.fontSize = this.state.width < 430 ? 15 : 18;
        this.hud.pos(margin, 10);

        this.message.width = this.state.width - margin * 2;
        this.message.height = 86;
        this.message.fontSize = this.state.width < 430 ? 34 : 42;
        this.message.stroke = this.state.width < 430 ? 5 : 6;
        this.message.strokeColor = "#02050c";
        this.message.pos(margin, this.state.height * 0.45);

        this.hint.width = this.state.width - margin * 2;
        this.hint.height = 56;
        this.hint.fontSize = this.state.width < 430 ? 14 : 17;
        this.hint.pos(margin, this.state.height - Math.max(106, this.state.height * 0.13));
    }

    private createText(size: number, color: string, width: number, height: number): Laya.Text {
        const text = new Laya.Text();
        text.font = "Arial";
        text.fontSize = size;
        text.color = color;
        text.width = width;
        text.height = height;
        text.leading = 6;
        return text;
    }

    private powerUpColor(kind: PowerUpKind): string {
        if (kind === "tripleLaunch") return "#ff7b2e";
        if (kind === "splitStorm") return "#2aa8ff";
        return "#9cff3a";
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}

window.$_main_ = () => {
    console.log("ArcadeBrickBreaker boot");
    Laya.stage.bgColor = "#050712";

    const root = new Laya.Sprite();
    root.name = "ArcadeBrickBreaker";
    root.size(Laya.stage.width || 800, Laya.stage.height || 600);
    Laya.stage.addChild(root);
    root.addComponent(Main);

    window.hideSplashScreen?.();
};
