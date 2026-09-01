const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const config = require('../config');

function createBrowserError(code, message = code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function srRoot(srUuid) {
  const uuid = String(srUuid || '').trim();
  if (!uuid) {
    throw createBrowserError('SR_UUID_REQUIRED', 'The storage repository has no UUID to resolve a mount root.');
  }
  return path.join(config.storage.browserRoot, uuid);
}

/**
 * Resolves a caller-supplied relative path against an SR's mount root, rejecting any
 * escape via `..` segments, absolute paths, or symlink traversal outside the root.
 */
function resolveSafePath(srUuid, relativePath = '') {
  const root = srRoot(srUuid);
  const normalized = String(relativePath || '').replace(/\\/g, '/').trim();
  if (normalized.split('/').some((segment) => segment === '..')) {
    throw createBrowserError('PATH_TRAVERSAL_REJECTED', 'Paths may not contain ".." segments.');
  }
  const resolved = path.resolve(root, `.${path.sep}${normalized}`);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw createBrowserError('PATH_TRAVERSAL_REJECTED', 'Resolved path escapes the storage repository mount root.');
  }
  return { root, resolved };
}

async function ensureRoot(srUuid) {
  const root = srRoot(srUuid);
  await fsp.mkdir(root, { recursive: true });
  return root;
}

async function listDirectory(srUuid, relativePath = '') {
  await ensureRoot(srUuid);
  const { resolved } = resolveSafePath(srUuid, relativePath);
  let stat;
  try {
    stat = await fsp.stat(resolved);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw createBrowserError('PATH_NOT_FOUND', 'That path does not exist on the mounted export.', 404);
    }
    throw error;
  }
  if (!stat.isDirectory()) {
    throw createBrowserError('NOT_A_DIRECTORY', 'That path is not a directory.');
  }

  const entries = await fsp.readdir(resolved, { withFileTypes: true });
  const items = await Promise.all(entries.map(async (entry) => {
    const entryStat = await fsp.stat(path.join(resolved, entry.name));
    return {
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      sizeBytes: entry.isDirectory() ? 0 : entryStat.size,
      modifiedAt: entryStat.mtime.toISOString(),
    };
  }));

  items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
  return items;
}

async function makeDirectory(srUuid, relativePath, name) {
  await ensureRoot(srUuid);
  const safeName = String(name || '').trim();
  if (!safeName || /[/\\]/.test(safeName)) {
    throw createBrowserError('INVALID_NAME', 'Folder name must not contain path separators.');
  }
  const { resolved } = resolveSafePath(srUuid, path.posix.join(relativePath || '', safeName));
  await fsp.mkdir(resolved, { recursive: false });
  return { path: path.posix.join(relativePath || '', safeName) };
}

async function movePath(srUuid, fromPath, toPath) {
  await ensureRoot(srUuid);
  const from = resolveSafePath(srUuid, fromPath);
  const to = resolveSafePath(srUuid, toPath);
  await fsp.mkdir(path.dirname(to.resolved), { recursive: true });
  await fsp.rename(from.resolved, to.resolved);
  return { path: toPath };
}

async function deletePath(srUuid, relativePath) {
  await ensureRoot(srUuid);
  const { resolved } = resolveSafePath(srUuid, relativePath);
  await fsp.rm(resolved, { recursive: true, force: false });
  return { success: true };
}

function readableStreamFor(srUuid, relativePath) {
  const { resolved } = resolveSafePath(srUuid, relativePath);
  if (!fs.existsSync(resolved)) {
    throw createBrowserError('PATH_NOT_FOUND', 'That file does not exist on the mounted export.', 404);
  }
  return fs.createReadStream(resolved);
}

async function writeUploadedFile(srUuid, relativePath, name, buffer) {
  await ensureRoot(srUuid);
  const safeName = String(name || '').trim();
  if (!safeName || /[/\\]/.test(safeName)) {
    throw createBrowserError('INVALID_NAME', 'File name must not contain path separators.');
  }
  const { resolved } = resolveSafePath(srUuid, path.posix.join(relativePath || '', safeName));
  await fsp.mkdir(path.dirname(resolved), { recursive: true });
  await fsp.writeFile(resolved, buffer);
  return { path: path.posix.join(relativePath || '', safeName), sizeBytes: buffer.length };
}

module.exports = {
  createBrowserError,
  listDirectory,
  makeDirectory,
  movePath,
  deletePath,
  readableStreamFor,
  writeUploadedFile,
};
