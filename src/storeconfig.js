/* storeconfig.js — The store's packs (v0.60, user): which ones show, left to right, what each costs in gold, and (v0.72)
   a discount in % off and a NEW ribbon per pack. Written by the store editor on localhost (src/storeedit.js, saved by
   tools/devserver.py); edit it there, or here by hand. A pack left out of `order` isn't in the store. packs.js reads this. */
'use strict';
const STORE_CONFIG = {
  "order": ["starter", "bigger", "magus", "silica", "tballs"],
  "prices": { "starter": 35, "bigger": 35, "magus": 35, "silica": 35, "tballs": 35 },
  "discounts": {},
  "new": { "tballs": true }
};
