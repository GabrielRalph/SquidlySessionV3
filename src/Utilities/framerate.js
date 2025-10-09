import { SvgPlus } from "../SvgPlus/4.js";

export class FrameRateMonitor extends SvgPlus {
    bufferMax = 200;
    constructor(){
        super("canvas");
        this.ctx = this.getContext("2d");
        this.buffer = new Array(this.bufferMax).fill(0);
        this.width = this.bufferMax;
        this.height = 100;

        let then = performance.now();
        let next = () => {
            let now = performance.now();
            let delta = now - then;
            then = now;
            let fps = 1000 / delta;

            this.buffer.push(fps);
            this.buffer.shift();
            this.update();
            
            requestAnimationFrame(next);
        }
        next();
    }

    update(){
        let avg = this.buffer.reduce((a,b) => a + b, 0) / this.buffer.length;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.beginPath();
        ctx.moveTo(0, this.height);
        for (let i = 0; i < this.buffer.length; i++) {
            let v = this.buffer[i];
            let y = this.height - (v / 2);
            if (y < 0) y = 0;
            if (y > this.height) y = this.height;
            ctx.lineTo(i, y);
        }
        ctx.lineTo(this.width, this.height);
        ctx.fillStyle = `hsla(${(avg / 120) * 120}, 100%, 50%, 0.5)`;
        ctx.fill();
        ctx.strokeStyle = `hsl(${(avg / 120) * 120}, 100%, 50%)`;
        ctx.stroke();
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Arial";
        ctx.fillText("FPS: " + avg.toFixed(1), 10, 20);
    }
}