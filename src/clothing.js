// Appearance only; clothing supply, biology and family rules are separate systems.
export const OUTFITS = Object.freeze({
    male: Object.freeze({ label: 'Male style', description: 'Short tunic and trousers' }),
    female: Object.freeze({ label: 'Female style', description: 'Long tunic, flared skirt and leggings' })
});

export function outfit_style(person) {
    if (typeof person.outfit_style === 'string' && Object.hasOwn(OUTFITS, person.outfit_style)) return person.outfit_style;
    // Stable defaults also work for older saves without consuming simulation RNG.
    const hash = Math.imul(person.id || 1, 0x45d9f3b) >>> 0;
    return (hash >>> 8) & 1 ? 'female' : 'male';
}

export function initialize_clothing(person) {
    if (!person.species) person.outfit_style ??= outfit_style(person);
}

export function valid_clothing(person) {
    return person.outfit_style === undefined || typeof person.outfit_style === 'string'
        && Object.hasOwn(OUTFITS, person.outfit_style);
}

export function draw_clothing(c, person, x, y, color, stride) {
    c.fillStyle = '#3f443c';
    c.fillRect(x - 2, y + 1 + stride, 2, 4);
    c.fillRect(x + 1, y + 1 - stride, 2, 4);
    c.fillStyle = color;
    c.fillRect(x - 3, y - 4, 6, 6);
    if (outfit_style(person) === 'female') {
        c.fillRect(x - 4, y, 8, 3);
        c.fillStyle = '#213129';
        c.fillRect(x - 4, y + 2, 8, 1);
        c.fillRect(x, y + 1, 1, 1);
    }
    c.fillStyle = '#213129';
    c.fillRect(x - 3, y, 6, 1);
}
