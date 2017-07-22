const EventEmitter = require('events');

/**
 * Watches an element for file drops, parses to create a filemap hierarchy,
 * and emits the result.
 */
class DropController extends EventEmitter {

  /**
   * @param  {Element} el
   */
  constructor (el) {
    super();
    this.el = el;
    el.addEventListener('dragover', (e) => this.onDragOver(e), false);
    el.addEventListener('drop', (e) => this.onDrop(e), false);
  }

  /**
   * @param  {Event} e
   */
  onDrop (e) {
    e.stopPropagation();
    e.preventDefault();

    let entries;
    if (e.dataTransfer.items) {
      entries = [].slice.call(e.dataTransfer.items)
        .map((item) => item.webkitGetAsEntry());
    } else {
      const errorMsg = 'The required drag-and-drop APIs are not supported in this browser. Please try Chrome, Firefox, Microsoft Edge, or Opera.';
      window.alert(errorMsg);
      throw new Error(errorMsg);
    }

    this.loadNextEntry(new Map(), entries);
  }

  /**
   * @param  {Event} e
   */
  onDragOver (evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  /**
   * @param  {Map<string, File>} fileMap
   * @param  {Array<File>} entries
   */
  loadNextEntry (fileMap, entries) {
    const entry = entries.pop();

    if (!entry) {
      let rootFile;
      let rootPath;
      fileMap.forEach((file, path) => {
        if (file.name.match(/\.(gltf|glb)$/)) {
          rootFile = file;
          rootPath = path.replace(file.name, '');
        }
      });

      if (!rootFile) {
        const msg = 'No .gltf or .glb asset found.';
        window.alert(msg);
        throw new Error(msg);
      }

      this.emitResult(rootFile, rootPath, fileMap);
      return;
    }

    if (entry.isFile) {
      entry.file((file) => {
        fileMap.set(entry.fullPath, file);
        this.loadNextEntry(fileMap, entries);
      }, () => console.error('Could not load file: %s', entry.fullPath));
    } else if (entry.isDirectory) {
      entry.createReader().readEntries((directoryEntries) => {
        this.loadNextEntry(fileMap, entries.concat(directoryEntries));
      });
    } else {
      console.warn('Unknown asset type: ' + entry.fullPath);
      this.loadNextEntry(fileMap, entries);
    }
  }

  /**
   * @param  {File} rootFile
   * @param  {string} rootPath
   * @param  {Map<string, File>} fileMap
   */
  emitResult (rootFile, rootPath, fileMap) {
    this.emit('drop', {
      rootFile: rootFile,
      rootPath: rootPath,
      fileMap: fileMap
    });
  }
}

module.exports = DropController;
