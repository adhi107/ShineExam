import genericBrand from "../../brands/generic.json";
import abcBrand from "../../brands/abc_academy.json";
import xyzBrand from "../../brands/xyz_institute.json";
import { StaticBrandConfig } from "../types/tenant";

// All registered white-label brand definitions
const BRAND_REGISTRY: Record<string, StaticBrandConfig> = {
  generic: genericBrand as StaticBrandConfig,
  abc: abcBrand as StaticBrandConfig,
  xyz: xyzBrand as StaticBrandConfig,
};

// Current active build flavor brand (default to generic)
export const ACTIVE_BUILD_BRAND: StaticBrandConfig = BRAND_REGISTRY.generic;

export function getBrandConfig(brandId?: string): StaticBrandConfig {
  if (brandId && BRAND_REGISTRY[brandId]) {
    return BRAND_REGISTRY[brandId];
  }
  return ACTIVE_BUILD_BRAND;
}
