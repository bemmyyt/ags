export class Input {
  private readonly pressed = new Set<string>();
  private readonly once = new Set<string>();

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.once.add(event.code);
      this.pressed.add(event.code);
    });
    target.addEventListener('keyup', (event) => this.pressed.delete(event.code));
    target.addEventListener('blur', () => this.pressed.clear());
  }

  down(...keys: string[]) { return keys.some((key) => this.pressed.has(key)); }
  take(key: string) {
    const value = this.once.has(key);
    this.once.delete(key);
    return value;
  }
}
