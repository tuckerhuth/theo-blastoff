// Theme registry: name -> theme object. Adding a new game world (monkey,
// spider, ...) is one new file here plus one line below — engine, ui, and
// audio never import a theme module directly.

import { rocketTheme } from './rocket.js';

export const THEMES = {
  rocket: rocketTheme,
};

let active = rocketTheme;

// Unknown names fall back to rocket — forward-compat if an older/newer
// save references a theme this build doesn't have.
export function setActiveTheme(name) {
  active = THEMES[name] || THEMES.rocket;
  return active;
}

export function activeTheme() { return active; }

// Tiles/bigNum read colors at render time, so this always reflects whatever
// theme (and, for knight, whatever palette) is current.
export function numberColors() { return active.numberColors(); }
