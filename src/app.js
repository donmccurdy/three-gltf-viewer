import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { Viewer } from './viewer.js';
import { SimpleDropzone } from 'simple-dropzone';
import { Validator } from './validator.js';
import { Footer } from './components/footer';
import queryString from 'query-string';

window.THREE = THREE;
window.VIEWER = {};

if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
	console.error('The File APIs are not fully supported in this browser.');
} else if (!WebGL.isWebGL2Available()) {
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
		this.viewerEl = null;
		this.spinnerEl = el.querySelector('.spinner');
		this.dropEl = el.querySelector('.dropzone');
		this.inputEl = el.querySelector('#file-input');
		this.validator = new Validator(el);

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
		this.dropEl.innerHTML = '';
		this.dropEl.appendChild(this.viewerEl);
		this.viewer = new Viewer(this.viewerEl, this.options);
		return this.viewer;
	}

	/**
	 * Loads a model directly from a remote URL.
	 * @param {string} modelURL - The URL to the .gltf or .glb file
	 */
	loadFromUrl(modelURL) {
		if (!modelURL.match(/\.(gltf|glb)$/)) {
			this.onError('Provided URL does not point to a .gltf or .glb file.');
			return;
		}


		console.info('button is clicked now it should show');


		this.showSpinner();
		this.view(modelURL, '', new Map());
	}
	
	/**
	 * Loads a fileset provided by user action.
	 * @param  {Map<string, File>} fileMap
	 */
	load(fileMap) {
		let rootFile;
		let rootPath;
		Array.from(fileMap).forEach(([path, file]) => {
			if (file.name.match(/\.(gltf|glb)$/)) {
				rootFile = file;
				rootPath = path.replace(file.name, '');
			}
		});

		if (!rootFile) {
			this.onError('No .gltf or .glb asset found.');
		}

		this.view(rootFile, rootPath, fileMap);
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
				// TODO: GLTFLoader parsing can fail on invalid files. Ideally,
				// we could run the validator either way.
				if (!this.options.kiosk) {
					this.validator.validate(fileURL, rootPath, fileMap, gltf);
				}
				cleanup();
			});
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

document.body.innerHTML += Footer();

function updateProgress(progressText) {
	const text = document.getElementById("progressText");

	if (!text) 
	{
		console.log("Place holder text not found, while setting reconstruction status");
		return;
	}

	if (!progressText || progressText === "null" || progressText === "undefined") {
		progressText = "Waiting...";
	}
	
	text.textContent = `${progressText}`;
	
	console.log(progressText);
}

let pollingInterval = null;

function showProgressDialog() {
	document.getElementById("progressOverlay").style.display = "flex";
}

function hideProgressDialog() {
	document.getElementById("progressOverlay").style.display = "none";
}

async function pollReconstructionStatus(app, code) {
	if (pollingInterval !== null) clearInterval(pollingInterval);

	pollingInterval = setInterval(async () => {
		try {
			const response = await fetch(`/status?code=${encodeURIComponent(code)}`);
			const { status, progress } = await response.json();  

			updateProgress(progress); 

			// OK?
			if (status?.toString() === "OK") {
				clearInterval(pollingInterval);
				pollingInterval = null;
				hideProgressDialog();

				// TODO: remove hardcoding later
				const modelURL = 'https://raw.githubusercontent.com/SPLumirithmic/three-gltf-viewer/main/public/Mesh/FlameDhruv.glb';
				app.loadFromUrl(modelURL);
			}

		} catch (err) {
			console.error("Polling error:", err);
		}
	}, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
	const app = new App(document.body, location);

	window.VIEWER.app = app;

	showProgressDialog();

	// Read ?status=NN from the URL
	const params = new URLSearchParams(window.location.search);
	
	const code = params.get("code");
	let progress = params.get("progress");


	if (!progress || progress === "null" || progress === "undefined") {
		progress = "Waiting...";
	}
	
	pollReconstructionStatus(app, code)

});
