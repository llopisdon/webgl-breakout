import { mat4 } from "gl-matrix";

// NES dimensions for fun
const GAME_WIDTH = 256;
const GAME_HEIGHT = 240;

console.log(">>> init main.js <<<");

// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage
/** @type {HTMLCanvasElement} */
const canvas = document.querySelector("#canvas");
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;
/** @type {WebGLRenderingContext} */
const gl = canvas.getContext("webgl");

/** @type {HTMLCanvasElement} */
const textCanvas = document.querySelector("#text");
textCanvas.width = GAME_WIDTH;
textCanvas.height = GAME_HEIGHT;
/** @type {CanvasRenderingContext2D} */
const ctx = textCanvas.getContext("2d");
ctx.font = '20px "Pixel NES"';
ctx.fillStyle = "white";
ctx.strokeStyle = "white";

if (!gl) {
    throw "Unable to init WebGL!";
} else {
    console.log("WebGL init...")
}

const TEXT_START = 4;
const TEXT_TOP = 20;
const TEXT_HEIGHT = 20;
const TEXT_CENTER_X = GAME_WIDTH / 2;
const TEXT_CENTER_Y = GAME_HEIGHT / 2;

let dt = 0;
let last = 0;

let shaders = [];
let buffers = {};

const normalizedModelViewProjection = mat4.create();
console.log(normalizedModelViewProjection);
const modelViewProjection = mat4.create();
const modelScale = mat4.create();
const modelTranslate = mat4.create();

//
// Keyboard
//

// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values

const KEY_ARROW_UP = "ArrowUp";
const KEY_ARROW_DOWN = "ArrowDown";
const KEY_ARROW_LEFT = "ArrowLeft";
const KEY_ARROW_RIGHT = "ArrowRight";
const KEY_CONTROL = "Control";
const KEY_SPACE = "Space";

const KEY_W = "KeyW";
const KEY_A = "KeyA";
const KEY_S = "KeyS";
const KEY_D = "KeyD";

const KEY_I = "KeyI";
const KEY_J = "KeyJ";
const KEY_K = "KeyK";
const KEY_L = "KeyL";

const KEY_Q = "KeyQ";
const KEY_Z = "KeyZ";

const GAME_KEYS = [
    KEY_ARROW_LEFT,
    KEY_ARROW_RIGHT,
    KEY_ARROW_UP,
    KEY_ARROW_DOWN,

    KEY_W, KEY_A, KEY_S, KEY_D,

    KEY_I, KEY_J, KEY_K, KEY_L,

    KEY_Z,

    KEY_SPACE,
    KEY_Q,
];

let keys = {};

document.addEventListener("keydown", e => {
    console.log(`keydown -> key: ${e.key} code: ${e.code}`);
    if (GAME_KEYS.indexOf(e.key) >= 0) {
        e.preventDefault();
    }
    keys[e.code] = true;
});

document.addEventListener("keyup", e => {
    console.log(`keyup -> key: ${e.key} code: ${e.code}`);
    keys[e.code] = false;
});

// TODO add responsive canvas

// game text
const PADDING_4 = 4;
const PADDING_8 = 8;
const PADDING_16 = 16;


const START_TEXT = "START";
let START_TEXT_OFFSET = 0;

const TITLE_TEXT = "WEBGL-BREAKOUT";
let TITLE_TEXT_OFFSET = 0;

const GAME_OVER_TEXT = "GAME OVER";
let GAME_OVER_TEXT_OFFSET = 0;

let DEBUG_MODE = false;

const GAME_TIMER_GAME_OVER = 2.0;
let gameTimer = 0;

const BALL_DIR_45 = {
    x: Math.cos(Math.PI / 4.0),
    y: Math.sin(Math.PI / 4.0)
};

const BALL_DIR_135 = {
    x: Math.cos(3 * Math.PI / 4.0),
    y: Math.sin(3 * Math.PI / 4.0)
};

const BALL_DIR_90 = {
    x: 0.0,
    y: 1.0
}

const BALL_DIR_60 = {
    x: Math.cos(Math.PI / 3.0),
    y: Math.sin(Math.PI / 3.0)
}

const BALL_DIR_120 = {
    x: Math.cos(2 * Math.PI / 3.0),
    y: Math.sin(2 * Math.PI / 3.0)
}


