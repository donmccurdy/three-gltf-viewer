/* global dat */

const THREE = window.THREE = require('three');
const Stats = require('./lib/stats.min.js');
const GLTF2Loader = require('./lib/GLTF2Loader');
const OrbitControls = require('./lib/OrbitControls');

module.exports = class Viewer {

  constructor (el) {
    this.el = el;

    this.lights = [];
    this.content = null;
    this.mixer = null;
    this.clips = [];
    this.gui = null;

    this.state = {
      playAnimation: true,
      enableLights: true
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

    this.el.appendChild(this.renderer.domElement);

    this.addLights();
    this.addGUI();

    this.animate = this.animate.bind(this);
    requestAnimationFrame( this.animate );
    window.addEventListener('resize', this.resize.bind(this), false);
  }

  animate (time) {

    requestAnimationFrame( this.animate );

    this.controls.update();
    this.stats.update();
    this.mixer && this.mixer.update((time - this.prevTime) / 1000);
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

  load ( url, assetMap ) {

    const self = this;

    return new Promise(function (resolve, reject) {

      const loader = new GLTF2Loader();
      const blobURLs = [];

      loader.setPathTransform(function (url, path) {

        const normalizedURL = '/' + url.replace(/^(\.?\/)/, '');
        if (assetMap.has(normalizedURL)) {
          const blob = assetMap.get(normalizedURL);
          const blobURL = URL.createObjectURL(blob);
          blobURLs.push(blobURL);
          return blobURL;
        }

        return (path || '') + url;

      });

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

    const light1 = new THREE.DirectionalLight( 0xffffff );
    light1.position.set( 1, 1, 1 );
    this.scene.add( light1 );

    const light2 = new THREE.AmbientLight( 0x222222 );
    this.scene.add( light2 );

    this.lights.push( light1, light2 );

    this.updateLights();
    this.controls.addEventListener('change', () => this.updateLights());

  }

  updateLights () {

    this.lights.forEach((light) => light.position.copy( this.camera.position ));

  }

  removeLights () {

    this.lights.forEach((light) => this.scene.remove(light));
    this.lights.length = 0;

  }

  addGUI () {

    const gui = this.gui = new dat.GUI({autoPlace: false});

    const animationCtrl = gui.add(this.state, 'playAnimation');
    animationCtrl.onChange((playAnimation) => {
      playAnimation ? this.playAnimation() : this.stopAnimation();
    });

    const lightCtrl = gui.add(this.state, 'enableLights');
    lightCtrl.onChange((enableLights) => {
      enableLights ? this.addLights() : this.removeLights();
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
