const Detector = require('./lib/Detector');
const Viewer = require('./Viewer');
const DropController = require('./DropController');
const queryString = require('query-string');
const JSZip = require('jszip');
const FileSaver = require('file-saver');

if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
  console.error('The File APIs are not fully supported in this browser.');
} else if (!Detector.webgl) {
  console.error('WebGL is not supported in this browser.');
}

document.addEventListener('DOMContentLoaded', () => {

  const hash = location.hash ? queryString.parse(location.hash) : {};

  let viewer;
  let viewerEl;

  let files;
  let rootName;

  const spinnerEl = document.querySelector('.spinner');
  spinnerEl.style.display = 'none';

  const downloadBtnEl = document.querySelector('#download-btn');
  downloadBtnEl.addEventListener('click', function () {
    const zip = new JSZip();
    files.forEach((file, path) => {
      zip.file(path, file);
    });
    zip.generateAsync({type: 'blob'}).then((content) => {
      FileSaver.saveAs(content, `${rootName}.zip`);
    });
  });

  const dropEl = document.querySelector('.dropzone');
  const dropCtrl = new DropController(dropEl);
  dropCtrl.on('drop', ({rootFile, rootPath, fileMap}) => view(rootFile, rootPath, fileMap));

  function view (rootFile, rootPath, fileMap) {
    if (!viewer) {
      viewerEl = document.createElement('div');
      viewerEl.classList.add('viewer');
      dropEl.innerHTML = '';
      dropEl.appendChild(viewerEl);
      viewer = new Viewer(viewerEl, {kiosk: !!hash.kiosk});
    } else {
      viewer.clear();
    }

    const fileURL = typeof rootFile === 'string'
      ? rootFile
      : URL.createObjectURL(rootFile);

    const cleanup = () => {
      spinnerEl.style.display = 'none';
      if (typeof rootFile === 'object') {
        URL.revokeObjectURL(fileURL);
      }
    };

    spinnerEl.style.display = '';
    viewer.load(fileURL, rootPath, fileMap)
      .then(cleanup)
      .catch((error) => {
        window.alert(error);
        console.error(error);
        cleanup();
      });

    if (fileMap.size) {
      files = fileMap;
      rootName = rootFile.name.match(/([^\/]+)\.(gltf|glb)$/)[1];
      // downloadBtnEl.style.display = null;
    }
  }

  if (hash.model) {
    view(hash.model, '', new Map());
  }
  if (hash.kiosk) {
    const headerEl = document.querySelector('header');
    headerEl.style.display = 'none';
  }

});
