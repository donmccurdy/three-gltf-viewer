const validator = require('gltf-validator');

class Validator {
  validate (rootFile, rootPath, fileMap) {
    const rootFileURL = typeof rootFile === 'string'
      ? rootFile
      : URL.createObjectURL(rootFile);

    return fetch(rootFileURL)
      .then((response) => response.arrayBuffer())
      .then((buffer) => validator.validateBytes(new Uint8Array(buffer)))
      .catch((e) => {
        console.error('[Validator] Validation failed: ' + e);
      });
  }
}

module.exports = Validator;
