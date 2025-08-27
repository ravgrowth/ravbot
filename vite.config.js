/* eslint-env node */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    historyApiFallback: true,
    ...(mode !== 'production' && {
      proxy: {
        '/api': process.env.VITE_API_PROXY || 'http://localhost:3000'
      }
    })
  }
}))
