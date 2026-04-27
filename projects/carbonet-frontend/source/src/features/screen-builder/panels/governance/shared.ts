export type SystemCatalogInstance = {
  key: string;
  styleGroupId: string;
  componentType: string;
  componentName: string;
  variant?: string;
  size?: string;
  className?: string;
  icon?: string;
  label?: string;
  placeholder?: string;
  route: {
    routeId: string;
    koPath: string;
    enPath: string;
    label: string;
  };
};

export type SystemCatalogGroup = {
  key: string;
  styleGroupId: string;
  componentType: string;
  componentName: string;
  variant?: string;
  size?: string;
  className?: string;
  icon?: string;
  placeholder?: string;
  instanceCount: number;
  routeCount: number;
};

export type VirtualWindow = {
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
};
