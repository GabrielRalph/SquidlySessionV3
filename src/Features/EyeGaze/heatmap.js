let Heatmaps = new Set();


function makeKernal(kernal) {
    let array = new Array(kernal).fill(0).map(() => new Array(kernal).fill(0));
    let center = Math.floor(kernal / 2);
    for (let i = 0; i < kernal; i++) {
        for (let j = 0; j < kernal; j++) {
            let distance = Math.sqrt(Math.pow(i - center, 2) + Math.pow(j - center, 2));
            distance = distance < center ? (1 - distance / center) : 0;
            array[i][j] = distance;
        }
    }
    return array;
}

export class Heatmap extends Array {
    constructor(resolution, kernal = 20) {
        let fullSize = resolution;
        super(fullSize);

        this.fill(0);
        for (let i = 0; i < fullSize; i++) {
            this[i] = new Array(fullSize).fill(0);
        }

        this.kernal = makeKernal(kernal);

        this.counts = 0;
    }

    async screenShot() {
        // let canvas = await html2canvas(document.body, {
        //     backgroundColor: null,
        //     scale: 1,
        //     useCORS: true,
        //     logging: false,
        //     allowTaint: true,
        // });
        // this.saveImage(canvas);
    }
    
    addPoint(x, y, value) {
        this.counts++;

        let xi = Math.round(x * (this.length - 1));
        let yi = Math.round(y * (this[0].length - 1));

        let xis = xi - Math.floor(this.kernal.length / 2);
        let yis = yi - Math.floor(this.kernal[0].length / 2);

        for (let i = 0; i < this.kernal.length; i++) {
            for (let j = 0; j < this.kernal[i].length; j++) {
                let xIndex = xis + i;
                let yIndex = yis + j;
                this.increment(xIndex, yIndex, value * this.kernal[i][j]);
            }
        }
    }

    increment(i, j, value) {
        if (i < 0 || i >= this.length || j < 0 || j >= this[0].length) return;
        this[i][j] += value;
    }

    start() {
        Heatmaps.add(this);
    }

    stop() {
        Heatmaps.delete(this);
    }

    get max() {
        let max = null;
        for (let x = 0; x < this.length; x++) {
            for (let y = 0; y < this[0].length; y++) {
                if (max === null || this[x][y] > max) {
                    max = this[x][y];
                }
            }
        }
        return max || 1; // Avoid division by zero
    }
    
    render(canvas = null) {
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = this.length;
            canvas.height = this[0].length;
        }
        let ctx = canvas.getContext('2d');
        let max = this.max;
        for (let x = 0; x < this.length; x++) {
            for (let y = 0; y < this[0].length; y++) {
                let intensity = this[x][y] / max;
                ctx.fillStyle = `hsla(${(1 - intensity) * 200}, 100%, 50%, ${intensity < 0.15 ? 0.5 * intensity / 0.15 : 0.5})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }

        return canvas;
    }

    saveImage(canvas) {
        if (!canvas) canvas = this.render();
        let link = document.createElement('a');
        link.download = 'heatmap.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}

export function addPointToHeatmaps(x, y, value = 1) {
    Heatmaps.forEach(heatmap => {
        heatmap.addPoint(x, y, value);
    });
}
