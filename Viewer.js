/* global dat */

const THREE = window.THREE = require('three');
const Stats = require('./lib/stats.min.js');
const GLTF2Loader = require('./lib/GLTF2Loader');
const OrbitControls = require('./lib/OrbitControls');
const environments = require('./assets/environment/index');

module.exports = class Viewer {

  constructor (el) {
    this.el = el;

    this.lights = [];
    this.content = null;
    this.mixer = null;
    this.clips = [];
    this.gui = null;

    this.state = {
      environment: environments[0].name,
      playAnimation: true,
      autoRotate: false,
      enableLights: true,
      directColor: 0xffeedd,
      directIntensity: 1,
      ambientColor: 0x222222,
      ambientIntensity: 1
    };

    this.prevTime = 0;

    this.stats = new Stats();
    this.stats.dom.style.position = 'absolute';
    this.el.appendChild( this.stats.dom );

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera( 60, el.clientWidth / el.clientHeight, 0.01, 1000 );

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setClearColor( 0xcccccc );
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( el.clientWidth, el.clientHeight );

    this.controls = new OrbitControls( this.camera, this.renderer.domElement );
    this.controls.autoRotate = this.state.autoRotate;
    this.controls.autoRotateSpeed = -10;

    this.el.appendChild(this.renderer.domElement);

    this.addLights();
    this.addGUI();

    this.animate = this.animate.bind(this);
    requestAnimationFrame( this.animate );
    window.addEventListener('resize', this.resize.bind(this), false);
  }

  animate (time) {

    requestAnimationFrame( this.animate );

    const dt = (time - this.prevTime) / 1000;

    this.controls.update();
    this.stats.update();
    this.mixer && this.mixer.update(dt);
    this.render();

    this.prevTime = time;

  }

  render () {

    this.renderer.render( this.scene, this.camera );

  }

  resize () {

    this.camera.aspect = this.el.clientWidth / this.el.clientHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.el.clientWidth, this.el.clientHeight);

  }

  load ( url, rootPath, assetMap ) {

    const self = this;

    return new Promise(function (resolve, reject) {

      const loader = new GLTF2Loader();
      const blobURLs = [];

      // Hack to intercept relative URLs.
      window.gltfPathTransform = function (url, path) {

        const normalizedURL = rootPath + url.replace(/^(\.?\/)/, '');
        if (assetMap.has(normalizedURL)) {
          const blob = assetMap.get(normalizedURL);
          const blobURL = URL.createObjectURL(blob);
          blobURLs.push(blobURL);
          return blobURL;
        }

        return (path || '') + url;

      };

      loader.load(url, function (gltf) {

        self.setContent(gltf.scene || gltf.scenes[0]);
        self.setClips( gltf.animations || [] );

        blobURLs.forEach(URL.revokeObjectURL);

        resolve();

      }, undefined, reject);

    });

  }

  setContent ( object ) {

    this.clear();

    object.updateMatrixWorld();
    var box = new THREE.Box3().setFromObject(object);
    var center = box.getCenter();

    this.camera.position.copy(center);
    this.camera.position.z -= box.getSize().length();
    this.camera.lookAt(center);

    this.scene.add(object);
    this.content = object;

  }

  setClips ( clips ) {
    this.stopAnimation();

    if (this.mixer) {
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }

    this.clips = clips;
    if (!clips.length) return;

    this.mixer = new THREE.AnimationMixer( this.content );

    if (this.state.playAnimation) this.playAnimation();
  }

  playAnimation () {
    this.clips.forEach((clip) => this.mixer.clipAction(clip).play());
  }

  stopAnimation () {
    if (this.mixer) this.mixer.stopAllAction();
  }

  addLights () {

    const light1 = new THREE.DirectionalLight( this.state.directColor );
    light1.position.set( 0, 0, 1 );
    this.scene.add(light1);

    const light2 = new THREE.DirectionalLight( this.state.directColor );
    light2.position.set( 0, 5, -5 );
    this.scene.add(light2);

    const light3 = new THREE.AmbientLight( this.state.ambientColor );
    this.scene.add( light3 );

    this.lights.push(light1, light2, light3);

  }

  removeLights () {

    this.lights.forEach((light) => this.scene.remove(light));
    this.lights.length = 0;

  }

  setEnvironment (environment) {

    const {path, format} = environment;

    let envMap = null;
    if (path) {
        envMap = new THREE.CubeTextureLoader().load([
          path + 'posx' + format, path + 'negx' + format,
          path + 'posy' + format, path + 'negy' + format,
          path + 'posz' + format, path + 'negz' + format
        ]);
        envMap.format = THREE.RGBFormat;
    }

    this.content.traverse((node) => {
      if (node.material && 'envMap' in node.material) {
        node.material.envMap = envMap;
        node.material.needsUpdate = true;
      }
    });

    this.scene.background = envMap;

  }

  addGUI () {

    const gui = this.gui = new dat.GUI({autoPlace: false, width: 260});

    // Environment map controls.
    const envMapCtrl = gui.add(this.state, 'environment', environments.map((env) => env.name));
    envMapCtrl.onChange((name) => {
      const entry = environments.filter((entry) => entry.name === name)[0];
      this.setEnvironment(entry);
    });

    // Animation controls.
    const animationCtrl = gui.add(this.state, 'playAnimation');
    animationCtrl.onChange((playAnimation) => {
      playAnimation ? this.playAnimation() : this.stopAnimation();
    });

    // Auto-rotate controls.
    const autoRotateCtrl = gui.add(this.state, 'autoRotate');
    autoRotateCtrl.onChange((autoRotate) => {
      this.controls.autoRotate = autoRotate;
    });

    // Lighting controls.
    const lightFolder = gui.addFolder('Lights');
    const lightCtrl = lightFolder.add(this.state, 'enableLights');
    lightCtrl.onChange((enableLights) => {
      enableLights ? this.addLights() : this.removeLights();
    });
    const directColor = lightFolder.addColor(this.state, 'directColor');
    directColor.onChange((hex) => {
      this.lights[0].color.setHex(hex);
      this.lights[1].color.setHex(hex);
    });
    const directIntensity = lightFolder.add(this.state, 'directIntensity', 0, 1);
    directIntensity.onChange((intensity) => {
      this.lights[0].intensity = intensity;
      this.lights[1].intensity = intensity;
    });
    const ambientColor = lightFolder.addColor(this.state, 'ambientColor');
    ambientColor.onChange((hex) => {
      this.lights[2].color.setHex(hex);
    });
    const ambientIntensity = lightFolder.add(this.state, 'ambientIntensity', 0, 1);
    ambientIntensity.onChange((intensity) => {
      this.lights[2].intensity = intensity;
    });

    const guiWrap = document.createElement('div');
    this.el.appendChild( guiWrap );
    guiWrap.classList.add('gui-wrap');
    guiWrap.appendChild(gui.domElement);
    gui.open();

  }

  clear () {

    this.scene.remove( this.content );

  }

};
