// VISIOON now runs under the Rockstar Managements mark: R-monogram + wordmark.
function renderLogo(mountSelector) {
  const mounts = document.querySelectorAll(mountSelector);
  if (!mounts.length) return;

  const svgMarkup = `
  <svg class="logo-svg" viewBox="0 0 220 210" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(62, 8) scale(2.4)">
      <rect x="2" y="2" width="18" height="18" fill="#141414"/>
      <rect x="20" y="2" width="20" height="20" fill="#141414"/>
      <polygon points="20,22 40,22 40,45" fill="#141414"/>
      <path d="M 20,22 L 20,11 A 11,11 0 0 1 31,22 Z" fill="#FAF9F7"/>
    </g>
    <text x="110" y="172" font-size="34" font-weight="800" fill="#141414" text-anchor="middle" letter-spacing="1" font-family="'Inter', Arial, sans-serif">ROCKSTAR</text>
    <text x="110" y="196" font-size="15" font-weight="600" fill="#141414" text-anchor="middle" letter-spacing="5" font-family="'Inter', Arial, sans-serif">MANAGEMENTS</text>
  </svg>`;

  mounts.forEach(m => { m.innerHTML = svgMarkup; });
}
