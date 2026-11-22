import { routeInfo } from "./core.js";
import { runRoute } from "./play.js";
import { wordRoute } from "./words.js";
import { dialRoute } from "./dial.js";

import { bonusRoute } from "./bonus.js";
import { clubRoute } from "./club.js";
import { demoRoute } from "./demos.js";
import { bannerRoute } from "./banners.js";
function openGame() {
  const { name, params } = routeInfo();
  runRoute(name, params);
  wordRoute(name, params);
  dialRoute(name, params);
  bonusRoute(name, params);
  clubRoute(name, params);
  demoRoute(name, params);
  bannerRoute(name);
}
window.addEventListener("arcade:route", openGame);
openGame();
