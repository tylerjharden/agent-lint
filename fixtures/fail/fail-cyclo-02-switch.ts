/** Golden fail (complexity): switch/case explosion — labeled cyclo. */
export function colorName(code: number): string {
  switch (code) {
    case 1:
      return "red";
    case 2:
      return "orange";
    case 3:
      return "yellow";
    case 4:
      return "green";
    case 5:
      return "blue";
    case 6:
      return "indigo";
    case 7:
      return "violet";
    case 8:
      return "pink";
    case 9:
      return "brown";
    case 10:
      return "black";
    case 11:
      return "white";
    case 12:
      return "gray";
    case 13:
      return "cyan";
    case 14:
      return "magenta";
    case 15:
      return "gold";
    case 16:
      return "silver";
    default:
      return "none";
  }
}
