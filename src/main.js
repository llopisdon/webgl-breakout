import { mat4 } from "gl-matrix";

// NES dimensions for fun
const GAME_WIDTH = 256;
const GAME_HEIGHT = 240;


console.log(">>> init main.js <<<");

/*
moutain mist (silver-gray) / border and numbers
rgb(142, 142, 142)

chestnut (red) / paddle / ball / row 6 bricks
rgb(200, 72, 72)

piper (red-orange) / row 5 bricks
rgb(198, 108, 58)

mandalay (carmel) / row 4 bricks
rgb(180, 122, 48)

citron (yellow) / row 3 bricks
rgb(162, 162, 42)

apple (green) / row 2 bricks
rgb(72, 160, 72)

cerulean blue / row 1 bricks
rgb(66, 72, 200)
*/


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
    if ( GAME_KEYS.indexOf(e.key) >= 0) {
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
let START_TEXT_OFFSET = 0;
let TITLE_TEXT_OFFSET = 0;
const START_TEXT = "START";
const TITLE_TEXT = "WEBGL-BREAKOUT";


let DEBUG_MODE = false;

const GAME_TIMER_GAME_OVER = 5.0;
let gameTimer = 0;

function setup() {

    //
    // text init
    //

    START_TEXT_OFFSET = ctx.measureText(START_TEXT).width / 2;
    TITLE_TEXT_OFFSET = ctx.measureText(TITLE_TEXT).width / 2;

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
            'program': program,
            'attribs': {
                'a_coords': gl.getAttribLocation(program, 'a_coords'),
            },
            'uniforms': {
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
        const PI_OVER_180 = Math.PI / 180;
        let buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array([
                R * Math.cos(Math.PI/2), R * Math.sin(Math.PI/2),
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

    reset();

    requestAnimationFrame(update);
}

function reset() {

    GAME_KEYS.forEach(key => keys[key] = false);

    DEBUG_MODE = false;

    paddle.xPos = 0.0 - gl.canvas.clientWidth / 2.0 + 20;
    paddle.yPos = 0.0;
    paddle.prevXPos = 0.0;
    paddle.prevYPos = 0.0;

    ball.xPos = 0.0;
    ball.yPos = 0.0;
    ball.prevXPos = 0.0;
    ball.prevYPos = 0.0;

    for (let brick=0; brick<MAX_BRICKS_PER_ROW; brick++) {
        bricks.row1[brick] = true;
        bricks.row2[brick] = true;
        bricks.row3[brick] = true;
        bricks.row4[brick] = true;
        bricks.row5[brick] = true;
        bricks.row6[brick] = true;
    }

    MAX_PADDLE_Y = 0 + gl.canvas.clientHeight / 2.0 - (PADDLE_HEIGHT / 2.0);
    MAX_BALL_X = 0 + gl.canvas.clientWidth / 2.0 - (BALL_RADIUS / 2.0);
    MAX_BALL_Y = 0 + gl.canvas.clientHeight / 2.0 - (BALL_RADIUS / 2.0);

    gameTimer = 0;
    blink = BLINK_RATE;
}

const PADDLE_SPEED = 180.0;
const PADDLE_WIDTH = 10.0;
const PADDLE_HEIGHT = 60.0;
const PADDLE_HALF_HEIGHT = PADDLE_HEIGHT / 2.0;
const PADDLE_HALF_WIDTH = PADDLE_WIDTH / 2.0;
const BALL_RADIUS = PADDLE_WIDTH;
const BALL_HALF_RADIUS = BALL_RADIUS / 2.0;

const DIVIDER_WIDTH = 5.0;
const DIVIDER_HEIGHT = 10.0;
const DIVIDER_START_Y = (GAME_HEIGHT / 2.0) - (DIVIDER_HEIGHT / 2.0) - (DIVIDER_HEIGHT / 2.0);

let MAX_PADDLE_Y = 0;
let MAX_BALL_X = 0;
let MAX_BALL_Y = 0;

let NUM_BRICK_ROWS = 6;
let MAX_BRICKS_PER_ROW = 16;

let BRICK_START_X = 0.0;
let BRICK_START_Y = 0.0;
let BRICK_WIDTH = 0.0;
let BRICK_HEIGHT = 0.0;

let paddle = {
    xPos: 0.0,
    yPos: 0.0,
    prevXPos: 0.0,
    prevYPos: 0.0,
    dir: 0.0
}

let ball = {
    xPos: 0.0,
    yPos: 0.0,
    prevXPos: 0.0,
    prevYPos: 0.0,
    dirX: 1.0,
    dirY: 1.0,
}

let bricks = {
    row1: new Array(MAX_BRICKS_PER_ROW),
    row2: new Array(MAX_BRICKS_PER_ROW),
    row3: new Array(MAX_BRICKS_PER_ROW),
    row4: new Array(MAX_BRICKS_PER_ROW),
    row5: new Array(MAX_BRICKS_PER_ROW),
    row6: new Array(MAX_BRICKS_PER_ROW)
};

const PI_OVER_2 = Math.PI / 2;
const DEG_30 = 30 * (Math.PI / 180);

const BLINK_RATE = 0.5;
let blink = BLINK_RATE;

const GAME_STATE_MAIN_MENU = 0;
const GAME_STATE_START = 1;
const GAME_STATE_PLAY = 2;
const GAME_STATE_GAME_OVER = 3;

let gameState = GAME_STATE_MAIN_MENU;

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

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    //The maximum is inclusive and the minimum is inclusive 
    return Math.floor(Math.random() * (max - min + 1)) + min; 
}

// http://paulbourke.net/geometry/pointlineplane/
function checkIntersectionTwoLines(x1, y1, x2, y2, x3, y3, x4, y4) {

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

function doMainMenu() {
    drawBackground();

    ctx.fillText(TITLE_TEXT, TEXT_CENTER_X-TITLE_TEXT_OFFSET, TEXT_TOP + PADDING_16);

    blink -= dt;
    if (blink > 0.0) {
        ctx.fillText(START_TEXT, TEXT_CENTER_X-START_TEXT_OFFSET, TEXT_CENTER_Y);
    } else if (blink < -BLINK_RATE) {
        blink = BLINK_RATE;
    }

    if (keys[KEY_SPACE]) {
        reset();
        gameState = GAME_STATE_START;
        keys[KEY_SPACE] = false;
        console.log(">>> GAME PLAY <<<");
    }
}

function doGameOver() {
    drawBackground();
    // TODO
}

function doGame() {
    // TODO

    //
    // check for quit
    //
    if (keys[KEY_Q]) {
        reset();
        gameState = GAME_STATE_MAIN_MENU;

    }

    // draw bricks
    for (let brick=0, x=BRICK_START_X; brick<MAX_BRICKS_PER_ROW; brick++, x+=BRICK_WIDTH) {
        // TODO draw rows of bricks
        if (bricks.row1[brick]) {
            drawBrick(x, BRICK_START_Y);
        }

        if (bricks.row2[brick]) {
            drawBrick(x, BRICK_START_Y + BRICK_HEIGHT);
        }

        if (bricks.row3[brick]) {
            drawBrick(x, BRICK_START_Y + BRICK_HEIGHT * 2);
        }

        if (bricks.row4[brick]) {
            drawBrick(x, BRICK_START_Y + BRICK_HEIGHT * 3);
        }
    
        if (bricks.row5[brick]) {
            drawBrick(x, BRICK_START_Y + BRICK_HEIGHT * 4);
        }

        if (bricks.row6[brick]) {
            drawBrick(x, BRICK_START_Y + BRICK_HEIGHT * 5);
        }

        x += BRICK_WIDTH;
    }

    // draw player paddle

    // draw player ball
}


function drawBrick(x, y) {
    // TODO
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
        shaders['program1']['uniforms']['u_modelviewProjection'],
        false,
        normalizedModelViewProjection
    );    

    // background

    mat4.identity(modelScale);
    gl.uniformMatrix4fv(
        shaders['program1']['uniforms']['u_Scale'],
        false,
        modelScale
    );

    mat4.identity(modelTranslate);
    gl.uniformMatrix4fv(
        shaders['program1']['uniforms']['u_Translate'],
        false,
        modelTranslate
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers['2x2_rect'].buffer);
    gl.vertexAttribPointer(
        shaders['program1']['attribs']['a_coords'],
        buffers['2x2_rect'].size,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(shaders['program1']['attribs']['a_coords']);

    gl.uniform4f(shaders['program1']['uniforms']['u_color'], 0, 0, 0, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffers['2x2_rect'].count);
}

requestAnimationFrame(setup);

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