function setup() {

    //
    // text init
    //

    START_TEXT_OFFSET = ctx.measureText(START_TEXT).width / 2;
    TITLE_TEXT_OFFSET = ctx.measureText(TITLE_TEXT).width / 2;
    GAME_OVER_TEXT_OFFSET = ctx.measureText(GAME_OVER_TEXT).width / 2;

    //
    // webgl init
    //

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);

    let w = gl.canvas.clientWidth / 2.0;
    let h = gl.canvas.clientHeight / 2.0;

    mat4.ortho(
        modelViewProjection,
        -w, w,
        -h, h,
        -1.0,
        1.0
    );

    console.log(modelViewProjection);

    {
        const vsSource = `
        attribute vec4 a_coords;
        attribute vec4 a_color;
        uniform mat4 u_modelviewProjection;
        uniform mat4 u_Scale;
        uniform mat4 u_Translate;
        uniform vec4 u_color;
        varying lowp vec4 v_color;
        void main() {
            gl_Position = u_modelviewProjection * u_Translate * u_Scale * a_coords;
            v_color = u_color;
        }
        `;

        const fsSource = `
        varying lowp vec4 v_color;
        void main() {
            gl_FragColor = v_color;
        }
        `;

        let program = initShaderProgram(gl, vsSource, fsSource);

        shaders['program1'] = {
            program: program,
            attribs: {
                'a_coords': gl.getAttribLocation(program, 'a_coords'),
            },
            uniforms: {
                'u_modelviewProjection': gl.getUniformLocation(program, 'u_modelviewProjection'),
                'u_Scale': gl.getUniformLocation(program, 'u_Scale'),
                'u_Translate': gl.getUniformLocation(program, 'u_Translate'),
                'u_color': gl.getUniformLocation(program, 'u_color')
            }
        };
    }

    // 2x2 rectangle
    {
        let buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]),
            gl.STATIC_DRAW);

        buffers['2x2_rect'] = {
            buffer: buffer,
            size: 2,
            count: 4
        }
    }

    // unit triangle
    {
        const R = 1;

        let buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array([
                R * Math.cos(Math.PI / 2), R * Math.sin(Math.PI / 2),
                R * Math.cos(210 * PI_OVER_180), R * Math.sin(210 * PI_OVER_180),
                R * Math.cos(330 * PI_OVER_180), R * Math.sin(330 * PI_OVER_180),
            ]),
            gl.STATIC_DRAW);
        buffers['unit_triangle'] = {
            buffer: buffer,
            size: 2,
            count: 3
        }
    }

    // unit square
    {
        let buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array(
                [
                    0.5, 0.5,
                    -0.5, 0.5,
                    0.5, -0.5,
                    -0.5, -0.5
                ]
            ),
            gl.STATIC_DRAW);
        buffers['unit_square'] = {
            buffer: buffer,
            size: 2,
            count: 4
        }
    }

    resetGame();

    requestAnimationFrame(update);

    console.log(">>> webgl-breakout start! <<<");
}

function resetGame() {

    DEBUG_MODE = false;

    WORLD_MAX_X = 0 + gl.canvas.clientWidth / 2.0;

    MAX_PADDLE_X = WORLD_MAX_X - (PADDLE_WIDTH / 2.0);
    MAX_PADDLE_Y = 0 + gl.canvas.clientHeight / 2.0 - (PADDLE_HEIGHT / 2.0);
    MAX_BALL_X = WORLD_MAX_X - (BALL_RADIUS / 2.0);
    MAX_BALL_Y = 0 + gl.canvas.clientHeight / 2.0 - (BALL_RADIUS / 2.0);

    BRICK_START_X = -WORLD_MAX_X + (BRICK_WIDTH / 2.0);
    BRICK_START_Y = 0.0 + (BRICK_HEIGHT / 2.0) + BRICK_HEIGHT;

    gameTimer = 0;
    blink = BLINK_RATE;

    curBallsLeft = 3;    
    curLevel = 1;
    curPoints = 0;

    initLevel();
}

function resetBricks() {
    for (let brick = 0; brick < MAX_BRICKS_PER_ROW; brick++) {
        bricks[0][brick] = true;
        bricks[1][brick] = true;
        bricks[2][brick] = true;
        bricks[3][brick] = true;
        bricks[4][brick] = true;
        bricks[5][brick] = true;
    }

    curBricksLeft = MAX_BRICKS;
}

function resetBallVars() {
    // reset ball speed vars
    curHits = 0;
    curBallSpeed = 0;
}

