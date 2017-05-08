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
      enableLights: true,
      autoRotate: false
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

    const light1 = new THREE.DirectionalLight( 0xffeedd );
    light1.position.set( 0, 0, 1 );
    this.scene.add(light1);

    const light2 = new THREE.DirectionalLight( 0xffeedd );
    light2.position.set( 0, 5, -5 );
    this.scene.add(light2);

    const light3 = new THREE.AmbientLight( 0x101030 );
    this.scene.add( light3 );

    this.lights.push(light1, light2, light2);

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

    const gui = this.gui = new dat.GUI({autoPlace: false});

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

    // Lighting controls.
    const lightCtrl = gui.add(this.state, 'enableLights');
    lightCtrl.onChange((enableLights) => {
      enableLights ? this.addLights() : this.removeLights();
    });

    // Auto-rotate controls.
    const autoRotateCtrl = gui.add(this.state, 'autoRotate');
    autoRotateCtrl.onChange((autoRotate) => {
      this.controls.autoRotate = autoRotate;
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
