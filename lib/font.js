const fonts = {
    smallCaps: {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
        'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'Q', 'r': 'ʀ',
        's': 'ꜱ', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
    },
};

const apply = (text, fontName) => {
    const map = fonts[fontName];
    if (!map) return text;
    
    return text.split('').map(char => {
        const lower = char.toLowerCase();
        return map[lower] || map[char] || char;
    }).join('');
};

module.exports = {
    font1: (text) => apply(text, 'smallCaps'),
    smallCaps: (text) => apply(text, 'smallCaps'),
};