function resetKeysAndPaddleAndBall() {
    GAME_KEYS.forEach(key => keys[key] = false);
    paddle.x = 0.0;
    paddle.y = 0.0 - gl.canvas.clientHeight / 2.0 + BRICK_HEIGHT;
    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;

    ball.x = 0.0;
    ball.y = paddle.y + PADDLE_HEIGHT;
    ball.prevX = ball.x;
    ball.prevY = ball.y;
}

function initLevel() {
    resetBricks();
    resetBallVars();
    resetKeysAndPaddleAndBall();
}

let BALL_SPEED = [
    180.0,
    200.0,
    220.0,
    240.0,
    300.0
];

const PADDLE_SPEED = 180.0;

const PADDLE_WIDTH = 40.0;
const PADDLE_HEIGHT = 5.0;
const PADDLE_HALF_HEIGHT = PADDLE_HEIGHT / 2.0;
const PADDLE_HALF_WIDTH = PADDLE_WIDTH / 2.0;
const BALL_RADIUS = PADDLE_HALF_HEIGHT;
const BALL_HEIGHT = PADDLE_HEIGHT;
const BALL_WIDTH = PADDLE_HEIGHT;


const DIVIDER_WIDTH = 5.0;
const DIVIDER_HEIGHT = 10.0;
const DIVIDER_START_Y = (GAME_HEIGHT / 2.0) - (DIVIDER_HEIGHT / 2.0) - (DIVIDER_HEIGHT / 2.0);

let WORLD_MAX_X = 0.0;
let MAX_PADDLE_X = 0.0;
let MAX_PADDLE_Y = 0.0;
let MAX_BALL_X = 0.0;
let MAX_BALL_Y = 0.0;

let NUM_BRICK_ROWS = 6;
let MAX_BRICKS_PER_ROW = 16;

let BRICK_START_X = 0.0;
let BRICK_START_Y = 0.0;
let BRICK_WIDTH = 16.0;
let BRICK_HALF_WIDTH = BRICK_WIDTH / 2.0;
let BRICK_HEIGHT = 10.0;
let BRICK_HALF_HEIGHT = BRICK_HEIGHT / 2.0;

const paddle = {
    x: 0.0,
    y: 0.0,
    prevX: 0.0,
    prevY: 0.0,
    vx: 0.0,
    vy: 0.0,
    bounds: function() {
        return {
            rx: this.x - PADDLE_HALF_WIDTH,
            ry: this.y + PADDLE_HALF_HEIGHT,
            width: PADDLE_WIDTH,
            height: PADDLE_HEIGHT
        }
    }
}

const ball = {
    x: 0.0,
    y: 0.0,
    prevX: 0.0,
    prevY: 0.0,
    vx: 0.0,
    vy: 0.0,
    bounds: function() {
        return {
            rx: this.x - BALL_RADIUS,
            ry: this.y + BALL_RADIUS,
            width: BALL_WIDTH,
            height: BALL_HEIGHT    
        }
    }
}

const bricks = [
    new Array(MAX_BRICKS_PER_ROW),
    new Array(MAX_BRICKS_PER_ROW),
    new Array(MAX_BRICKS_PER_ROW),
    new Array(MAX_BRICKS_PER_ROW),
    new Array(MAX_BRICKS_PER_ROW),
    new Array(MAX_BRICKS_PER_ROW)
];

const MAX_BRICKS = MAX_BRICKS_PER_ROW * 6;

const PI_OVER_2 = Math.PI / 2;
const PI_OVER_180 = Math.PI / 180;
const DEG_30 = 30 * PI_OVER_180;

const BLINK_RATE = 0.5;
let blink = BLINK_RATE;

const GAME_STATE_MAIN_MENU = 0;
const GAME_STATE_START = 1;
const GAME_STATE_PLAY = 2;
const GAME_STATE_GAME_OVER = 3;

let gameState = GAME_STATE_MAIN_MENU;

const COLORS = {
    silver: [0.557, 0.557, 0.557, 1.0],
    red: [0.867, 0.133, 0.275, 1.0],
    orange: [0.839, 0.388, 0.212, 1.0],
    carmel: [0.745, 0.475, 0.169, 1.0],
    yellow: [0.616, 0.671, 0.129, 1.0],
    green: [0.000, 0.678, 0.271, 1.0],
    blue: [0.329, 0.000, 0.792, 1.0],
    cyan: [1.0, 0.0, 1.0, 1.0],
};

