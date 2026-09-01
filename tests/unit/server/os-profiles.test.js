const { buildBundledOsProfiles, findBundledOsProfile } = require('../../../server/services/os-profiles');

describe('bundled OS profiles', () => {
  const generic = { ref: 'OpaqueRef:other-install', name_label: 'Other install media', disks: [] };

  it('exposes diskless Windows and Linux profiles without requiring user-created templates', () => {
    const profiles = buildBundledOsProfiles([generic]);

    expect(profiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ profileId: 'windows-server-2003', sourceRef: generic.ref, defaults: expect.objectContaining({ bootMode: 'bios' }) }),
      expect.objectContaining({ profileId: 'windows-server-2012-r2', sourceRef: generic.ref }),
      expect.objectContaining({ profileId: 'windows-server-2025', sourceRef: generic.ref, defaults: expect.objectContaining({ bootMode: 'uefi' }) }),
      expect.objectContaining({ profileId: 'windows-11', sourceRef: generic.ref, defaults: expect.objectContaining({ bootMode: 'uefi-secure' }) }),
      expect.objectContaining({ profileId: 'ubuntu-server-24-04', sourceRef: generic.ref }),
    ]));
    expect(profiles.every((profile) => profile.disks.length === 0 && profile.sourceFallback)).toBe(true);
  });

  it('prefers a pool-provided matching diskless template over the generic source', () => {
    const windows2022 = { ref: 'OpaqueRef:windows-2022', name_label: 'Windows Server 2022', disks: [] };
    const profile = findBundledOsProfile('windows-server-2022', [generic, windows2022]);

    expect(profile).toEqual(expect.objectContaining({ sourceRef: windows2022.ref, sourceFallback: false }));
  });
});
