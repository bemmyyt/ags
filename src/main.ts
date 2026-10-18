import RAPIER from '@dimforge/rapier3d-compat';
import './styles.css';
import { Game } from './game/Game';
import { Hud } from './ui/Hud';

async function boot() {
  await RAPIER.init();
  new Game(new Hud(document.querySelector<HTMLElement>('#app')!));
}
boot().catch((error: unknown) => { document.body.innerHTML = `<pre>OPEN ROAD could not start.\n${error instanceof Error ? error.message : String(error)}</pre>`; });