const BRICK_COLORS = [
    COLORS.blue,
    COLORS.green,
    COLORS.yellow,
    COLORS.carmel,
    COLORS.orange,
    COLORS.red
];

const POINTS = [
    1,
    1,
    4,
    4,
    7,
    7
];

let curPoints = 0;
let curBallsLeft = 0;
let curLevel = 1;
let curBricksLeft = 0;

// these two vars control ball speed for each level
// based on original game play
// speed increases on: 4th hit, 12th hit, first orange brick hit, and first red brick hit
let curHits = 0;
let curBallSpeed = 0;

function update(timestamp) {

    // https://developer.mozilla.org/en-US/docs/Games/Anatomy
    const t = timestamp / 1000;
    dt = t - last;
    last = t;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    //
    // HUD
    //

    if (keys[KEY_Z]) {
        keys[KEY_Z] = false;
        DEBUG_MODE = !DEBUG_MODE;
    }

    if (DEBUG_MODE) {
        ctx.fillText(timestamp, TEXT_START, GAME_HEIGHT - PADDING_16 * 2);
        ctx.fillText(dt.toFixed(8), TEXT_START, GAME_HEIGHT - PADDING_8);

        ctx.moveTo(TEXT_CENTER_X, 0);
        ctx.lineTo(TEXT_CENTER_X, ctx.canvas.height);
        ctx.moveTo(0, TEXT_CENTER_Y);
        ctx.lineTo(ctx.canvas.width, TEXT_CENTER_Y);
        ctx.stroke();
    }

    switch (gameState) {
        case GAME_STATE_START:
        case GAME_STATE_PLAY:
            doGame();
            break;
        case GAME_STATE_MAIN_MENU:
            doMainMenu();
            break;
        case GAME_STATE_GAME_OVER:
            doGameOver();
            break;
        default:
            break;
    }

    requestAnimationFrame(update);
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 * 
 * @param {number} min 
 * @param {number} max 
 */
function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    //The maximum is inclusive and the minimum is inclusive 
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


/**
 * 
 * http://paulbourke.net/geometry/pointlineplane/
 * 
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @param {number} x3 
 * @param {number} y3 
 * @param {number} x4 
 * @param {number} y4 
 */
function didLineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    let x4x3 = x4 - x3;
    let y1y3 = y1 - y3;
    let y4y3 = y4 - y3;
    let x1x3 = x1 - x3;
    let x2x1 = x2 - x1;
    let y2y1 = y2 - y1;

    let a = ((x4x3 * y1y3) - (y4y3 * x1x3)) / ((y4y3 * x2x1) - (x4x3 * y2y1));
    let b = ((x2x1 * y1y3) - (y2y1 * x1x3)) / ((y4y3 * x2x1) - (x4x3 * y2y1));

    if (a >= 0 && a <= 1 && b >= 0 && b <= 1) {
        return true;
    }

    return false;
}

/**
 * 
 * @param {*} x1 
 * @param {*} y1 
 * @param {*} x2 
 * @param {*} y2 
 * @param {*} rect_left 
 * @param {*} rect_top 
 * @param {*} rect_right 
 * @param {*} rect_bottom 
 */
function didLineSegmentIntersectRect(x1, y1, x2, y2, rect_left, rect_top, rect_right, rect_bottom) {

    // bottom
    if (didLineSegmentsIntersect(
        x1, y1, x2, y2,
        rect_left, rect_bottom, rect_right, rect_bottom,
    )) {
        return true;
    }

    // top
    if (didLineSegmentsIntersect(
        x1, y1, x2, y2,
        rect_left, rect_top, rect_right, rect_top,
    )) {
        return true;
    }

    // left
    if (didLineSegmentsIntersect(
        x1, y1, x2, y2,
        rect_left, rect_top, rect_left, rect_bottom,
    )) {
        return true;
    }

    // right
    if (didLineSegmentsIntersect(
        x1, y1, x2, y2,
        rect_right, rect_top, rect_right, rect_bottom,
    )) {
        return true;
    }

    return false;
}

/**
 * 
 * @param {*} x 
 * @param {*} y 
 * @param {*} left 
 * @param {*} top 
 * @param {*} right 
 * @param {*} bottom 
 */
