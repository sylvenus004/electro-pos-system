import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
// import reactCompilerPreset from ...

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // <-- Add this line here
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
