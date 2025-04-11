import { defineConfig } from 'vite';
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Employer_Side scripts
        'Employer_Side/js/applicants': './Employer_Side/js/applicants.js',
        'Employer_Side/js/auth': './Employer_Side/js/auth.js',
        'Employer_Side/js/dashboard': './Employer_Side/js/dashboard.js',
        'Employer_Side/js/dateTime': './Employer_Side/js/dateTime.js',
        'Employer_Side/js/inbox': './Employer_Side/js/inbox.js',
        'Employer_Side/js/jobs': './Employer_Side/js/jobs.js',
        'Employer_Side/js/login': './Employer_Side/js/login.js',
        'Employer_Side/js/logout': './Employer_Side/js/logout.js',
        'Employer_Side/js/profile': './Employer_Side/js/profile.js',
        'Employer_Side/js/script': './Employer_Side/js/script.js',
        'Employer_Side/js/utils': './Employer_Side/js/utils.js',
        'Employer_Side/js/chart-pie': './Employer_Side/js/chart-pie.js',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  plugins: [
    obfuscatorPlugin({
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.5,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.3,
      debugProtection: false,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      renameGlobals: false,
      selfDefending: true,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.8,
      transformObjectKeys: true,
      unicodeEscapeSequence: false
    })
  ]
});