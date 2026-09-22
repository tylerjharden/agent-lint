/** Golden fail (cognitive): nested loops + guards — labeled cognitive. */
export function scanGrid(grid: number[][], limit: number): number {
  let total = 0;
  for (const row of grid) {
    if (row.length === 0) {
      continue;
    }
    for (const cell of row) {
      if (cell > 0) {
        for (let step = 0; step < cell; step += 1) {
          if (step % 2 === 0) {
            if (total < limit) {
              if (cell > 3) {
                total += step;
              } else {
                total += 1;
              }
            } else {
              if (cell > 8) {
                total -= 1;
              }
            }
          }
        }
      }
    }
  }
  return total;
}
