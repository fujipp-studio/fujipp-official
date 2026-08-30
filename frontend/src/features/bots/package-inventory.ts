import { type FeatureLicense } from '@/features/bots/api'

export interface PackageInventoryGroup {
  key: string
  featureProductId: string
  featureCode: string
  featureName: string
  version: string
  licenses: FeatureLicense[]
  availableSlots: number
  installationLimit: number
}

export function availableLicenseSlots(license: FeatureLicense) {
  return Math.max(0, license.installationLimit - license.installations.length)
}

function licenseCanBeDisplayed(license: FeatureLicense, now: number) {
  if (license.status !== 'ACTIVE') return false
  return !license.expiresAt || new Date(license.expiresAt).getTime() > now
}

function expirationTime(license: FeatureLicense) {
  return license.expiresAt ? new Date(license.expiresAt).getTime() : Number.POSITIVE_INFINITY
}

export function groupPackageInventory(
  licenses: FeatureLicense[],
  search = '',
  now = Date.now(),
): PackageInventoryGroup[] {
  const query = search.trim().toLocaleLowerCase()
  const groups = new Map<string, PackageInventoryGroup>()

  for (const license of licenses) {
    const searchable = `${license.featureCode} ${license.featureName}`.toLocaleLowerCase()
    if (
      searchable.includes('runtime') ||
      !searchable.includes(query) ||
      !licenseCanBeDisplayed(license, now)
    )
      continue

    const key = `${license.featureProductId}:${license.version}`
    const group = groups.get(key)
    if (group) {
      group.licenses.push(license)
      group.availableSlots += availableLicenseSlots(license)
      group.installationLimit += license.installationLimit
      continue
    }

    groups.set(key, {
      key,
      featureProductId: license.featureProductId,
      featureCode: license.featureCode,
      featureName: license.featureName,
      version: license.version,
      licenses: [license],
      availableSlots: availableLicenseSlots(license),
      installationLimit: license.installationLimit,
    })
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      licenses: [...group.licenses].sort(
        (left, right) =>
          expirationTime(left) - expirationTime(right) ||
          new Date(left.acquiredAt).getTime() - new Date(right.acquiredAt).getTime(),
      ),
    }))
    .filter((group) => group.availableSlots > 0)
    .sort(
      (left, right) =>
        left.featureName.localeCompare(right.featureName, 'en', { sensitivity: 'base' }) ||
        left.version.localeCompare(right.version, 'en', { numeric: true }),
    )
}

export function nextInstallableLicense(group: PackageInventoryGroup) {
  return group.licenses.find((license) => availableLicenseSlots(license) > 0)
}
