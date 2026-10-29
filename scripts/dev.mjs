// Starts the menu API (port 8787) and Vite (port 5173) together. Works on Windows, macOS and Linux.
import { spawn } from 'node:child_process'
const run = (args) => spawn(process.execPath, args, { stdio: 'inherit' })
const procs = [run(['server/index.js']), run(['node_modules/vite/bin/vite.js', '--host'])]
const stop = () => procs.forEach((p) => p.kill())
process.on('SIGINT', () => { stop(); process.exit(0) })
procs.forEach((p) => p.on('exit', stop))
