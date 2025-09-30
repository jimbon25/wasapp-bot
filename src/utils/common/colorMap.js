/**
 * Map of color names to their hex values
 * @type {Object.<string, string>}
 */
export const colorMap = {
    // Basic colors
    'red': '#FF0000',
    'green': '#00FF00',
    'blue': '#0000FF',
    'yellow': '#FFFF00',
    'purple': '#800080',
    'orange': '#FFA500',
    'pink': '#FFC0CB',
    'brown': '#A52A2A',
    'gray': '#808080',
    'black': '#000000',
    'white': '#FFFFFF',
    
    // Common variations
    'lightblue': '#ADD8E6',
    'darkblue': '#00008B',
    'lightgreen': '#90EE90',
    'darkgreen': '#006400',
    'lightred': '#FF7F7F',
    'darkred': '#8B0000',
    
    // Special values
    'transparent': '#00000000',
    'none': '#00000000'
};

/**
 * Convert a color name to its hex value
 * @param {string} colorName - The name of the color
 * @returns {string} The hex value of the color or the original value if not found
 */
export function getColorHex(colorName) {
    const normalizedColor = colorName.toLowerCase().trim();
    return colorMap[normalizedColor] || colorName;
}

/**
 * Validate if a color name or hex code is valid
 * @param {string} color - The color name or hex code
 * @returns {boolean} True if the color is valid
 */
export function isValidColor(color) {
    const normalizedColor = color.toLowerCase().trim();
    
    if (colorMap[normalizedColor]) {
        return true;
    }
    
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8}|[A-Fa-f0-9]{3})$/;
    return hexPattern.test(normalizedColor);
}

/**
 * Get list of available color names
 * @returns {string[]} Array of available color names
 */
export function getAvailableColors() {
    return Object.keys(colorMap).filter(color => !['none'].includes(color));
}