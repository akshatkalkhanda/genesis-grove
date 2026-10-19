// Original canvas artwork. Coordinates use the world's six-pixel tiles.
export function draw_tree(c, x, y, biome, variation) {
    const pine = biome === 'snow' || biome === 'forest' && variation < 0.35;
    const height = 13 + Math.floor(variation * 6);
    const palette = {
        forest: ['#274e36', '#3e7845', '#76a456'],
        jungle: ['#1e513a', '#2a8b54', '#7ac66c'],
        maple: ['#8b3f40', variation > 0.5 ? '#dc7152' : '#d9a14d', '#f3bd6d'],
        celestial: ['#665080', '#b29aca', '#ead7ef'],
        savanna: ['#566241', '#81974b', '#b6b96a'],
        snow: ['#365956', '#668f84', '#e6f3e3']
    }[biome] || ['#6b4780', '#b380c4', '#e8b9e9'];
    c.fillStyle = '#1e34274a'; c.beginPath(); c.ellipse(x + 3, y + 1, 7, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#513e30'; c.fillRect(x - 1, y - height + 5, 3, height - 4);
    c.fillStyle = '#a48355'; c.fillRect(x - 1, y - height + 6, 1, height - 5);
    if (pine) {
        for (let tier = 0; tier < 3; tier++) {
            const width = 4 + tier * 2, top = y - height - 4 + tier * 4;
            c.fillStyle = palette[0]; c.beginPath(); c.moveTo(x, top); c.lineTo(x - width, top + 9); c.lineTo(x + width, top + 9); c.fill();
            c.fillStyle = palette[1]; c.beginPath(); c.moveTo(x, top); c.lineTo(x - width, top + 8); c.lineTo(x + 1, top + 6); c.fill();
            c.fillStyle = palette[2]; c.fillRect(x - 1, top + 2, 2, 2);
            if (biome === 'snow') c.fillRect(x - width + 2, top + 7, width - 1, 2);
        }
    } else if (biome === 'mushroom') {
        c.fillStyle = '#d4b9c9'; c.fillRect(x - 1, y - 9, 3, 9);
        c.fillStyle = palette[0]; c.fillRect(x - 7, y - 12, 15, 4);
        c.fillStyle = palette[1]; c.fillRect(x - 6, y - 16, 13, 5); c.fillRect(x - 3, y - 18, 7, 3);
        c.fillStyle = palette[2]; c.fillRect(x - 3, y - 15, 2, 2); c.fillRect(x + 3, y - 12, 2, 2);
    } else {
        const flat = biome === 'savanna', width = flat ? 10 : 7;
        c.fillStyle = '#6a5139'; c.fillRect(x - 4, y - 9, 5, 2); c.fillRect(x + 1, y - 12, 4, 2);
        const crown = y - height + (flat ? 2 : 0);
        c.fillStyle = palette[0]; c.fillRect(x - width, crown, width * 2 + 1, flat ? 5 : 9);
        c.fillRect(x - width + 2, crown - 3, width * 2 - 3, flat ? 4 : 11);
        c.fillStyle = palette[1]; c.fillRect(x - width, crown - 1, width + 5, flat ? 4 : 7);
        c.fillRect(x - width + 2, crown - 5, width + 5, flat ? 4 : 8);
        c.fillStyle = palette[2]; c.fillRect(x - width + 3, crown - 5, 4, 2);
        c.fillRect(x - width, crown, 3, 2); c.fillRect(x + 2, crown - 3, 2, 2);
        if (biome === 'forest' && variation > 0.75) {
            c.fillStyle = '#d4cdb2'; c.fillRect(x - 1, y - 9, 2, 10);
            c.fillStyle = '#4e5340'; c.fillRect(x, y - 7, 1, 1); c.fillRect(x - 1, y - 3, 1, 1);
        }
    }
}

export function draw_weapon(c, x, y, level, face, metal, attacking) {
    c.save(); c.translate(x, y); c.scale(face, 1);
    c.fillStyle = '#674a31';
    if (level >= 9) {
        c.fillStyle = '#445869'; c.fillRect(5, -13, 2, 17);
        c.fillStyle = metal; c.fillRect(4, -17, 4, 5);
        c.fillRect(5, -21, 2, 5); c.fillRect(2, -15, 8, 2);
        c.fillStyle = '#f6fff2'; c.fillRect(5, -17, 2, 3);
        if (level >= 11) { c.fillStyle = metal; c.fillRect(1, -20, 2, 6); c.fillRect(9, -20, 2, 6); }
        if (level >= 12) { c.fillStyle = '#ead68c'; c.fillRect(3, -23, 6, 2); }
        if (attacking) { c.fillStyle = '#f2ffff'; c.fillRect(3, -22, 6, 3); }
    } else if (level >= 6) {
        c.fillRect(2, -4, 5, 3);
        c.fillStyle = metal; c.fillRect(6, -5, level >= 7 ? 9 : 11, 2);
        c.fillStyle = '#273c3c'; c.fillRect(9, -4, 2, 3);
        c.fillStyle = '#d1c5a0'; c.fillRect(5, -3, 2, 2);
        if (attacking) { c.fillStyle = '#ffe89e'; c.fillRect(level >= 7 ? 15 : 17, -6, 4, 3); }
    } else if (level === 5) {
        c.fillRect(3, -4, 10, 2); c.fillRect(6, -3, 2, 3);
        c.fillStyle = metal; c.fillRect(10, -8, 2, 10);
        c.fillStyle = '#e3d6a9'; c.fillRect(4, -6, 7, 1);
    } else if (level === 1) {
        c.fillRect(6, -13, 2, 17);
        c.fillStyle = metal; c.beginPath(); c.moveTo(7, -18); c.lineTo(4, -12); c.lineTo(9, -12); c.fill();
    } else if (level === 0) {
        c.fillRect(5, -7, 2, 11); c.fillStyle = metal; c.fillRect(3, -11, 6, 6);
        c.fillStyle = '#d1be9b'; c.fillRect(3, -11, 3, 1);
    } else {
        c.fillRect(5, -4, 2, 8); c.fillStyle = metal;
        c.fillRect(5, -16, 2, 12); c.fillRect(3, -5, 6, 2);
        c.fillStyle = '#f0f3db'; c.fillRect(5, -16, 1, 10);
    }
    c.restore();
}

export function draw_vehicle(c, vehicle, color, now) {
    c.save(); c.translate(vehicle.x * 6, vehicle.y * 6);
    if (vehicle.dx < 0) c.scale(-1, 1);
    c.fillStyle = '#162b265c'; c.fillRect(-8, 4, 19, 3);
    if (vehicle.kind === 'hover' || vehicle.kind === 'starbarge') {
        const lift = Math.sin(now / 260 + vehicle.id);
        c.translate(0, -3 + lift);
        c.fillStyle = '#465774'; c.fillRect(-12, -4, 25, 7); c.fillRect(-9, -7, 19, 11);
        c.fillStyle = color; c.fillRect(-10, -4, 21, 3);
        c.fillStyle = '#c4e9f0'; c.fillRect(2, -7, 7, 4);
        c.fillStyle = vehicle.kind === 'starbarge' ? '#dab0f6' : '#9fe7f5';
        c.fillRect(-9, 4, 5, 2); c.fillRect(5, 4, 5, 2);
        c.fillRect(-15, -3, 3, 4);
        if (vehicle.cargo) { c.fillStyle = '#f0d78e'; c.fillRect(-7, -8, 7, 4); }
        c.restore(); return;
    }
    const powered = vehicle.kind !== 'cart';
    c.fillStyle = powered ? '#495c60' : '#83603c'; c.fillRect(-8, -3, 15, 7);
    c.fillStyle = color; c.fillRect(-7, -2, 10, 4);
    c.fillStyle = '#353a32'; c.fillRect(-6, 3, 4, 4); c.fillRect(5, 3, 4, 4);
    c.fillStyle = '#b5b09b'; c.fillRect(-5, 4, 2, 2); c.fillRect(6, 4, 2, 2);
    if (vehicle.cargo) { c.fillStyle = '#e1bd5d'; c.fillRect(-6, -6, 8, 4); c.fillStyle = '#b68c44'; c.fillRect(-3, -6, 1, 4); }
    if (powered) {
        c.fillStyle = color; c.fillRect(3, -8, 7, 11);
        c.fillStyle = '#b9e4e0'; c.fillRect(5, -7, 4, 4);
        c.fillStyle = '#e8d58d'; c.fillRect(9, 0, 2, 2);
        if (vehicle.kind === 'wagon') {
            c.fillStyle = '#404842'; c.fillRect(7, -12, 2, 5);
            c.fillStyle = '#c7cec364'; c.fillRect(7 - Math.floor(now / 160) % 5, -17, 4, 4);
        }
    } else {
        c.fillStyle = '#896844'; c.fillRect(7, 0, 9, 1);
        c.fillStyle = '#aa8a61'; c.fillRect(13, -2, 7, 5); c.fillRect(18, -5, 3, 5);
        c.fillStyle = '#554936'; c.fillRect(14, 2, 1, 4); c.fillRect(18, 2, 1, 4);
    }
    c.restore();
}

export function draw_landmark(c, building, color, now) {
    const x = building.x * 6, y = building.y * 6;
    if (['observatory', 'astral_forge', 'stargate', 'condenser'].includes(building.type)) {
        const glow = building.type === 'condenser' ? '#e7b1f5' : building.type === 'stargate' ? '#aaf0bc' : '#a9dbf4';
        c.fillStyle = '#34495c'; c.fillRect(x - 13, y, 27, 5);
        c.fillStyle = '#6b8292'; c.fillRect(x - 10, y - 5, 21, 6);
        if (building.type === 'observatory') {
            c.fillStyle = '#a5bcc5'; c.beginPath(); c.arc(x, y - 6, 12, Math.PI, 0); c.fill();
            c.fillStyle = '#405772'; c.fillRect(x - 2, y - 18, 4, 13);
            c.save(); c.translate(x, y - 11); c.rotate(-0.6);
            c.fillStyle = '#c5d9dc'; c.fillRect(-2, -2, 19, 5); c.fillStyle = '#9bdbe8'; c.fillRect(15, -3, 3, 7); c.restore();
        } else if (building.type === 'stargate') {
            c.strokeStyle = '#809aa5'; c.lineWidth = 5;
            c.beginPath(); c.ellipse(x, y - 19, 11, 17, 0, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = glow; c.lineWidth = 2; c.stroke();
            c.fillStyle = '#b8f1ce55'; c.beginPath(); c.ellipse(x, y - 19, 8, 14, 0, 0, Math.PI * 2); c.fill();
        } else {
            c.fillStyle = '#506477'; c.fillRect(x - 8, y - 19, 17, 16);
            c.fillStyle = glow; c.fillRect(x - 6, y - 16, 13, 10);
            c.fillStyle = '#f4f7df'; c.fillRect(x - 2, y - 14, 5, 6);
            c.fillStyle = '#8dacc0'; c.fillRect(x - 10, y - 24, 3, 19); c.fillRect(x + 8, y - 24, 3, 19);
        }
        c.fillStyle = color; c.fillRect(x - 11, y + 2, 23, 2);
        for (let star = 0; star < 4; star++) {
            const a = now / 1600 + star * Math.PI / 2;
            c.fillStyle = glow; c.fillRect(x + Math.cos(a) * 17 - 1, y - 17 + Math.sin(a) * 10, 2, 2);
        }
    } else if (building.type === 'monument') {
        c.fillStyle = '#394c4566'; c.fillRect(x - 10, y + 4, 23, 4);
        c.fillStyle = '#9caa9d'; c.fillRect(x - 10, y, 21, 4); c.fillRect(x - 7, y - 4, 15, 4);
        c.fillStyle = '#dbd9b6'; c.fillRect(x - 4, y - 11, 9, 7);
        c.fillStyle = '#668f80'; c.fillRect(x - 3, y - 25, 7, 14); c.fillRect(x - 6, y - 22, 13, 3);
        c.fillStyle = '#b8d6b3'; c.fillRect(x - 2, y - 30, 5, 5);
        c.fillStyle = color; c.fillRect(x - 2, y - 20, 3, 9);
        c.fillStyle = '#e5cb7c'; c.fillRect(x + 6, y - 28, 2, 9); c.fillRect(x + 5, y - 30, 4, 3);
    } else if (building.type === 'university') {
        c.fillStyle = '#d1c8ad'; c.fillRect(x - 13, y - 14, 27, 17);
        c.fillStyle = '#746986'; c.beginPath(); c.moveTo(x - 16, y - 14); c.lineTo(x, y - 24); c.lineTo(x + 16, y - 14); c.fill();
        c.fillStyle = '#f4e4bf'; for (let col = -10; col <= 10; col += 5) c.fillRect(x + col, y - 12, 2, 14);
        c.fillStyle = '#4a5f66'; c.fillRect(x - 3, y - 9, 6, 12);
        c.fillStyle = color; c.fillRect(x - 7, y - 16, 14, 2);
    } else {
        const factory = building.type === 'factory';
        c.fillStyle = '#a58a70'; c.fillRect(x - 12, y - 12, 25, 16);
        c.fillStyle = '#526d77'; c.fillRect(x - 14, y - 16, 29, 5);
        c.fillStyle = '#b5d9d5'; for (let col = -9; col < 9; col += 6) c.fillRect(x + col, y - 10, 4, 5);
        c.fillStyle = color; c.fillRect(x - 10, y, 21, 2);
        c.fillStyle = '#453e36'; c.fillRect(x - 3, y - 3, 6, 7);
        if (factory) {
            c.fillStyle = '#796b5b'; c.fillRect(x + 6, y - 29, 5, 16); c.fillRect(x + 4, y - 30, 9, 3);
            const rise = (now / 140) % 12;
            c.fillStyle = '#b7b9a16b'; c.fillRect(x + 5 - rise / 3, y - 33 - rise, 7, 5);
        } else {
            c.fillStyle = '#e6c47a'; c.fillRect(x + 6, y - 8, 5, 4);
            c.fillStyle = '#7d654c'; c.fillRect(x - 7, y + 4, 16, 2);
        }
    }
}
