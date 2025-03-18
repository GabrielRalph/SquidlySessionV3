import {Vector, SvgPlus} from "../SvgPlus/4.js"
import {SvgPath, DPath} from "../SvgPlus/svg-path.js"

async function next(){return new Promise((resolve, reject) => {window.requestAnimationFrame(resolve)})}

function lurp(a, t) {return a[0].mul(1-t).add(a[1].mul(t))}

let style = new SvgPlus("style");
style.props = {"type": "text/css"}
style.innerHTML = `
splash-screen {
    --main-color: #8F53C9;
    --eyes-background: white;
}
.eyes{
    fill: var(--eyes-background);
}
.tenticles-tapper{
    fill:var(--main-color);
}
.hidden-path{
    opacity:0;
    fill:none;
}
.tenticles-path{
    fill:none;
    stroke:var(--main-color);
    stroke-miterlimit:10;
    stroke-width: 12; 
    stroke-linecap: round;
}`

const template = `<svg viewBox="0 0 195.4 230">
<g id="tenticles">
	<g>
		<path class="tenticles-path" d="M67.5,132.3c0,0-3.5,17.2-22.5,24.1c-23.4,8.5-25.6,36.4-25.6,36.4"/>
		<path class="hidden-path" d="M67.5,132.3c0,0-11.5,19.7-9.5,37.5c2.8,24.7-6.8,37.5-6.8,37.5"/>
	</g>
	<g>
		<path class="tenticles-path" d="M94.9,132.3c7.1,14.1,13,20.9,8.1,35.2c-6.2,18-31.3,24.7-31.3,24.7"/>
		<path class="hidden-path" d="M94.9,132.3c10,16.9,7.8,29.6,3.5,42.1c-6,17.3,0,42.1,0,42.1"/>
	</g>
	<g>
		<path class="tenticles-path" d="M127.8,120.6c0,0-6.4,31.2,22.6,38.5c22,5.5,25.4,33.8,25.4,33.8"/>
		<path class="hidden-path" d="M127.8,120.6c0,0,14,27.5,4.4,50.8c-8,19.5-1.1,39.5-1.1,39.5"/>
	</g>
</g>
<g id = "tapper"></g>
<g>
	<rect x="53.4" y="79.3" class="eyes" width="87.2" height="51.3"/>
	<path class="tenticles-tapper" d="M54.7,135.6l23.4,8h29.8l29.3-3.1c0,0,5.5-7.6,6.9-11.5c1.4-4,1.3-8.9,1.9-11.7c7,1,13.6-4.1,12.7-10.4
		c-7.8-60.3-39.9-88-54.1-97.6c-4-2.7-9.7-2.7-13.7,0c-14.2,9.5-46.2,37.2-54.1,97.1c-0.8,6.4,5.8,11.5,12.9,10.4
		c0.5,3.1,1,7.6,0.5,12.2L54.7,135.6z M114.5,128.9c-6.6,0-12.5-3.1-16.3-7.8c-1.3-1.6-3.8-1.6-5.2,0c-3.8,4.8-9.7,7.8-16.3,7.8
		c-12,0-21.7-10.1-21-22.2c0.6-10.9,9.7-19.6,20.6-19.8c6.8-0.1,12.8,3,16.7,7.8c1.3,1.6,3.8,1.6,5.2,0c3.9-4.9,10-7.9,16.7-7.8
		c10.9,0.2,20,9,20.6,19.8C136.1,118.8,126.5,128.9,114.5,128.9z"/>
	<path class="tenticles-tapper" d="M82,109.8c-2.2-0.4-3.9-2.2-4.2-4.4c-0.3-1.8,0.3-3.6,1.4-4.7c1-1,0.3-2.7-1.1-2.9c-0.9-0.1-1.9-0.1-2.9,0
		c-4.6,0.6-8.3,4.4-8.8,9.1c-0.6,6.1,4.2,11.3,10.2,11.3c4.1,0,7.6-2.4,9.2-5.8c0.6-1.3-0.4-2.7-1.9-2.5
		C83.4,109.9,82.7,109.9,82,109.8z"/>
	<path class="tenticles-tapper" d="M120.2,109.8c-2.2-0.4-3.9-2.2-4.2-4.4c-0.3-1.8,0.3-3.6,1.4-4.7c1-1,0.3-2.7-1.1-2.9c-0.9-0.1-1.9-0.1-2.9,0
		c-4.6,0.6-8.3,4.4-8.8,9.1c-0.6,6.1,4.2,11.3,10.2,11.3c4.1,0,7.6-2.4,9.2-5.8c0.6-1.3-0.4-2.7-1.9-2.5
		C121.6,109.9,120.9,109.9,120.2,109.8z"/>
</g>
<path class="hidden-path" d="M50.2,128.9c-0.7,6.5-3.3,13.3-10.5,16.4c-23.5,10.2-25.3,35.8-26,45.5c0,0.6-0.1,1.1-0.1,1.5
   c-0.2,3,1.8,5.7,4.7,6.3c0.4,0.1,0.8,0.1,1.3,0.1c2.5,0,4.8-1.6,5.6-4c0.1-0.2,8.6-23.4,27.8-26.2c13.2-1.9,22.3-7.9,28.5-16
   c1.1,2.1,2.4,4.2,4.1,6.1c2.8,3.1,2.6,5,2.6,5.6c-0.4,5-8.1,11.2-14.4,16.2c-1.7,1.4-3.5,2.8-5.1,4.2c-2,1.7-2.7,4.6-1.6,7
   c1,2.2,3.1,3.6,5.5,3.6c0.3,0,0.5,0,0.8,0c0.4,0,9.7-1.3,19.7-4.5c14.8-4.7,23.4-11.5,25.6-19.9c1.1-4,1.4-7.5,1.3-10.6
   c5.5,4.8,12.7,8.3,22.3,9.8c19.2,2.8,27.7,26,27.8,26.2c0.9,2.4,3.2,4,5.7,4c0.4,0,0.8,0,1.3-0.1c2.9-0.6,5-3.3,4.7-6.4
   c0.1-0.5,0.1-1,0-1.6c-0.7-9.7-2.5-35.3-26-45.5c-7.7-3.3-10.2-10.8-10.7-17.7"/>
</svg>`

