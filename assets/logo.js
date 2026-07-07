// VISIOON mark: a spiky/jagged red "(M)" glyph, plus a "Made by [Rockstar mark]" badge.
function renderLogo(mountSelector) {
  const mounts = document.querySelectorAll(mountSelector);
  if (!mounts.length) return;

  const svgMarkup = `
  <svg class="logo-svg" viewBox="0 0 240 226" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="visioon-spikes" x="-40%" y="-40%" width="180%" height="180%">
        <feTurbulence type="turbulence" baseFrequency="0.28" numOctaves="2" seed="4" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>
    <g filter="url(#visioon-spikes)" stroke="#8D0B0B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M 82,30 C 50,58 40,76 40,100 C 40,124 50,142 82,170"/>
      <path d="M 104,46 L 117,100 L 130,46 L 130,160"/>
      <path d="M 168,30 C 200,58 210,76 210,100 C 210,124 200,142 168,170"/>
    </g>

    <g transform="translate(4, 196)">
      <text x="0" y="16" font-size="20" font-weight="700" fill="#8D0B0B" font-family="'Baloo 2','Fredoka',sans-serif" letter-spacing="1.5">Made by</text>
      <g transform="translate(96, -16) scale(0.65)">
        <rect x="2" y="2" width="18" height="18" fill="#141414"/>
        <rect x="20" y="2" width="20" height="20" fill="#141414"/>
        <polygon points="20,22 40,22 40,45" fill="#141414"/>
        <path d="M 20,22 L 20,11 A 11,11 0 0 1 31,22 Z" fill="#FAF9F7"/>
      </g>
    </g>
  </svg>`;

  mounts.forEach(m => { m.innerHTML = svgMarkup; });
}
