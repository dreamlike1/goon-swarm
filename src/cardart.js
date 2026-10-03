/* cardart.js — The cards' pictures (v0.64, user): which cards have one (assets/img/cards/<id>.webp) and how each sits in
   its card: `x`, `y` move it (in % of the card's width), `z` zooms it (1: the card's width). A card left out of `frame`
   sits at the top, full width. Written by the card editor on localhost (Admin → Card editor, src/cardedit.js, saved by
   tools/devserver.py); edit it there, or here by hand. cardface.js reads this. */
'use strict';
const CARD_ART = {
  "pics": ["arcana", "blowpipe", "brickshot", "bullet", "cannon", "cryo", "darkmagus", "dragonkick", "druidity", "enpassant", "explomagus", "fistopheles", "flashbang", "gatling", "geartoss", "grapeshot", "gravamagus", "hammer", "ironwill", "karishnikov", "knife", "laser", "mine", "missiles", "pressurewasher", "punch", "rambo", "shotgun", "shuriken", "slap", "sniper", "soapgun", "sonickick", "spaceimpact", "superwasher", "tball", "tballm", "tempest", "twinflame"],
  "frame": {
    "arcana": {"x": 3.43, "y": 1.39, "z": 1.2},
    "blowpipe": {"x": -12.82, "y": 37.49, "z": 1.65},
    "brickshot": {"x": 5.14, "y": 9.39, "z": 1.21},
    "bullet": {"x": -14.28, "y": 2.57, "z": 1.39},
    "cannon": {"x": -8.03, "y": 17.5, "z": 1.34},
    "cryo": {"x": -16.32, "y": 19.14, "z": 1.61},
    "darkmagus": {"x": 19.24, "y": 42.99, "z": 1.86},
    "dragonkick": {"x": -9.83, "y": 21.18, "z": 1.17},
    "druidity": {"x": -9.77, "y": 13.95, "z": 1.24},
    "enpassant": {"x": 0, "y": 5.7, "z": 1.41},
    "explomagus": {"x": -2.51, "y": 5.7, "z": 1.26},
    "fistopheles": {"x": -6.29, "y": 13.12, "z": 1.4},
    "flashbang": {"x": 0, "y": 5.7, "z": 1.32},
    "gatling": {"x": -11.33, "y": 1.8, "z": 1.29},
    "geartoss": {"x": -3.42, "y": 3.2, "z": 1.32},
    "grapeshot": {"x": 18.5, "y": -5.06, "z": 1.95},
    "gravamagus": {"x": -0.34, "y": -3.69, "z": 1.54},
    "hammer": {"x": 4.64, "y": 11.51, "z": 1.31},
    "ironwill": {"x": 0, "y": 9.75, "z": 1.35},
    "karishnikov": {"x": 6.74, "y": 11.29, "z": 1.34},
    "knife": {"x": 4.72, "y": 36.12, "z": 1.69},
    "laser": {"x": 0.3, "y": 1.77, "z": 1.2},
    "mine": {"x": -0.57, "y": -2.25, "z": 1.31},
    "missiles": {"x": -21.64, "y": 27.86, "z": 1.63},
    "pressurewasher": {"x": 0.51, "y": 12.43, "z": 1.3},
    "punch": {"x": -2.65, "y": 5.7, "z": 1.22},
    "rambo": {"x": 2.26, "y": 6.29, "z": 1.36},
    "shotgun": {"x": -17.94, "y": -2.94, "z": 1.39},
    "shuriken": {"x": -4.57, "y": 21.5, "z": 1.41},
    "slap": {"x": -8.32, "y": 7.91, "z": 1.21},
    "sniper": {"x": -12.09, "y": 11.14, "z": 1.46},
    "soapgun": {"x": -7.75, "y": 9.93, "z": 1.3},
    "sonickick": {"x": -8.65, "y": 8.24, "z": 1.32},
    "spaceimpact": {"x": -1.82, "y": 5.78, "z": 1.25},
    "superwasher": {"x": 4.73, "y": 2.4, "z": 1.34},
    "tempest": {"x": 0, "y": 5.7, "z": 1.3},
    "twinflame": {"x": -2.63, "y": 0.99, "z": 1.07}
  }
};
