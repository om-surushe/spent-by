export function getBudgetProgress(spent: number, budget: number) {
  if (budget <= 0) return null;
  return Math.round((spent / budget) * 100);
}
