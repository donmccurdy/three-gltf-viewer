const Detector = require('./lib/Detector');
const Viewer = require('./Viewer');

if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
  console.error('The File APIs are not fully supported in this browser.');
} else if (!Detector.webgl) {
  console.error('WebGL is not supported in this browser.');
}

let viewer;
let viewerEl;

// Setup the drag-and-drop listeners.
const wrapEl = document.querySelector('.dropzone');
wrapEl.addEventListener('dragover', onDragOver, false);
wrapEl.addEventListener('drop', onDrop, false);

function onDrop(e) {
  e.stopPropagation();
  e.preventDefault();

  const entries = [].slice.call(e.dataTransfer.items)
    .map((item) => item.webkitGetAsEntry());

  loadNextEntry(new Map(), entries);
}

function onDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function loadNextEntry (fileMap, entries) {
  const entry = entries.pop();

  if (!entry) {
    view(fileMap);
    return;
  }

  if (entry.isFile) {
    entry.file((file) => {
      fileMap.set(entry.fullPath, file);
      loadNextEntry(fileMap, entries);
    }, () => console.error('Could not load file: %s', entry.fullPath));
  } else if (entry.isDirectory) {
    entry.createReader().readEntries((directoryEntries) => {
      loadNextEntry(fileMap, entries.concat(directoryEntries));
    });
  } else {
    console.warn('Unknown asset type: ' + entry.fullPath);
    loadNextEntry(fileMap, entries);
  }
}

function view (fileMap) {
  let rootFile;
  let rootPath;
  fileMap.forEach((file, path) => {
    if (file.name.match(/\.(gltf|glb)$/)) {
      rootFile = file;
      rootPath = path.replace(file.name, '');
    }
  });

  if (!rootFile) {
    throw new Error('No .gltf asset found.');
  }

  if (!viewer) {
    viewerEl = document.createElement('div');
    viewerEl.classList.add('viewer');
    wrapEl.innerHTML = '';
    wrapEl.appendChild(viewerEl);
    viewer = new Viewer(viewerEl);
  } else {
    viewer.clear();
  }

  const fileURL = URL.createObjectURL(rootFile);
  viewer.load(fileURL, rootPath, fileMap).then(() => {
    URL.revokeObjectURL(fileURL);
  });
}
