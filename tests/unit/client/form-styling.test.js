const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const THEMED_CLASSES = new Set([
  'form-input',
  'form-select',
  'form-toggle',
  'form-switch',
  'data-table-search',
  'data-table-inline-input',
  'data-table-select',
]);

function controlClasses(tag) {
  const className = tag.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] || '';
  return className.split(/\s+/).filter(Boolean);
}

describe('shared form styling', () => {
  it('gives every text control a themed class and adapts native selects to the theme', () => {
    const files = execFileSync('rg', ['-l', '<(?:input|select|textarea)\\b', 'client/assets/js'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean);
    const missing = [];

    files.forEach((file) => {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const match of source.matchAll(/<(input|select|textarea)\b[^>]*>/gs)) {
        const tag = match[0];
        const inputType = tag.match(/\btype\s*=\s*["']([^"']*)["']/i)?.[1] || '';
        const isNativeControl = inputType === 'checkbox' || inputType === 'file';
        if (isNativeControl || controlClasses(tag).some((name) => THEMED_CLASSES.has(name))) continue;
        missing.push(`${file}:${source.slice(0, match.index).split('\n').length}`);
      }
    });

    expect(missing).toEqual([]);

    const css = fs.readFileSync(path.join(ROOT, 'client/assets/css/components.css'), 'utf8');
    const themeCss = fs.readFileSync(path.join(ROOT, 'client/assets/css/main.css'), 'utf8');
    expect(css).toMatch(/\.form-input,\s*\.form-select\s*\{/);
    expect(css).toMatch(/select\.form-input,\s*\.form-select\s*\{[\s\S]*?color-scheme:\s*var\(--native-color-scheme\)/);
    expect(themeCss).toMatch(/--native-color-scheme:\s*dark/);
    expect(themeCss).toMatch(/:root\[data-theme="light"\][\s\S]*?--native-color-scheme:\s*light/);
    expect(css).toMatch(/\.data-table input\[type="checkbox"\]\s*\{/);
    expect(fs.readFileSync(path.join(ROOT, 'client/assets/js/components/forms/RemediationTaskTemplateForm.js'), 'utf8'))
      .not.toContain('checkbox-row');
  });
});
