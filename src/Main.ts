import {
    createGameState,
    getLevelConfigs,
    stepGame,
    type ArcadeEffect,
    type Ball,
    type Brick,
    type GameState,
    type PowerUp,
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

        this.hud = this.createText(18, "#e8f7ff", 760, 36);
        this.hud.pos(20, 12);
        this.root.addChild(this.hud);

        this.message = this.createText(34, "#ffffff", 760, 80);
        this.message.bold = true;
        this.message.align = "center";
        this.message.pos(20, 248);
        this.root.addChild(this.message);

        this.hint = this.createText(18, "#8ffcff", 760, 50);
        this.hint.align = "center";
        this.hint.pos(20, 328);
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
        Laya.stage.on(Laya.Event.RESIZE, this, this.fitRoot);
    }

    private fitRoot(): void {
        const scale = Math.min(Laya.stage.width / this.state.width, Laya.stage.height / this.state.height, 1);
        this.root.scale(scale, scale);
        this.root.pos(
            Math.max((Laya.stage.width - this.state.width * scale) / 2, 0),
            Math.max((Laya.stage.height - this.state.height * scale) / 2, 0),
        );
    }

    private getBoardPointerX(): number {
        const scale = this.root.scaleX || 1;
        return (Laya.stage.mouseX - this.root.x) / scale;
    }

    private nextLevel(): void {
        const next = this.state.levelId >= this.levels.length ? 1 : this.state.levelId + 1;
        this.state = createGameState(next);
    }

    private restartLevel(): void {
        this.state = createGameState(this.state.levelId);
    }

    private render(): void {
        const g = this.board.graphics;
        g.clear();

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
        g.drawRect(0, 0, this.state.width, this.state.height, "#050712");
        g.drawRect(14, 42, this.state.width - 28, this.state.height - 56, null, "#1bffef", 2);
        g.drawRect(18, 46, this.state.width - 36, this.state.height - 64, null, "#304bff", 1);

        for (let y = 64; y < this.state.height; y += 48) {
            g.drawLine(18, y, this.state.width - 18, y, "#101a36", 1);
        }
        for (let x = 38; x < this.state.width; x += 48) {
            g.drawLine(x, 46, x, this.state.height - 18, "#0d1830", 1);
        }
    }

    private drawBrick(brick: Brick): void {
        const g = this.board.graphics;
        const glow = brick.kind === "steel" ? "#2f3848" : "#ffffff";
        const hpTint = brick.hp < brick.maxHp ? "#ff8a33" : brick.color;
        g.drawRect(brick.x - 2, brick.y - 2, brick.width + 4, brick.height + 4, "#09101f", hpTint, 1);
        g.drawRect(brick.x, brick.y, brick.width, brick.height, hpTint, glow, 1);
        g.drawRect(brick.x + 5, brick.y + 5, brick.width - 10, 4, "#ffffff44");

        if (brick.kind === "bomb") {
            g.drawCircle(brick.x + brick.width / 2, brick.y + brick.height / 2, 6, "#ffffff");
        } else if (brick.kind === "steel") {
            g.drawLine(brick.x + 8, brick.y + 5, brick.x + brick.width - 8, brick.y + brick.height - 5, "#c8d4ff", 2);
        } else if (brick.kind === "power") {
            g.drawCircle(brick.x + brick.width / 2, brick.y + brick.height / 2, 7, "#050712", "#ffffff", 2);
        }
    }

    private drawPaddle(): void {
        const paddle = this.state.paddle;
        const g = this.board.graphics;
        g.drawRect(paddle.x - 8, paddle.y + 4, paddle.width + 16, 10, "#1036ff55");
        g.drawRect(paddle.x, paddle.y, paddle.width, paddle.height, "#f7f7ff", "#1bffef", 2);
        g.drawRect(paddle.x + 8, paddle.y + 4, paddle.width - 16, 4, "#ff2bd6");
    }

    private drawBall(ball: Ball): void {
        const g = this.board.graphics;
        const isPiercing = ball.piercingUntil > this.state.time;
        g.drawCircle(ball.x, ball.y, ball.radius + 5, isPiercing ? "#ff2bd655" : "#1bffef44");
        g.drawCircle(ball.x, ball.y, ball.radius, isPiercing ? "#ff2bd6" : "#ffffff", "#1bffef", 2);
    }

    private drawPowerUp(powerUp: PowerUp): void {
        const g = this.board.graphics;
        g.drawRect(powerUp.x - 14, powerUp.y - 10, 28, 20, "#9cff3a", "#ffffff", 2);
        g.drawLine(powerUp.x - 7, powerUp.y, powerUp.x + 7, powerUp.y, "#050712", 2);
        g.drawLine(powerUp.x, powerUp.y - 7, powerUp.x, powerUp.y + 7, "#050712", 2);
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
        for (let y = 0; y < this.state.height; y += 6) {
            g.drawLine(0, y, this.state.width, y, "#00000022", 1);
        }
    }

    private renderHud(): void {
        const level = this.levels[this.state.levelId - 1];
        const combo = this.state.combo > 1 ? `  COMBO x${this.state.combo}` : "";
        this.hud.text = `LV ${this.state.levelId}/10 ${level.name}    SCORE ${this.state.score}    LIFE ${this.state.lives}    ENERGY ${Math.round(this.state.energy)}%${combo}`;
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
            this.hint.text = "点击或按空格发射";
        } else {
            this.message.text = "";
            this.hint.text = "鼠标/手指移动挡板，A/D 或方向键也可控制";
        }
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
}

window.$_main_ = () => {
    console.log("ArcadeBrickBreaker boot");
    Laya.stage.bgColor = "#050712";

    const root = new Laya.Sprite();
    root.name = "ArcadeBrickBreaker";
    root.size(800, 600);
    Laya.stage.addChild(root);
    root.addComponent(Main);

    window.hideSplashScreen?.();
};