function isPointInRect(x, y, left, top, right, bottom) {
    if (x >= left && x <= right && y <= top && y >= bottom)
        return false;
}


/**
 * http://www.jeffreythompson.org/collision-detection/circle-rect.php
 * 
 * @param {*} cx 
 * @param {*} cy 
 * @param {*} radiusSquared 
 * @param {*} left 
 * @param {*} top 
 * @param {*} right 
 * @param {*} bottom 
 */
function circleIntersectRect(cx, cy, radius, left, top, right, bottom) {
    let testX = cx;
    let testY = cy;

    if (cx < left) testX = left;
    else if (cx > right) testX = right;
    if (cy < bottom) testY = bottom;
    else if (cy > top) testY = top;

    let distX = cx - testX;
    let distY = cy - testY;
    let dist = Math.sqrt((distX * distX) + (distY * distY));
    
    let collision = dist <= radius;
    let diff = 0.0;
    if (collision) {
        diff = Math.abs(dist - radius);
    }
    return { collision: collision, diff: diff };
}

/**
 * https://lamberta.github.io/html5-animation/
 * 
 * modified to work with right-hand coordinate system
 * 
 * @param {object} rectA Object with properties: left x, top y, width, height.
 * @param {object} rectB Object with properties: left x, top y, width, height.
 * @return {boolean}
 */
function rectsIntersect(rectA, rectB) {
    return !(rectA.rx + rectA.width < rectB.rx || 
        rectB.rx + rectB.width < rectA.rx || 
        rectA.ry - rectA.height > rectB.ry ||
        rectB.ry - rectB.height > rectA.ry);
}

/**
 * https://lamberta.github.io/html5-animation/
 * 
 * @param {object} rect Object with properties: left x, top y, width, height.
 * @param {number} x Coordinate position x.
 * @param {number} y Coordinate position y.
 * @return {boolean}
 */
function pointInRect(rect, x, y) {
    return !(x < rect.rx ||
        x > rect.rx + rect.width ||
        y < rect.ry ||
        y > rect.ry - rect.height);
}


function doMainMenu() {
    drawBackground();

    ctx.fillText(TITLE_TEXT, TEXT_CENTER_X - TITLE_TEXT_OFFSET, TEXT_TOP + PADDING_16);

    blink -= dt;
    if (blink > 0.0) {
        ctx.fillText(START_TEXT, TEXT_CENTER_X - START_TEXT_OFFSET, TEXT_CENTER_Y);
    } else if (blink < -BLINK_RATE) {
        blink = BLINK_RATE;
    }

    if (keys[KEY_SPACE]) {
        resetGame();
        gameState = GAME_STATE_START;
        curBallsLeft--;
        keys[KEY_SPACE] = false;
        console.log(">>> GAME PLAY <<<");
    }
}

function doGameOver() {
    drawBackground();
    ctx.fillText(GAME_OVER_TEXT, TEXT_CENTER_X - GAME_OVER_TEXT_OFFSET, TEXT_CENTER_Y);
    gameTimer -= dt;
    if (gameTimer < 0.0 || keys[KEY_SPACE]) {
        resetGame();
        gameState = GAME_STATE_MAIN_MENU;
        keys[KEY_SPACE] = false;
        console.log(">>> GAME MENU <<<");
    }
}

function doGame() {
    // TODO

    checkForBrickCollisions();
    checkForPaddleBallCollision();

    movePlayer();
    moveBall();

    checkForNextLevelOrGameOver();
    if (gameState == GAME_STATE_GAME_OVER) {
        return;
    }
  
    //
    // check for quit
    //
    if (keys[KEY_Q]) {
        resetGame();
        gameState = GAME_STATE_MAIN_MENU;
    }

    drawBackground();

    gl.useProgram(shaders['program1'].program);

    gl.uniformMatrix4fv(
        shaders['program1'].uniforms['u_modelviewProjection'],
        false,
        modelViewProjection
    );

    drawBricks();
    drawPlayerPaddle();
    drawBall();


    //
    // draw score, balls left, cur level
    //

    ctx.fillText(curBallsLeft, GAME_WIDTH - PADDING_16 - PADDING_4, 
        PADDING_16 + PADDING_4);

    ctx.fillText(`${curLevel}`.padStart(2, "0"), GAME_WIDTH - (PADDING_16 * 4) - PADDING_4, 
            PADDING_16 + PADDING_4);
    
    ctx.fillText(`${curPoints}`.padStart(4, "0"), PADDING_4, 
        PADDING_16 + PADDING_4);
}

