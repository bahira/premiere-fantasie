// data/helpers.js — convenience accessors
import { ITEMS } from './items.js';
import { SKILLS } from './skills.js';
import { CHARACTERS } from './characters.js';

export function getElement(id) { return ITEMS[id]; }
export function getSkill(id) { return SKILLS[id]; }
export function getCharDef(id) { return CHARACTERS[id]; }
