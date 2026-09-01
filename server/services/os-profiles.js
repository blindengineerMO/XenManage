const BUNDLED_OS_PROFILES = [
  { id: 'windows-server-2003', nameLabel: 'Windows Server 2003', aliases: ['windows server 2003'], bootMode: 'bios', diskGiB: 32, memoryGiB: 2, vcpus: 1 },
  { id: 'windows-server-2008-r2', nameLabel: 'Windows Server 2008 R2', aliases: ['windows server 2008 r2', 'windows server 2008'], bootMode: 'bios', diskGiB: 40, memoryGiB: 2, vcpus: 2 },
  { id: 'windows-server-2012-r2', nameLabel: 'Windows Server 2012 R2', aliases: ['windows server 2012 r2', 'windows server 2012'], bootMode: 'bios', diskGiB: 60, memoryGiB: 4, vcpus: 2 },
  { id: 'windows-server-2016', nameLabel: 'Windows Server 2016', aliases: ['windows server 2016'], bootMode: 'bios', diskGiB: 60, memoryGiB: 4, vcpus: 2 },
  { id: 'windows-server-2019', nameLabel: 'Windows Server 2019', aliases: ['windows server 2019'], bootMode: 'bios', diskGiB: 60, memoryGiB: 4, vcpus: 2 },
  { id: 'windows-server-2022', nameLabel: 'Windows Server 2022', aliases: ['windows server 2022'], bootMode: 'uefi', diskGiB: 64, memoryGiB: 4, vcpus: 2 },
  { id: 'windows-server-2025', nameLabel: 'Windows Server 2025', aliases: ['windows server 2025'], bootMode: 'uefi', diskGiB: 64, memoryGiB: 4, vcpus: 2 },
  { id: 'windows-10', nameLabel: 'Windows 10', aliases: ['windows 10'], bootMode: 'uefi', diskGiB: 64, memoryGiB: 4, vcpus: 2 },
  { id: 'windows-11', nameLabel: 'Windows 11', aliases: ['windows 11'], bootMode: 'uefi-secure', diskGiB: 64, memoryGiB: 4, vcpus: 2 },
  { id: 'ubuntu-server-24-04', nameLabel: 'Ubuntu Server 24.04 LTS', aliases: ['ubuntu 24.04', 'ubuntu server 24.04'], bootMode: 'uefi', diskGiB: 32, memoryGiB: 2, vcpus: 2 },
  { id: 'ubuntu-server-22-04', nameLabel: 'Ubuntu Server 22.04 LTS', aliases: ['ubuntu 22.04', 'ubuntu server 22.04'], bootMode: 'uefi', diskGiB: 32, memoryGiB: 2, vcpus: 2 },
  { id: 'debian-12', nameLabel: 'Debian 12', aliases: ['debian 12'], bootMode: 'uefi', diskGiB: 24, memoryGiB: 2, vcpus: 2 },
  { id: 'rocky-linux-9', nameLabel: 'Rocky Linux 9', aliases: ['rocky linux 9'], bootMode: 'uefi', diskGiB: 40, memoryGiB: 2, vcpus: 2 },
  { id: 'rhel-9', nameLabel: 'Red Hat Enterprise Linux 9', aliases: ['red hat enterprise linux 9', 'rhel 9'], bootMode: 'uefi', diskGiB: 40, memoryGiB: 2, vcpus: 2 },
  { id: 'sles-15', nameLabel: 'SUSE Linux Enterprise Server 15', aliases: ['suse linux enterprise server 15', 'sles 15'], bootMode: 'uefi', diskGiB: 40, memoryGiB: 2, vcpus: 2 },
  { id: 'other-linux', nameLabel: 'Other Linux (ISO or PXE)', aliases: ['other linux'], bootMode: 'bios', diskGiB: 32, memoryGiB: 2, vcpus: 2 },
  { id: 'other-install-media', nameLabel: 'Other install media', aliases: ['other install media'], bootMode: 'bios', diskGiB: 32, memoryGiB: 2, vcpus: 2 },
];

function normalizedName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findProfileSource(profile, sources, genericSource) {
  const matched = sources.find((source) => {
    const name = normalizedName(source.name_label);
    return profile.aliases.some((alias) => name.includes(normalizedName(alias)));
  });
  return matched || genericSource || null;
}

function buildBundledOsProfiles(operatingSystems = []) {
  const sources = Array.isArray(operatingSystems) ? operatingSystems : [];
  const genericSource = sources.find((source) => normalizedName(source.name_label) === 'other install media') || null;

  return BUNDLED_OS_PROFILES.map((profile) => {
    const source = findProfileSource(profile, sources, genericSource);
    if (!source) return null;
    return {
      profileId: profile.id,
      sourceRef: source.ref,
      sourceName: source.name_label || '',
      name_label: profile.nameLabel,
      name_description: `Bundled diskless installation profile. Uses ${source.name_label || 'the pool default'} as its XenServer source; attach a licensed installer ISO or use PXE.`,
      disks: [],
      defaults: { bootMode: profile.bootMode, diskGiB: profile.diskGiB, memoryGiB: profile.memoryGiB, vcpus: profile.vcpus },
      sourceFallback: Boolean(genericSource && source.ref === genericSource.ref),
    };
  }).filter(Boolean);
}

function findBundledOsProfile(profileId, operatingSystems = []) {
  return buildBundledOsProfiles(operatingSystems).find((profile) => profile.profileId === String(profileId || '').trim()) || null;
}

module.exports = { BUNDLED_OS_PROFILES, buildBundledOsProfiles, findBundledOsProfile };
