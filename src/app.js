import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import { Viewer } from './viewer.js';
import { SimpleDropzone } from 'simple-dropzone';
import { Validator } from './validator.js';
import queryString from 'query-string';

window.VIEWER = {};

if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
  console.error('The File APIs are not fully supported in this browser.');
} else if (!WebGL.isWebGLAvailable()) {
  console.error('WebGL is not supported in this browser.');
}

class App {

  /**
   * @param  {Element} el
   * @param  {Location} location
   */
  constructor (el, location) {

    const hash = location.hash ? queryString.parse(location.hash) : {};
    this.options = {
      kiosk: Boolean(hash.kiosk),
      model: hash.model || '',
      preset: hash.preset || '',
      cameraPosition: hash.cameraPosition
        ? hash.cameraPosition.split(',').map(Number)
        : null
    };

    this.el = el;
    this.viewer = null;
    this.viewerEl = null;
    this.files = { fileMap: {}, paths: [], index: 0 };
    this.spinnerEl = el.querySelector('.spinner');
    this.dropEl = el.querySelector('.dropzone');
    this.inputEl = el.querySelector('#file-input');
    // this.validator = new Validator(el);

    this.createDropzone();
    this.hideSpinner();

    const options = this.options;

    if (options.kiosk) {
      const headerEl = document.querySelector('header');
      headerEl.style.display = 'none';
    }

    if (options.model) {
      this.view(options.model, '', new Map());
    }
  }

  /**
   * Sets up the drag-and-drop controller.
   */
  createDropzone () {
    const dropCtrl = new SimpleDropzone(this.dropEl, this.inputEl);
    dropCtrl.on('drop', ({files}) => this.load(files));
    dropCtrl.on('dropstart', () => this.showSpinner());
    dropCtrl.on('droperror', () => this.hideSpinner());
  }

  /**
   * Sets up the view manager.
   * @return {Viewer}
   */
  createViewer () {
    this.viewerEl = document.createElement('div');
    this.viewerEl.classList.add('viewer');
    this.dropEl.innerHTML = '';
    this.dropEl.appendChild(this.viewerEl);
    this.viewer = new Viewer(this.viewerEl, this.options);

    const overlays = [
      {
        className: 'left-overlay',
        clickHandler: () => this.prevModel(),
      },
      {
        className: 'right-overlay',
        clickHandler: () => this.nextModel(),
      },
      {
        className: 'top-overlay',
        clickHandler: () => { window.location.reload()},
      }
    ]

    overlays.forEach((overlay) => {
      const div = document.createElement('div');
      div.classList.add(overlay.className);
      div.addEventListener('click', overlay.clickHandler);
      div.addEventListener('mouseover', () => { div.style.backgroundColor = 'rgba(192, 192, 192, 0.1)'});
      div.addEventListener('mouseout', () => { div.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'});
      this.viewerEl.appendChild(div);
    });

    return this.viewer;
  }

  /**
   * Loads the current model.
   */
  loadCurrentModel() {
    if (this.files.paths.length === 0) {
      this.onError('No .gltf or .glb asset found.');
    }
    let paths = this.files.paths[this.files.index];
    this.view(paths.rootFile, paths.rootPath, this.files.fileMap);
  }

  /**
   * Loads the next model in the fileset.
   */ 
  nextModel() {
    this.files.index++;
    if (this.files.index >= this.files.paths.length) {
      this.files.index = 0;
    }
    this.loadCurrentModel();
  }

  /**
   * Loads the previous model in the fileset.
   */
  prevModel() {
    this.files.index--;
    if (this.files.index < 0) {
      this.files.index = this.files.paths.length - 1;
    }
    this.loadCurrentModel();
  }

  /**
   * Loads a fileset provided by user action.
   * @param  {Map<string, File>} fileMap
   */
  load (fileMap) {
    this.files.fileMap = fileMap;
    Array.from(fileMap).forEach(([path, file]) => {
      if (file.name.match(/\.(gltf|glb)$/)) {
        this.files.paths.push({rootFile: file, rootPath: path.replace(file.name, '')});
      }
    });

    this.loadCurrentModel();
  }

  /**
   * Passes a model to the viewer, given file and resources.
   * @param  {File|string} rootFile
   * @param  {string} rootPath
   * @param  {Map<string, File>} fileMap
   */
  view (rootFile, rootPath, fileMap) {

    if (this.viewer) this.viewer.clear();

    const viewer = this.viewer || this.createViewer();

    const fileURL = typeof rootFile === 'string'
      ? rootFile
      : URL.createObjectURL(rootFile);

    const cleanup = () => {
      this.hideSpinner();
      if (typeof rootFile === 'object') URL.revokeObjectURL(fileURL);
    };

    viewer
      .load(fileURL, rootPath, fileMap)
      .catch((e) => this.onError(e))
      .then((gltf) => {
        // if (!this.options.kiosk) {
        //   this.validator.validate(fileURL, rootPath, fileMap, gltf);
        // }
        cleanup();
        this.viewerEl.requestFullscreen();
      });

      // go to fullscreen with timeout
      setTimeout(() => this.viewerEl.requestFullscreen(), 2000);
      setTimeout(() => this.viewerEl.requestFullscreen(), 10000);
  }

  /**
   * @param  {Error} error
   */
  onError (error) {
    let message = (error||{}).message || error.toString();
    if (message.match(/ProgressEvent/)) {
      message = 'Unable to retrieve this file. Check JS console and browser network tab.';
    } else if (message.match(/Unexpected token/)) {
      message = `Unable to parse file content. Verify that this file is valid. Error: "${message}"`;
    } else if (error && error.target && error.target instanceof Image) {
      message = 'Missing texture: ' + error.target.src.split('/').pop();
    }
    window.alert(message);
    console.error(error);
  }

  showSpinner () {
    this.spinnerEl.style.display = '';
  }

  hideSpinner () {
    this.spinnerEl.style.display = 'none';
  }
}

// document.body.innerHTML += Footer();

document.addEventListener('DOMContentLoaded', () => {

  const app = new App(document.body, location);

  window.VIEWER.app = app;

  // on keypress event f, toggle fullscreen
  document.addEventListener('keypress', (e) => {
    if (e.key === 'f') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        app.viewerEl.requestFullscreen();
      }
    } 
  });

  // on keypress right arrow, load next model and on left arrow, load previous model,
  // up arrow reloads the page
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      app.nextModel();
    } else if (e.key === 'ArrowLeft') {
      app.prevModel();
    } else if (e.key === 'ArrowUp') {
      window.location.reload();
    }
  });

  console.info('[glTF Viewer] Debugging data exported as `window.VIEWER`.');

});
