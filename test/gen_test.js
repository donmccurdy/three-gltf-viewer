import fetch from 'node-fetch';

const VERSION = '2.0';
const CONTENT_URL = `https://api.github.com/repos/KhronosGroup/glTF-Sample-Models/contents/${VERSION}/`;
const RAW_BASE_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/';
const VIEWER_BASE_URL = `http://localhost:3000/#model=${RAW_BASE_URL}${VERSION}/`;

fetch(CONTENT_URL)
  .then((response) => response.json())
  .then((directories) => {
    console.log('Samples:');
    directories.forEach((entry) => {
      const basename = entry.path.split('/').pop();
      const prettyBasename = `${basename}.gltf:`;
      console.log(` - ${prettyBasename} ${VIEWER_BASE_URL}${basename}/glTF/${basename}.gltf`);
    });
    console.log(`\n 🍺  Found ${directories.length} sample models.  \n\n`);
  });