const brickRect = {
    rx: 0.0,
    ry: 0.0,
    width: BRICK_WIDTH,
    height: BRICK_HEIGHT
};

function checkForBrickCollisions() {

    let ballRect = ball.bounds();

    for (let row=0; row<6; row++) {

        let brickY =  BRICK_START_Y + (BRICK_HEIGHT * row);

        for (let brick = 0, x = BRICK_START_X; brick < MAX_BRICKS_PER_ROW; brick++ , x += BRICK_WIDTH) {
            
            brickRect.rx = x - BRICK_HALF_WIDTH;
            brickRect.ry = brickY + BRICK_HALF_HEIGHT;

            if (bricks[row][brick] && rectsIntersect(ballRect, brickRect)){

                bricks[row][brick] = false;
                curBricksLeft--;
                curHits++;
                
                curPoints += POINTS[row];
                if (curPoints > 9999) {
                    curPoints = 9999;
                }
                
                ball.prevY = ball.y;
                // if (ball.vy > 0.0) {
                //     ball.y = brickY - BRICK_HALF_HEIGHT - PADDLE_HALF_HEIGHT;
                // } else {
                //     ball.y = brickY + BRICK_HALF_HEIGHT + PADDLE_HALF_HEIGHT;
                // }
                ball.vy *= -1;

                ballRect = ball.bounds();

                if (curHits === 4 || curHits === 12 || (curBallSpeed < 3 && row === 4) || (curBallSpeed < 4 && row === 5)) {
                    curBallSpeed++;
                }

                if (curBallSpeed >= BALL_SPEED.length) {
                    curBallSpeed = BALL_SPEED.length - 1;
                }

                return;
            }
        }
    }
}


function checkForPaddleBallCollision() {
    if (rectsIntersect(paddle.bounds(), ball.bounds())) {
        ball.y = paddle.y + PADDLE_HEIGHT;
        ball.prevY = paddle.y;
        // ball.vy *= -1;
        // ball.vx *= -1;

        if (keys[KEY_ARROW_LEFT]) {
            ball.vx = BALL_DIR_120.x;
            ball.vy = BALL_DIR_120.y;
        } else if (keys[KEY_ARROW_RIGHT]) {
            ball.vx = BALL_DIR_60.x;
            ball.vy = BALL_DIR_60.y;
        } else {
            if (ball.vx < 0.0) {
                ball.vx = BALL_DIR_135.x;
            } else {
                ball.vx = BALL_DIR_45.x;
            }
            ball.vy = BALL_DIR_45.y;
        }
    }
}

function movePlayer() {
    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;

    if (keys[KEY_ARROW_RIGHT]) {
        paddle.vx = 1.0;
    } else if (keys[KEY_ARROW_LEFT]) {
        paddle.vx = -1.0;
    } else {
        paddle.vx = 0.0;
    }

    paddle.x = paddle.x + (paddle.vx * PADDLE_SPEED * dt);

    if (paddle.x < -MAX_PADDLE_X) {
        paddle.x = -MAX_PADDLE_X;
    }
    else if (paddle.x > MAX_PADDLE_X) {
        paddle.x = MAX_PADDLE_X;
    }

    if (gameState === GAME_STATE_START && keys[KEY_SPACE]) {
        gameState = GAME_STATE_PLAY;
        ball.vx = BALL_DIR_90.x;
        ball.vy = BALL_DIR_90.y;
    }
}

function moveBall() {
    if (gameState === GAME_STATE_PLAY) {
        ball.prevX = ball.x;
        ball.prevY = ball.y;

        ball.x = ball.x + (ball.vx * BALL_SPEED[curBallSpeed] * dt);
        ball.y = ball.y + (ball.vy * BALL_SPEED[curBallSpeed] * dt);

        if (ball.x < -MAX_BALL_X) {
            ball.x = -MAX_BALL_X;
            ball.vx = -ball.vx;
        }
        else if (ball.x > MAX_BALL_X) {
            ball.x = MAX_BALL_X;
            ball.vx = -ball.vx;
        }

        if (ball.y < -MAX_BALL_Y) {            
            if (!DEBUG_MODE) {
                gameState = GAME_STATE_START;
                curBallsLeft--;
                resetKeysAndPaddleAndBall();
            } else {
                ball.y = -MAX_BALL_Y;
                ball.vy = -ball.vy;    
            }
        }
        else if (ball.y > MAX_BALL_Y) {
            ball.y = MAX_BALL_Y;
            ball.vy = -ball.vy;
        }
    } else if (gameState == GAME_STATE_START) {
        ball.prevX = ball.x;
        ball.prevY = ball.y;
        ball.x = paddle.x;
        ball.y = ball.y;
    }
}

