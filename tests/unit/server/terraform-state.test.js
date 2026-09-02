const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'terraform-state-test.db');
process.env.DB_PATH = TEST_DB;

const { getDb, terraformStateModel } = require('../../../server/models/connection');

describe('terraformStateModel', () => {
  beforeEach(() => {
    getDb().prepare('DELETE FROM terraform_states').run();
  });

  afterAll(() => {
    getDb().close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('persists state and enforces lock ownership', () => {
    terraformStateModel.save('production', JSON.stringify({ version: 4 }), 7);
    expect(JSON.parse(terraformStateModel.get('production').state_json)).toEqual({ version: 4 });

    expect(terraformStateModel.lock('production', 'lock-a', JSON.stringify({ ID: 'lock-a' }), 7).lock_id).toBe('lock-a');
    expect(terraformStateModel.lock('production', 'lock-b', JSON.stringify({ ID: 'lock-b' }), 8)).toBeNull();
    expect(terraformStateModel.unlock('production', 'lock-b')).toBe(false);
    expect(terraformStateModel.unlock('production', 'lock-a')).toBe(true);
  });
});
