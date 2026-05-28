import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  // base: './' używa ścieżek relatywnych — działa na GitHub Pages
  // niezależnie od nazwy repozytorium
  base: './',
})
