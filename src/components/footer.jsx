import vhtml from 'vhtml';
import { REVISION } from 'three';

/** @jsx vhtml */

export function Footer() {
	return (
		<footer>
			<a class="item" target="_blank" href="https://threejs.org/">
				three.js r{REVISION}
			</a>

			<span class="separator" aria-hidden="true">
				|
			</span>

			<a
				class="item"
				target="_blank"
				href="https://github.com/donmccurdy/three-gltf-viewer/issues/new"
			>
				help & feedback
			</a>

			<span class="separator" aria-hidden="true">
				|
			</span>

			<a class="item" target="_blank" href="https://github.com/donmccurdy/three-gltf-viewer">
				github
			</a>
		</footer>
	);
}
