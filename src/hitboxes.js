/* hitboxes.js — The bosses' hitboxes (v0.52, user: drawn in the hitbox editor on localhost and saved here by
   tools/devserver.py). Per boss, per pose (its state; `default` for every pose without its own): shapes
   [x1, y1, x2, y2, r, part] in the units of the body part it's pinned to ('root', the legs, if there's no part; 'body',
   'head' …), facing right. Both ends the same: a circle. combat.js applyHitbox moves them with their parts. */
'use strict';
const HITBOXES = {
  "boss": {
    "default": [[-0.6, 5.8, 18.9, -27.4, 11.2, "body"], [-6.5, 8, -34.3, -8.3, 5.8, "tail"]]
  },
  "obi": {
    "default": [[0.4, 10.1, 0.6, -6.9, 10.8], [0.8, -7.1, 1.4, -27.9, 6.8, "body"]]
  },
  "makora": {
    "default": [[-0.4, -3.4, 0.3, -40.7, 15.1, "body"], [-19.5, -0.3, -4.7, -21.8, 9, "body"], [19, -0.5, 0.4, -23.4, 9, "body"], [0, -58.2, -17.9, -71.4, 9, "body"], [0.9, -57.5, 22, -71.4, 9, "body"]]
  }
};
