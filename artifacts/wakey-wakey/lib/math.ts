export type MathDifficulty = "easy" | "medium" | "hard";

export interface MathProblem {
  question: string;
  answer: number;
}

const rand = (lo: number, hi: number) =>
  Math.floor(Math.random() * (hi - lo + 1)) + lo;

export function generateMathProblem(difficulty: MathDifficulty): MathProblem {
  if (difficulty === "easy") {
    const a = rand(2, 19);
    const b = rand(2, 19);
    const op = Math.random() < 0.5 ? "+" : "-";
    const ans = op === "+" ? a + b : a - b;
    return { question: `${a} ${op} ${b}`, answer: ans };
  }
  if (difficulty === "medium") {
    const choice = rand(0, 2);
    if (choice === 0) {
      const a = rand(3, 12);
      const b = rand(3, 12);
      return { question: `${a} × ${b}`, answer: a * b };
    }
    const a = rand(15, 99);
    const b = rand(15, 99);
    const op = choice === 1 ? "+" : "-";
    return { question: `${a} ${op} ${b}`, answer: op === "+" ? a + b : a - b };
  }
  const choice = rand(0, 2);
  if (choice === 0) {
    const a = rand(11, 25);
    const b = rand(11, 25);
    return { question: `${a} × ${b}`, answer: a * b };
  }
  if (choice === 1) {
    const a = rand(10, 50);
    const b = rand(2, 12);
    const c = rand(2, 12);
    return { question: `${a} + ${b} × ${c}`, answer: a + b * c };
  }
  const b = rand(3, 12);
  const ans = rand(8, 25);
  const a = b * ans;
  return { question: `${a} ÷ ${b}`, answer: ans };
}

export function difficultyLabel(d: MathDifficulty): string {
  return d === "easy" ? "Easy" : d === "medium" ? "Medium" : "Hard";
}

export function difficultyDescription(d: MathDifficulty): string {
  if (d === "easy") return "Single + or − up to 19";
  if (d === "medium") return "Bigger numbers, multiplication";
  return "Order of operations & division";
}
