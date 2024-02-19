import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import { Viewer } from './viewer.js';
import { SimpleDropzone } from 'simple-dropzone';
import { Validator } from './validator.js';
import { objs } from './objects.js';
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
  constructor(el, location) {
    const hash = location.hash ? queryString.parse(location.hash) : {};
    this.options = {
      kiosk: Boolean(hash.kiosk),
      model: hash.model || '',
      preset: hash.preset || '',
      cameraPosition: hash.cameraPosition ? hash.cameraPosition.split(',').map(Number) : null,
    };

    this.el = el;
    this.viewer = null;
    this.viewer_second = null;
    this.viewerEl = null;
    this.viewerEl_second = null;
    this.files = { fileMap: {}, paths: [], index: 0 };
    this.spinnerEl = el.querySelector('.spinner');
    this.dropEl = el.querySelector('.dropzone');
    this.inputEl = el.querySelector('#file-input');
    // this.validator = new Validator(el);

    this.viewMultiple = false;

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
  createDropzone() {
    const dropCtrl = new SimpleDropzone(this.dropEl, this.inputEl);
    dropCtrl.on('drop', ({ files }) => this.load(files));
    dropCtrl.on('dropstart', () => this.showSpinner());
    dropCtrl.on('droperror', () => this.hideSpinner());
  }

  /**
   * Sets up the view manager.
   * @return {Viewer}
   */
  createViewer() {
    this.viewerEl = document.createElement('div');
    this.viewerEl.classList.add('viewer');

    if (this.viewMultiple) {
      this.viewerEl.style.width = '50%';
    }

    this.dropEl.innerHTML = '';
    this.dropEl.appendChild(this.viewerEl);
    this.viewer = new Viewer(this.viewerEl, this.options);

    const overlays = [
      {
        className: 'top-overlay',
        clickHandler: () => {
          window.location.reload();
        },
      },
      {
        className: 'left-overlay',
        clickHandler: () => this.prevModel(),
      },
      {
        className: 'right-overlay',
        clickHandler: () => this.nextModel(),
      },
    ];

    if (!this.viewMultiple) {
      overlays.forEach((overlay) => {
        const div = document.createElement('div');
        div.classList.add(overlay.className);
        div.addEventListener('click', overlay.clickHandler);
        div.addEventListener('mouseover', () => {
          div.style.backgroundColor = 'rgba(192, 192, 192, 0.1)';
        });
        div.addEventListener('mouseout', () => {
          div.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        });
        this.viewerEl.appendChild(div);
      });
    }

    return this.viewer;
  }

  /**
   * Sets up the view manager.
   * @return {Viewer}
   */
  createSecondViewer() {
    this.viewerEl_second = document.createElement('div');
    this.viewerEl_second.classList.add('viewer_1');
    this.dropEl.appendChild(this.viewerEl_second);
    this.viewer_second = new Viewer(this.viewerEl_second, this.options);

    return this.viewer_second;
  }

  /**
   * Loads the current model.
   */
  loadCurrentModel() {
    if (this.files.paths.length === 0) {
      this.onError('No .gltf or .glb asset found.');
    }
    let paths = this.files.paths[this.files.index];
    if (this.viewMultiple) {
      this.viewMultipleModels(this.files);
    } else {
      this.view(paths.rootFile, paths.rootPath, this.files.fileMap);
    }
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
  load(fileMap) {
    this.files.fileMap = fileMap;
    Array.from(fileMap).forEach(([path, file]) => {
      if (file.name.match(/\.(gltf|glb)$/)) {
        this.files.paths.push({
          rootFile: file,
          rootPath: path.replace(file.name, ''),
        });
      }
    });

    this.loadCurrentModel();
  }

  /**
   * Loads a fileset provided by external source.
   * @param  {Array<{filename: string, link: string}>} objs
   */
  loadExternal(objs) {
    let newObjs = [];
    if (objs.viewMultiple) {
      this.viewMultiple = true;
      newObjs = [...objs.objs];
    } else {
      newObjs = [...objs];
    }
    this.showSpinner();
    this.dropEl.replaceChildren();

    Promise.all(
      objs.map((fileObj) => {
        return fetch(fileObj.link)
          .then((res) => res.blob())
          .then((blob) => {
            return new File([blob], fileObj.filename, { type: '' });
          });
      })
    ).then((fileList) => {
      const fileMap = new Map(fileList.map((file) => [file.name, file]));
      this.load(fileMap);
    });
  }

  /**
   * Passes a model to the viewer, given file and resources.
   * @param  {File|string} rootFile
   * @param  {string} rootPath
   * @param  {Map<string, File>} fileMap
   */
  view(rootFile, rootPath, fileMap) {
    if (this.viewer) this.viewer.clear();

    const viewer = this.viewer || this.createViewer();

    const fileURL = typeof rootFile === 'string' ? rootFile : URL.createObjectURL(rootFile);

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
  }

  async viewMultipleModels(files) {
    const viewer = this.viewer || this.createViewer();
    const fileMap = files.fileMap;
    const paths = files.paths[0];
    let paths_second;
    const fileURL =
      typeof rootFile === 'string' ? paths.rootFile : URL.createObjectURL(paths.rootFile);
    let fileURL_second;

    const gltfPromises = [];
    gltfPromises.push(viewer.load(fileURL, paths.rootPath, fileMap));

    if (files.paths.length == 2) {
      const viewer_second = this.viewer_second || this.createSecondViewer();
      paths_second = files.paths[1];
      fileURL_second =
        typeof rootFile === 'string'
          ? paths_second.rootFile
          : URL.createObjectURL(paths_second.rootFile);
      gltfPromises.push(viewer_second.load(fileURL_second, paths_second.rootPath, fileMap));
    }

    await Promise.all(gltfPromises);
    this.hideSpinner();
    if (typeof paths.rootFile === 'object') URL.revokeObjectURL(fileURL);
    if (typeof paths_second.rootFile === 'object') URL.revokeObjectURL(fileURL_second);
  }

  /**
   * @param  {Error} error
   */
  onError(error) {
    let message = (error || {}).message || error.toString();
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

  showSpinner() {
    this.spinnerEl.style.display = '';
  }

  hideSpinner() {
    this.spinnerEl.style.display = 'none';
  }
}

// document.body.innerHTML += Footer();

document.addEventListener('DOMContentLoaded', () => {
  const app = new App(document.body, location);

  window.VIEWER.app = app;

  // Add event listeners for examples button
  document.querySelector('.examples button').addEventListener('click', () => {
    app.loadExternal(objs);
  });

  // setup page event handlers
  document.addEventListener('keypress', (e) => {
    if (e.key === 'f') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        app.requestFullscreen();
      }
    } else if (e.key === 'o' && !app.viewer) {
      app.inputEl.click();
    } else if (e.key === 'h' && !app.viewer) {
      let details = document.querySelector('.hotkeys').querySelector('details');
      details.open = !details.open;
    } else if (e.key === 'e') {
      app.loadExternal(objs);
    }
  });

  // setup navigation event handlers
  document.addEventListener('keydown', (e) => {
    if (!app.viewer) return;

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