function checkForNextLevelOrGameOver() {

    //
    // check for next level
    //
    if (curBricksLeft == 0) {
        gameState = GAME_STATE_START;
        curLevel++;
        if (curLevel > 99) {
            curLevel = 99;
        }
        initLevel();
        console.log(">>> NEXT LEVEL ")
    }

    //
    // check for game over
    //
    if (curBallsLeft == -1) {
        gameState = GAME_STATE_GAME_OVER;
        gameTimer = GAME_TIMER_GAME_OVER;
        console.log(">>> GAME OVER ");
    }
}

function drawBricks() {
    for (let row = 0; row < 6; row++) {
        for (let brick = 0, x = BRICK_START_X; brick < MAX_BRICKS_PER_ROW; brick++ , x += BRICK_WIDTH) {
            if (bricks[row][brick]) {
                drawBrick(x, BRICK_START_Y + (BRICK_HEIGHT * row), BRICK_COLORS[row]);
            }
        }
    }
}

function drawBrick(centerX, centerY, color) {
    drawRect(centerX, centerY, BRICK_WIDTH, BRICK_HEIGHT, color);
}

function drawPlayerPaddle() {
    drawRect(paddle.x, paddle.y, PADDLE_WIDTH, PADDLE_HEIGHT, COLORS.red);
}

function drawBall() {
    drawRect(ball.x, ball.y, BALL_WIDTH, BALL_HEIGHT, COLORS.red);
}

/** 
 * draw rectangle 
 * @param {number} xPos
 * @param {number} yPos
 * @param {number} width
 * @param {number} height
 * @param {number[]} color
 */
function drawRect(xPos, yPos, width, height, color) {
    mat4.identity(modelScale);
    mat4.scale(modelScale,
        modelScale,
        [width, height, 0]);

    gl.uniformMatrix4fv(
        shaders['program1'].uniforms['u_Scale'],
        false,
        modelScale
    );

    mat4.identity(modelTranslate);
    mat4.translate(modelTranslate,
        modelTranslate,
        [xPos, yPos, 0.0]);

    gl.uniformMatrix4fv(
        shaders['program1'].uniforms['u_Translate'],
        false,
        modelTranslate
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers['unit_square'].buffer);
    gl.vertexAttribPointer(
        shaders['program1'].attribs['a_coords'],
        buffers['unit_square'].size,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(shaders['program1'].attribs['a_coords']);

    gl.uniform4f(shaders['program1'].uniforms['u_color'], color[0], color[1], color[2], color[3]);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffers['unit_square'].count);
}

function drawBackground() {
    //
    // draw
    //

    gl.useProgram(shaders['program1'].program);

    //
    // set projection matrix for use by background
    //

    gl.uniformMatrix4fv(
        shaders['program1'].uniforms['u_modelviewProjection'],
        false,
        normalizedModelViewProjection
    );

    // background

    mat4.identity(modelScale);
    gl.uniformMatrix4fv(
        shaders['program1'].uniforms['u_Scale'],
        false,
        modelScale
    );

    mat4.identity(modelTranslate);
    gl.uniformMatrix4fv(
        shaders['program1'].uniforms['u_Translate'],
        false,
        modelTranslate
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers['2x2_rect'].buffer);
    gl.vertexAttribPointer(
        shaders['program1'].attribs['a_coords'],
        buffers['2x2_rect'].size,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(shaders['program1'].attribs['a_coords']);

    gl.uniform4f(shaders['program1'].uniforms['u_color'], 0, 0, 0, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffers['2x2_rect'].count);
}

/** @param {WebGLRenderingContext} gl */
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw `unable to link shader program. error: ${gl.getProgramInfoLog(program)}`;
    }
    return program;
}

/** @param {WebGLRenderingContext} gl */
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw `unable to compile shader. error: ${gl.getShaderInfoLog(shader)}`;
    }
    return shader;
}

document.onreadystatechange = () => {
    requestAnimationFrame(setup);
}