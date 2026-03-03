/**
 * Shared color utilities for user chart colors
 * Used in ViewActivityPage for chart display and AdminPage for bulk color assignment
 */

export const distinctColors = [
  'hsl(15, 75%, 55%)',   // Orange-red
  'hsl(45, 85%, 50%)',   // Golden yellow
  'hsl(120, 60%, 45%)',  // Green
  'hsl(200, 75%, 50%)',  // Sky blue
  'hsl(280, 60%, 55%)',  // Purple
  'hsl(340, 75%, 55%)',  // Pink
  'hsl(30, 80%, 50%)',   // Orange
  'hsl(180, 60%, 45%)',  // Teal
  'hsl(260, 70%, 60%)',  // Violet
  'hsl(90, 55%, 45%)',   // Lime green
  'hsl(320, 70%, 55%)',  // Magenta
  'hsl(160, 60%, 45%)',  // Sea green
  'hsl(210, 80%, 60%)',  // Light blue
  'hsl(350, 80%, 50%)',  // Red
  'hsl(60, 70%, 50%)',   // Yellow
  'hsl(140, 65%, 45%)',  // Forest green
  'hsl(190, 70%, 50%)',  // Cyan
  'hsl(300, 65%, 55%)',  // Fuchsia
  'hsl(20, 75%, 55%)',   // Coral
  'hsl(240, 60%, 60%)',  // Periwinkle
  'hsl(8, 80%, 58%)',    // Tomato
  'hsl(38, 78%, 52%)',   // Amber
  'hsl(75, 65%, 48%)',   // Chartreuse
  'hsl(105, 70%, 42%)',  // Grass green
  'hsl(135, 55%, 50%)',  // Emerald
  'hsl(165, 65%, 45%)',  // Turquoise
  'hsl(195, 75%, 55%)',  // Azure
  'hsl(220, 70%, 58%)',  // Cornflower
  'hsl(250, 65%, 58%)',  // Slate blue
  'hsl(270, 68%, 60%)',  // Amethyst
  'hsl(290, 72%, 58%)',  // Orchid
  'hsl(310, 75%, 60%)',  // Hot pink
  'hsl(330, 78%, 58%)',  // Rose
  'hsl(355, 85%, 55%)',  // Crimson
  'hsl(25, 82%, 54%)',   // Tangerine
  'hsl(50, 80%, 52%)',   // Gold
  'hsl(68, 75%, 48%)',   // Lime
  'hsl(95, 60%, 45%)',   // Olive green
  'hsl(125, 58%, 48%)',  // Kelly green
  'hsl(150, 62%, 46%)',  // Jade
  'hsl(170, 68%, 48%)',  // Aquamarine
  'hsl(185, 72%, 52%)',  // Caribbean
  'hsl(205, 78%, 58%)',  // Dodger blue
  'hsl(230, 65%, 60%)',  // Royal blue
  'hsl(255, 70%, 62%)',  // Iris
  'hsl(275, 68%, 58%)',  // Lavender
  'hsl(295, 72%, 60%)',  // Violet-pink
  'hsl(315, 76%, 58%)',  // Cerise
  'hsl(335, 80%, 56%)',  // Raspberry
  'hsl(5, 82%, 56%)',    // Scarlet
];

/**
 * Generates a unique color for an index
 * Uses distinctColors array for first 51 indices, then generates using golden ratio
 */
export const generateUniqueColor = (index: number): string => {
  if (index < distinctColors.length) {
    return distinctColors[index];
  }
  const goldenRatio = 0.618033988749895;
  const hue = ((index - distinctColors.length) * goldenRatio * 360) % 360;
  const saturation = 65 + ((index - distinctColors.length) % 5) * 5;
  const lightness = 45 + (((index - distinctColors.length) * 11) % 4) * 5;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Validates if a string is a valid hex color code
 * @param color - The color string to validate
 * @returns true if valid hex color format (#RRGGBB)
 */
export const isValidHexColor = (color: string): boolean => {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
};

/**
 * Converts HSL color string to hex format
 * @param hsl - HSL color string in format "hsl(h, s%, l%)"
 * @returns Hex color string in format "#RRGGBB"
 */
export const hslToHex = (hsl: string): string => {
  // Parse HSL values
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#000000';
  
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};
