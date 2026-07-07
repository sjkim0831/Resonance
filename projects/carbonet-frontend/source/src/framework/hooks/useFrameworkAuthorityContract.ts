import { useEffect, useState } from "react";
import { fetchFrameworkAuthorityContract } from "../api";
import type {
  FrameworkAuthorityContract,
  FrameworkAuthorityOption,
  FrameworkAuthorityRoleContract,
  FrameworkAuthorityText
} from "../contracts";

type UseFrameworkAuthorityContractState = {
  contract: FrameworkAuthorityContract | null;
  authorityRoles: FrameworkAuthorityRoleContract[];
  builderReadyRoles: FrameworkAuthorityRoleContract[];
  roleCategoryOptions: FrameworkAuthorityOption[];
  assignmentAuthorities: FrameworkAuthorityText[];
  roleCategories: FrameworkAuthorityText[];
  loading: boolean;
  error: string;
};

const emptyState: Omit<UseFrameworkAuthorityContractState, "loading" | "error"> = {
  contract: null,
  authorityRoles: [],
  builderReadyRoles: [],
  roleCategoryOptions: [],
  assignmentAuthorities: [],
  roleCategories: []
};

export function useFrameworkAuthorityContract(): UseFrameworkAuthorityContractState {
  const [state, setState] = useState<UseFrameworkAuthorityContractState>({
    ...emptyState,
    loading: true,
    error: ""
  });

  useEffect(() => {
    let cancelled = false;

    fetchFrameworkAuthorityContract()
      .then((contract) => {
        if (cancelled) {
          return;
        }
        setState({
          contract,
          authorityRoles: contract.authorityRoles || [],
          builderReadyRoles: (contract.authorityRoles || []).filter((item) => item.builderReady),
          roleCategoryOptions: contract.roleCategoryOptions || [],
          assignmentAuthorities: contract.assignmentAuthorities || [],
          roleCategories: contract.roleCategories || [],
          loading: false,
          error: ""
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          ...emptyState,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load framework authority contract."
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
