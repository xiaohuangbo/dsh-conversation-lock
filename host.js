// Versioned import keeps a plugin restart from reusing an already evaluated
// Host module. Bump the tag together with HOST_BUILD when index.js changes.
export { name, inject, Config, apply, HOST_BUILD } from './index.js?generation=1.1.0';
