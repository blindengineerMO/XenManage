const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('shared keyboard and ARIA markup', () => {
  it('keeps primary navigation keyboard operable and named while collapsed', () => {
    const source = read('client/assets/js/components/layout/SideNav.js');
    const primaryItems = [...source.matchAll(/<div class="tree-item(?: tree-item-subtle)?"[^>]+>/g)].map(match => match[0]);

    expect(primaryItems.length).toBeGreaterThanOrEqual(24);
    primaryItems.forEach((item) => {
      expect(item).toContain('role="link"');
      expect(item).toContain('tabindex="0"');
      expect(item).toContain('aria-label=');
      expect(item).toContain('@keydown.enter.prevent=');
      expect(item).toContain('@keydown.space.prevent=');
    });
  });

  it('uses menu semantics and standard keyboard navigation for context actions', () => {
    const source = read('client/assets/js/components/controls/ContextMenu.js');
    expect(source).toContain('role="menu"');
    expect(source).toContain('role="menuitem"');
    expect(source).toContain("event.key === 'ArrowDown'");
    expect(source).toContain("event.key === 'ArrowUp'");
    expect(source).toContain("event.key === 'Escape'");
  });

  it('names shared icon-only controls and exposes prompt errors', () => {
    const topNav = read('client/assets/js/components/layout/TopNav.js');
    const prompt = read('client/assets/js/components/dialogs/PromptWindow.js');
    expect(topNav).toContain("aria-label=\"sidebarOpen ? 'Collapse navigation' : 'Expand navigation'\"");
    expect(topNav).toContain('aria-label="Sign out"');
    expect(prompt).toContain(':aria-label="\'Close \' + title"');
    expect(prompt).toContain('role="alert"');
    expect(prompt).toContain('@keydown.esc.prevent=');
  });
});
