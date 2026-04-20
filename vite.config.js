import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Se o seu repositório for "diario-obra", coloque o nome dele entre as barras:
  // Se não tiver certeza, use './' que funciona na maioria dos casos
  base: '/codespaces-react/', 
})
