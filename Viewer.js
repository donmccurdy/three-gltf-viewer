/* global dat */

const THREE = window.THREE = require('three');
const Stats = require('./lib/stats.min.js');
const environments = require('./assets/environment/index');
const createVignetteBackground = require('three-vignette-background');

require('./lib/GLTF2Loader');
require('./lib/OrbitControls');

const DEFAULT_CAMERA = '[default]';

module.exports = class Viewer {

  constructor (el, options) {
    this.el = el;

    this.lights = [];
    this.content = null;
    this.mixer = null;
    this.clips = [];
    this.gui = null;

    this.state = {
      environment: environments[1].name,
      background: false,
      playAnimation: true,
      playbackSpeed: 1.0,
      addLights: true,
      directColor: 0xffeedd,
      directIntensity: 1,
      ambientColor: 0x222222,
      ambientIntensity: 1,
      camera: DEFAULT_CAMERA,
      wireframe: false
    };

    this.prevTime = 0;

    this.stats = new Stats();
    this.stats.dom.height = '48px';
    [].forEach.call(this.stats.dom.children, (child) => (child.style.display = ''));

    this.scene = new THREE.Scene();

    this.defaultCamera = new THREE.PerspectiveCamera( 60, el.clientWidth / el.clientHeight, 0.01, 1000 );
    this.activeCamera = this.defaultCamera;

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setClearColor( 0xcccccc );
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( el.clientWidth, el.clientHeight );

    this.controls = new THREE.OrbitControls( this.defaultCamera, this.renderer.domElement );
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = -10;

    this.background = createVignetteBackground({
      aspect: this.defaultCamera.aspect,
      grainScale: 0.001,
      colors: ['#ffffff', '#353535']
    });

    this.el.appendChild(this.renderer.domElement);

    this.lightCtrl = null;
    this.cameraCtrl = null;
    this.cameraFolder = null;
    this.animFolder = null;
    this.morphFolder = null;
    this.morphCtrls = [];

    this.addGUI();
    if (options.kiosk) this.gui.close();

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

    this.renderer.render( this.scene, this.activeCamera );

  }

  resize () {

    const {clientHeight, clientWidth} = this.el.parentElement;

    this.defaultCamera.aspect = clientWidth / clientHeight;
    this.defaultCamera.updateProjectionMatrix();
    this.background.style({aspect: this.defaultCamera.aspect});
    this.renderer.setSize(clientWidth, clientHeight);

  }

  load ( url, rootPath, assetMap ) {

    return new Promise((resolve, reject) => {

      const loader = new THREE.GLTF2Loader();
      loader.setCrossOrigin('anonymous');
      const blobURLs = [];

      // Hack to intercept relative URLs.
      window.gltfPathTransform = (url, path) => {

        const normalizedURL = rootPath + url.replace(/^(\.?\/)/, '');
        if (assetMap.has(normalizedURL)) {
          const blob = assetMap.get(normalizedURL);
          const blobURL = URL.createObjectURL(blob);
          blobURLs.push(blobURL);
          return blobURL;
        }

        return (path || '') + url;

      };

      loader.load(url, (gltf) => {

        this.setContent(gltf.scene || gltf.scenes[0]);
        this.setClips( gltf.animations || [] );

        blobURLs.forEach(URL.revokeObjectURL);

        resolve();

      }, undefined, reject);

    });

  }

  setContent ( object ) {

    this.clear();

    object.updateMatrixWorld();
    var box = new THREE.Box3().setFromObject(object);
    const size = box.getSize().length();
    var center = box.getCenter();

    this.controls.reset();

    object.position.x += (object.position.x - center.x);
    object.position.y += (object.position.y - center.y);
    object.position.z += (object.position.z - center.z);
    this.controls.maxDistance = size * 10;
    this.defaultCamera.position.copy(center);
    this.defaultCamera.position.x += size / 2.0;
    this.defaultCamera.position.y += size / 5.0;
    this.defaultCamera.position.z += size / 2.0;
    this.defaultCamera.near = size / 100;
    this.defaultCamera.far = size * 100;
    this.defaultCamera.updateProjectionMatrix();
    this.defaultCamera.lookAt(center);

    this.setCamera(DEFAULT_CAMERA);

    this.controls.saveState();

    this.scene.add(object);
    this.content = object;

    this.state.addLights = true;
    this.content.traverse((node) => {
      if (node.isLight) {
        this.state.addLights = false;
      }
    });

    this.updateLights();
    this.updateGUI();
    this.updateEnvironment();
    this.updateDisplay();

  }

  setClips ( clips ) {
    this.stopAnimation();

    if (this.mixer) {
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
      this.animFolder.domElement.style.display = 'none';
    }

    this.clips = clips;
    if (!clips.length) return;

    this.mixer = new THREE.AnimationMixer( this.content );
    this.animFolder.domElement.style.display = '';

    if (this.state.playAnimation) this.playAnimation();
  }

  setCamera ( name ) {
    if (name === DEFAULT_CAMERA) {
      this.controls.enabled = true;
      this.activeCamera = this.defaultCamera;
    } else {
      this.controls.enabled = false;
      this.content.traverse((node) => {
        if (node.isCamera && node.name === name) {
          this.activeCamera = node;
        }
      });
    }
  }

  playAnimation () {
    this.clips.forEach((clip) => this.mixer.clipAction(clip).play());
  }

  stopAnimation () {
    if (this.mixer) this.mixer.stopAllAction();
  }

  updateLights () {
    if (this.state.addLights && !this.lights.length) {
      this.addLights();
    } else if (!this.state.addLights && this.lights.length) {
      this.removeLights();
    }
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

  updateEnvironment () {

    const environment = environments.filter((entry) => entry.name === this.state.environment)[0];
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

    if ((!envMap || !this.state.background) && this.activeCamera === this.defaultCamera) {
      this.scene.add(this.background);
    } else {
      this.scene.remove(this.background);
    }

    this.content.traverse((node) => {
      if (node.material && 'envMap' in node.material) {
        node.material.envMap = envMap;
        node.material.needsUpdate = true;
      }
    });

    this.scene.background = this.state.background ? envMap : null;

  }

  updateDisplay () {
    this.content.traverse((node) => {
      if (node.isMesh) {
        node.material.wireframe = this.state.wireframe;
      }
    });
  }

  addGUI () {

    const gui = this.gui = new dat.GUI({autoPlace: false, width: 260});

    // Display controls.
    const dispFolder = gui.addFolder('Display');
    const envMapCtrl = dispFolder.add(this.state, 'environment', environments.map((env) => env.name));
    envMapCtrl.onChange(() => this.updateEnvironment());
    const envBackgroundCtrl = dispFolder.add(this.state, 'background');
    envBackgroundCtrl.onChange(() => this.updateEnvironment());
    const wireframeCtrl = dispFolder.add(this.state, 'wireframe');
    wireframeCtrl.onChange(() => this.updateDisplay());
    dispFolder.add(this.controls, 'autoRotate');

    // Lighting controls.
    const lightFolder = gui.addFolder('Lights');
    this.lightCtrl = lightFolder.add(this.state, 'addLights').listen();
    this.lightCtrl.onChange(() => this.updateLights());
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

    // Animation controls.
    this.animFolder = gui.addFolder('Animation');
    this.animFolder.domElement.style.display = 'none';
    const animationCtrl = this.animFolder.add(this.state, 'playAnimation');
    animationCtrl.onChange((playAnimation) => {
      playAnimation ? this.playAnimation() : this.stopAnimation();
    });
    const playbackSpeedCtrl = this.animFolder.add(this.state, 'playbackSpeed', 0, 1);
    playbackSpeedCtrl.onChange((speed) => {
      if (this.mixer) this.mixer.timeScale = speed;
    });

    // Morph target controls.
    this.morphFolder = gui.addFolder('Morph Targets');
    this.morphFolder.domElement.style.display = 'none';

    // Camera controls.
    this.cameraFolder = gui.addFolder('Cameras');
    this.cameraFolder.domElement.style.display = 'none';

    // Stats.
    const perfFolder = gui.addFolder('Performance');
    const perfLi = document.createElement('li');
    this.stats.dom.style.position = 'static';
    perfLi.appendChild(this.stats.dom);
    perfLi.classList.add('gui-stats');
    perfFolder.__ul.appendChild( perfLi );

    const guiWrap = document.createElement('div');
    this.el.appendChild( guiWrap );
    guiWrap.classList.add('gui-wrap');
    guiWrap.appendChild(gui.domElement);
    gui.open();

  }

  updateGUI () {
    this.lightCtrl.updateDisplay();

    this.cameraFolder.domElement.style.display = 'none';

    this.morphCtrls.forEach((ctrl) => ctrl.remove());
    this.morphCtrls.length = 0;
    this.morphFolder.domElement.style.display = 'none';

    const cameraNames = [];
    const morphMeshes = [];
    this.content.traverse((node) => {
      if (node.isMesh && node.morphTargetInfluences) {
        morphMeshes.push(node);
      }
      if (node.isCamera) {
        cameraNames.push(node.name);
      }
    });

    if (cameraNames.length) {
      this.cameraFolder.domElement.style.display = '';
      if (this.cameraCtrl) this.cameraCtrl.remove();
      const cameraOptions = [DEFAULT_CAMERA].concat(cameraNames);
      this.cameraCtrl = this.cameraFolder.add(this.state, 'camera', cameraOptions);
      this.cameraCtrl.onChange((name) => this.setCamera(name));
    }

    if (morphMeshes.length) {
      this.morphFolder.domElement.style.display = '';
      morphMeshes.forEach((mesh) => {
        if (mesh.morphTargetInfluences.length) {
          const nameCtrl = this.morphFolder.add({name: mesh.name || 'Untitled'}, 'name');
          this.morphCtrls.push(nameCtrl);
        }
        for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
          const ctrl = this.morphFolder.add(mesh.morphTargetInfluences, i, 0, 1).listen();
          this.morphCtrls.push(ctrl);
        }
      });
    }
  }

  clear () {

    this.scene.remove( this.content );

  }

};
