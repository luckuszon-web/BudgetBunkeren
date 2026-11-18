import { useNavigate } from "@tanstack/react-router";
import { useFinance } from "./finance-store";

/** Gå til Posteringer med en søgning (søgningen gælder alle perioder). */
export function useShowTransactions() {
  const { actions } = useFinance();
  const go = useNavigate();
  return (search: string) => {
    actions.setFilters({ search, kind: "all", categoryId: null, dateFrom: null, dateTo: null });
    void go({ to: "/posteringer" });
  };
}
