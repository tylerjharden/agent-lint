/** Golden fail (cognitive): nesting increments — labeled cognitive. */
export function scoreTree(node: NestNode | undefined, depth: number): number {
  if (node === undefined) {
    return 0;
  }
  if (node.alive) {
    if (depth > 0) {
      if (node.children !== undefined) {
        for (const child of node.children) {
          if (child.alive) {
            while (child.weight > 0) {
              if (child.flag) {
                if (child.alt) {
                  if (depth > 2) {
                    return child.weight + depth;
                  }
                }
              }
              child.weight -= 1;
            }
          }
        }
      }
    }
  }
  return node.weight;
}

export interface NestNode {
  alive: boolean;
  weight: number;
  flag?: boolean;
  alt?: boolean;
  children?: NestNode[];
}
