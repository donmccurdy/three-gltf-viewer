import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import glsl from 'vite-plugin-glsl';


export default defineConfig({
  plugins: [glsl()]
});