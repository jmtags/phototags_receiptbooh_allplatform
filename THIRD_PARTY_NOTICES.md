# Third-party components

UI redesign: Lucide React icons (ISC and MIT notices in public/licenses/Lucide.txt) from https://github.com/lucide-icons/lucide. Manrope variable font (SIL OFL-1.1, public/licenses/Manrope-OFL.txt), self-hosted through @fontsource-variable/manrope; https://github.com/fontsource/fontsource. The font file is bundled locally and precached. Design references and review criteria are recorded in docs/DESIGN.md.

PhotoTags artwork belongs to its existing project/rights holders and is reused as requested. Source files and transformations are recorded in public/asset-provenance.json.

qz-tray JavaScript is by QZ Industries, LLC, LGPL-2.1-only. Source: https://github.com/qzind/tray ; npm: https://www.npmjs.com/package/qz-tray . The installed version is locked in package-lock.json. Its unmodified JS is bundled into the app; a copy of the corresponding readable source and license are included in public/licenses and the build. Source can be replaced through the npm dependency and rebuilt. QZ Tray native software is separately installed; it is not redistributed here. QZ licensing and trusted certificates: https://qz.io/docs/faq .

React/ReactDOM (MIT), Vite (MIT), TypeScript (Apache-2.0), Workbox (MIT), vite-plugin-pwa (MIT). Development tools include Playwright (Apache-2.0) and sharp (Apache-2.0). Refer to each dependency's included license and package-lock.json for the complete transitive dependency set. Keep the corresponding notices when distributing this app.

fflate (MIT), by Arjun Barrett and contributors, packages and opens portable local photo-history ZIP files. Source: https://github.com/101arrowz/fflate . The dependency is locked in package-lock.json and its license is included at public/licenses/fflate-MIT.txt. All processing runs locally.
