import frameworkContractMetadata from "../generated/frameworkContractMetadata.json";
import type { FrameworkContractMetadata } from "./contracts";

export function getFrameworkContractMetadata(): FrameworkContractMetadata {
  return frameworkContractMetadata as FrameworkContractMetadata;
}
