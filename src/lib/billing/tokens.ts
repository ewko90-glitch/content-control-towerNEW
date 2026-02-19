export type TokenState = {
  saldo: number;
  odnowienieISO: string;
  planMiesiecznyLimit: number | "bez_limitu";
};

export function czySaTokeny(state: TokenState): boolean {
  if (state.planMiesiecznyLimit === "bez_limitu") {
    return true;
  }
  return state.saldo > 0;
}