let LURPS = {

}
export class SplashScreen extends SvgPlus{
    constructor(el = "splash-screen") {
        super(el)
        if (typeof el == "string") this.onconnect();
    }
    onconnect(){
        this.innerHTML = template;
        this.appendChild(style);

        this.tapper = new SvgPlus(this.querySelector('#tapper'));
        this.tenticles = [...this.querySelector("#tenticles").children].map(g => [...g.children].map(p => new SvgPath(p)));
        this.tenticles.forEach(ps => ps.push(new DPath(ps[0].d + "")))
        this.start();
    }
    ondisconnect(){
        this.stop();
    }

    async start(res = 5){
        if (this.started) return;
        this.started = true;
        let stop = false;
        this.stop = () => stop = true;
        let theta = 0;

        for (let i = 0; i < 1e10; i++) {
            for (let t = 0; t < 1; t += 0.01 * res) {
                let t0 = performance.now();
                this.lurpTenticles(i%2 == 0 ? 1-t :t);
                this.style.setProperty("--y", -Math.cos(theta));
                theta += res * Math.PI/100;
                if (stop) break;
                while (performance.now() - t0 < 30) {
                    await next();
                }
            }
            if (stop) break;
        }
        this.started = false;
    }

    lurpTenticles(t){
        this.tapper.innerHTML = "";
        let precalc = false;
        if (t in LURPS) {
            this.tapper.innerHTML = LURPS[t];
            precalc = true;
        } 
        for (let [p1, p2, p0] of this.tenticles) {
            let cp2 = p2.d.start;
            let cp0 = p0.start;
            for (let cp1 of p1.d) {
                cp1.p = lurp([cp2.p, cp0.p], t);
                cp1.c1 = lurp([cp2.c1, cp0.c1], t);
                cp1.c2 = lurp([cp2.c2, cp0.c2], t);
                cp2 = cp2.next;
                cp0 = cp0.next;
            }
            p1.update();
            if (!precalc) this.tapperPath(p1);
        }
        if (!precalc) LURPS[t] = this.tapper.innerHTML;
    }

    tapperPath(path, segs = 50, width = 12){
        let tapper = this.tapper;
        let l = path.getTotalLength();
        let sl = l/segs;
        let d2= "";
        let d3 = "";
        for (let i = 0; i < segs; i++) {
            let p0 = path.getVectorAtLength(i*sl);
            let p1 = path.getVectorAtLength((i+0.5)*sl);
            let p2 = p1.sub(p0).rotate(Math.PI/2);
            p2 = p2.div(p2.norm()).mul(6 + (segs-i)*(width/segs));
            let p4 = p0.add(p2.rotate(Math.PI)) ;
            let p3 = p0.add(p2);

            d2 = d2 == "" ? `M${p3}` : d2 + `L${p3}`;
            d3= `L${p4}` + d3;
        }

        return  tapper.createChild("path", {
            d: d2 + d3,
            class: "tenticles-tapper",
        })
    }
}