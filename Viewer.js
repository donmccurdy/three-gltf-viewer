const THREE = window.THREE = require('three');
const Stats = require('./lib/stats.min.js');
THREE.GLTF2Loader = require('./lib/GLTF2Loader');
THREE.OrbitControls = require('./lib/OrbitControls');

module.exports = class Viewer {

  constructor (el) {
    this.el = el;

    this.stats = new Stats();
    this.el.appendChild( this.stats.dom );

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );

    this.camera = new THREE.PerspectiveCamera( 60, el.clientWidth / el.clientHeight, 1, 1000 );
    this.camera.position.z = 500;

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor( this.scene.fog.color );
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( el.clientWidth, el.clientHeight );

    this.controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
    this.controls.addEventListener('change', this.render.bind(this)); // remove when using animation loop

    this.el.appendChild(this.renderer.domElement);

    var geometry = new THREE.CylinderGeometry( 0, 10, 30, 4, 1 );
    var material =  new THREE.MeshPhongMaterial( { color:0xffffff, shading: THREE.FlatShading } );

    this.scene.add( new THREE.Mesh(geometry, material) );

    this.addLights();
    this.render();

    this.animate = this.animate.bind(this);
    window.addEventListener('resize', this.resize.bind(this), false);
  }

  animate () {

    requestAnimationFrame( this.animate );

    this.controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true
    this.stats.update();
    this.render();

  }

  render () {

    this.renderer.render( this.scene, this.camera );

  }

  resize () {

    this.camera.aspect = this.el.clientWidth / this.el.clientHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.el.clientWidth, this.el.clientHeight);

  }

  setAsset (asset) {

  }

  addLights () {

    let light = new THREE.DirectionalLight( 0xffffff );
    light.position.set( 1, 1, 1 );
    this.scene.add( light );

    light = new THREE.DirectionalLight( 0x002288 );
    light.position.set( -1, -1, -1 );
    this.scene.add( light );

    light = new THREE.AmbientLight( 0x222222 );
    this.scene.add( light );

  }

  clear () {

  }

};

      //init();
      //render(); // remove when using next line for animation loop (requestAnimationFrame)



      //animate();

