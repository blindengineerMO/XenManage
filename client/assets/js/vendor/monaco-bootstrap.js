/*
 * ESM entry for the Template Library Monaco editor.
 * esbuild bundles this to /dist/vendor/monaco/monaco.js plus editor.worker
 * and json.worker. TemplateLibraryView loads it via dynamic import and
 * window.MonacoEnvironment.getWorker — required because CSP script-src is
 * nonce-only and cannot eval Monaco's default inline/blob workers.
 * Keep editor services + JSON language in this single module instance.
 */
import * as monaco from 'monaco-editor/editor/editor.main.js';
import 'monaco-editor/language/json/monaco.contribution.js';

// Keep editor services and JSON language registration in one module instance.
export default monaco;
