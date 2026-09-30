// The modular shell uses the same semantic catalog as mission and dialog copy.
export function createShellText(language) {
  return (key, params = {}) => language.t(key, params);
}
