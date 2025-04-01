export function linspace(start, end, incs) {
    let range = end - start;
    let dx = range / (incs - 1);
    let space = [];
    for (let i = 0; i < incs; i ++) space.push(start + i * dx);
    return space;
  }
  