#!/usr/bin/env node
// OA-82: after `vite build` has produced dist/index.html (an empty
// `<div id="root">` app shell), this renders the signed-out landing page
// to static HTML and bakes it into that file, along with public SEO/social
// metadata -- so the root URL is readable by a plain HTTP fetch, crawlers
// and link-preview tools without executing the React app. Run as part of
// `npm run build` (see package.json), never standalone against a stale
// dist/.
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { build } from 'vite'

const SITE_URL = 'https://shiftandsaveapp.web.app/'
const TITLE = 'Shift & Save'
const DESCRIPTION =
  'Shift & Save: see what a dynamic tariff could save you on Octopus Energy, and make it easy to switch.'

const SSR_OUT_DIR = '.prerender-ssr'

async function renderLandingPageHtml() {
  await build({
    configFile: false,
    build: {
      ssr: 'src/entry-server.tsx',
      outDir: SSR_OUT_DIR,
      write: true,
      emitAssets: false,
      ssrEmitAssets: false,
      minify: false,
    },
    logLevel: 'warn',
  })

  const modulePath = `${process.cwd()}/${SSR_OUT_DIR}/entry-server.js`
  const { renderLandingPage } = await import(modulePath)
  return renderLandingPage()
}

function injectMetadata(html) {
  const metaTags = `
    <link rel="canonical" href="${SITE_URL}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:url" content="${SITE_URL}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESCRIPTION}" />`

  return html.replace('</title>', '</title>' + metaTags)
}

function injectLandingHtml(html, landingHtml) {
  return html.replace('<div id="root"></div>', `<div id="root">${landingHtml}</div>`)
}

async function main() {
  const landingHtml = await renderLandingPageHtml()

  const indexPath = 'dist/index.html'
  const original = readFileSync(indexPath, 'utf8')
  const withMetadata = injectMetadata(original)
  const final = injectLandingHtml(withMetadata, landingHtml)
  writeFileSync(indexPath, final)

  rmSync(SSR_OUT_DIR, { recursive: true, force: true })

  console.log('Prerendered landing page into dist/index.html')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
