(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.LastShopperWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const CHUNK_SIZE = 900;
    const ROAD_WIDTH = 160;
    const HUB_X = 1100;
    const HUB_Y = 720;
    const HUB_CLEAR_RADIUS = 650;
    const wallSegmentCache = new WeakMap();
    const districts = ['residential', 'commercial', 'industrial', 'civic', 'park'];
    const templates = [
        { type: 'house', name: 'Ransacked House', width: 250, height: 190, color: '#625448', districts: ['residential', 'park'] },
        { type: 'townhouse', name: 'Boarded Townhouse', width: 270, height: 210, color: '#65544d', districts: ['residential', 'civic'] },
        { type: 'apartment', name: 'Abandoned Apartments', width: 320, height: 235, color: '#55515a', districts: ['residential', 'civic'] },
        { type: 'pharmacy', name: 'Corner Pharmacy', width: 310, height: 210, color: '#455f58', districts: ['commercial', 'civic'] },
        { type: 'warehouse', name: 'Loading Warehouse', width: 330, height: 250, color: '#555b60', districts: ['industrial'] },
        { type: 'garage', name: 'Municipal Garage', width: 315, height: 220, color: '#4f5558', districts: ['industrial', 'civic'] },
        { type: 'diner', name: 'Closed Diner', width: 290, height: 185, color: '#744b3d', districts: ['commercial'] },
        { type: 'hardware', name: 'Hardware Outlet', width: 325, height: 220, color: '#5f5743', districts: ['commercial', 'industrial'] },
        { type: 'clinic', name: 'Emergency Clinic', width: 305, height: 215, color: '#49605f', districts: ['civic'] },
        { type: 'laundromat', name: 'Last Wash', width: 275, height: 185, color: '#4e5967', districts: ['commercial', 'residential'] }
    ];

    function hash(text) {
        let value = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            value ^= text.charCodeAt(i);
            value = Math.imul(value, 16777619);
        }
        return value >>> 0;
    }

    function randomFactory(seed) {
        let state = seed >>> 0;
        return function () {
            state += 0x6D2B79F5;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
    }

    function chunkKey(cx, cy) {
        return `${cx}:${cy}`;
    }

    function boundaryPoint(structure, side, offset) {
        const halfW = structure.width / 2;
        const halfH = structure.height / 2;
        const along = Number(offset) || 0;
        if (side === 'top') return { x: structure.x + along, y: structure.y - halfH };
        if (side === 'left') return { x: structure.x - halfW, y: structure.y + along };
        if (side === 'right') return { x: structure.x + halfW, y: structure.y + along };
        return { x: structure.x + along, y: structure.y + halfH };
    }

    function doorPoint(structure) {
        return boundaryPoint(structure, structure.door.side, structure.door.offset || 0);
    }

    function windowPoints(structure) {
        return (structure.windows || []).map((entry) => ({
            ...entry,
            ...boundaryPoint(structure, entry.side, entry.offset || 0)
        }));
    }

    function entryPoints(structure) {
        return [
            { id: `${structure.id}:door`, kind: 'door', ...structure.door, ...doorPoint(structure) },
            ...windowPoints(structure).map((entry) => ({ ...entry, kind: 'window' }))
        ];
    }

    function pointInside(structure, x, y, padding) {
        const inset = Number(padding) || 0;
        return x > structure.x - structure.width / 2 + inset &&
            x < structure.x + structure.width / 2 - inset &&
            y > structure.y - structure.height / 2 + inset &&
            y < structure.y + structure.height / 2 - inset;
    }

    function openingIsPassable(entry) {
        return entry.kind === 'door'
            ? Boolean(entry.open || entry.destroyed)
            : Boolean(entry.breached);
    }

    function wallStateSignature(structure) {
        const door = structure.door || {};
        const windows = (structure.windows || [])
            .map((entry) => `${entry.id || ''}:${entry.breached ? 1 : 0}`)
            .join('|');
        return `${door.open ? 1 : 0}:${door.destroyed ? 1 : 0}:${windows}`;
    }

    function wallSegments(structure) {
        const signature = wallStateSignature(structure);
        const cached = wallSegmentCache.get(structure);
        if (cached && cached.signature === signature) return cached.segments;
        const thickness = 12;
        const segments = [];
        const entries = entryPoints(structure).filter(openingIsPassable);
        const addSide = (side, length) => {
            const openings = entries
                .filter((entry) => entry.side === side)
                .map((entry) => ({
                    start: Math.max(-length / 2, (entry.offset || 0) - (entry.width || 70) / 2),
                    end: Math.min(length / 2, (entry.offset || 0) + (entry.width || 70) / 2)
                }))
                .sort((a, b) => a.start - b.start);
            let cursor = -length / 2;
            const pieces = [];
            for (const opening of openings) {
                if (opening.start > cursor) pieces.push({ start: cursor, end: opening.start });
                cursor = Math.max(cursor, opening.end);
            }
            if (cursor < length / 2) pieces.push({ start: cursor, end: length / 2 });
            for (const piece of pieces) {
                const pieceLength = piece.end - piece.start;
                if (pieceLength <= 0) continue;
                const offset = (piece.start + piece.end) / 2;
                const point = boundaryPoint(structure, side, offset);
                const horizontal = side === 'top' || side === 'bottom';
                segments.push({
                    x: point.x,
                    y: point.y,
                    width: horizontal ? pieceLength : thickness,
                    height: horizontal ? thickness : pieceLength
                });
            }
        };
        addSide('top', structure.width);
        addSide('bottom', structure.width);
        addSide('left', structure.height);
        addSide('right', structure.height);
        wallSegmentCache.set(structure, { signature, segments });
        return segments;
    }

    function structureNearPoint(structure, x, y, padding) {
        const pad = Number(padding) || 0;
        return Math.abs(x - structure.x) <= structure.width / 2 + pad &&
            Math.abs(y - structure.y) <= structure.height / 2 + pad;
    }

    function structureNearSegment(structure, x1, y1, x2, y2, padding) {
        const pad = Number(padding) || 0;
        const left = structure.x - structure.width / 2 - pad;
        const right = structure.x + structure.width / 2 + pad;
        const top = structure.y - structure.height / 2 - pad;
        const bottom = structure.y + structure.height / 2 + pad;
        return Math.max(x1, x2) >= left && Math.min(x1, x2) <= right &&
            Math.max(y1, y2) >= top && Math.min(y1, y2) <= bottom;
    }

    function segmentIntersectsRect(x1, y1, x2, y2, rect, padding) {
        const pad = Number(padding) || 0;
        const minX = rect.x - rect.width / 2 - pad;
        const maxX = rect.x + rect.width / 2 + pad;
        const minY = rect.y - rect.height / 2 - pad;
        const maxY = rect.y + rect.height / 2 + pad;
        const dx = x2 - x1;
        const dy = y2 - y1;
        let tMin = 0;
        let tMax = 1;
        const clip = (origin, delta, min, max) => {
            if (Math.abs(delta) < 0.000001) return origin >= min && origin <= max;
            let near = (min - origin) / delta;
            let far = (max - origin) / delta;
            if (near > far) [near, far] = [far, near];
            tMin = Math.max(tMin, near);
            tMax = Math.min(tMax, far);
            return tMin <= tMax;
        };
        return clip(x1, dx, minX, maxX) && clip(y1, dy, minY, maxY);
    }

    function segmentHitsStructure(structure, x1, y1, x2, y2, padding) {
        return wallSegments(structure).some((wall) => segmentIntersectsRect(x1, y1, x2, y2, wall, padding));
    }

    function shuffle(list, random) {
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    function chooseDoorSide(x, y, centerX, centerY) {
        const horizontalRoadDistance = Math.abs(y - centerY);
        const verticalRoadDistance = Math.abs(x - centerX);
        if (verticalRoadDistance < horizontalRoadDistance) return x < centerX ? 'right' : 'left';
        return y < centerY ? 'bottom' : 'top';
    }

    function generateChunkScene(seed, cx, cy) {
        const key = chunkKey(cx, cy);
        const random = randomFactory(hash(`${seed}:${key}`));
        const baseX = cx * CHUNK_SIZE;
        const baseY = cy * CHUNK_SIZE;
        const centerX = baseX + CHUNK_SIZE / 2;
        const centerY = baseY + CHUNK_SIZE / 2;
        const district = districts[Math.floor(random() * districts.length)];
        const roads = [
            { orientation: 'horizontal', x: centerX, y: centerY, width: CHUNK_SIZE, height: ROAD_WIDTH },
            { orientation: 'vertical', x: centerX, y: centerY, width: ROAD_WIDTH, height: CHUNK_SIZE }
        ];
        const slots = shuffle([
            { x: baseX + 185, y: baseY + 185 },
            { x: baseX + 715, y: baseY + 185 },
            { x: baseX + 185, y: baseY + 715 },
            { x: baseX + 715, y: baseY + 715 }
        ], random);
        const structures = [];
        const decorations = [];
        const parkSlots = district === 'park' ? 2 : random() < 0.18 ? 1 : 0;
        for (let i = 0; i < parkSlots; i += 1) {
            const slot = slots.shift();
            decorations.push({ type: 'park', x: slot.x, y: slot.y, width: 330, height: 285 });
            for (let tree = 0; tree < 7; tree += 1) {
                decorations.push({
                    type: 'tree',
                    x: slot.x - 130 + random() * 260,
                    y: slot.y - 105 + random() * 210,
                    size: 10 + random() * 6
                });
            }
            decorations.push({ type: 'bench', x: slot.x, y: slot.y + 70, rotation: random() < 0.5 ? 0 : Math.PI / 2 });
        }

        const pool = templates.filter((template) => template.districts.includes(district));
        const count = Math.min(slots.length, district === 'park' ? 2 : 2 + Math.floor(random() * 3));
        for (let i = 0; i < count; i += 1) {
            const slot = slots[i];
            const template = pool[Math.floor(random() * pool.length)] || templates[Math.floor(random() * templates.length)];
            const x = Math.round(slot.x + (random() - 0.5) * 20);
            const y = Math.round(slot.y + (random() - 0.5) * 20);
            if (Math.hypot(x - HUB_X, y - HUB_Y) < HUB_CLEAR_RADIUS) continue;
            const side = chooseDoorSide(x, y, centerX, centerY);
            const availableWindowSides = shuffle(['top', 'right', 'bottom', 'left'].filter((entry) => entry !== side), random);
            const id = `structure-${key}-${i}`;
            const windows = availableWindowSides.slice(0, 2).map((windowSide, windowIndex) => {
                const sideLength = windowSide === 'top' || windowSide === 'bottom' ? template.width : template.height;
                const maxOffset = Math.max(0, sideLength / 2 - 62);
                return {
                    id: `${id}:window:${windowIndex}`,
                    side: windowSide,
                    offset: Math.round((random() - 0.5) * maxOffset * 1.25),
                    width: 78,
                    health: 60,
                    maxHealth: 60,
                    breached: false
                };
            });
            const structure = {
                id,
                chunkKey: key,
                district,
                type: template.type,
                name: template.name,
                color: template.color,
                x,
                y,
                width: template.width,
                height: template.height,
                door: {
                    id: `${id}:door`,
                    side,
                    offset: 0,
                    width: 118,
                    open: false,
                    destroyed: false,
                    health: 160,
                    maxHealth: 160
                },
                windows,
                loot: { id: `${id}-loot`, claimed: false, x: 0, y: 0 }
            };
            const door = doorPoint(structure);
            structure.loot.x = Math.round(structure.x + (structure.x - door.x) * 0.38);
            structure.loot.y = Math.round(structure.y + (structure.y - door.y) * 0.38);
            structures.push(structure);
        }

        decorations.push({ type: 'manhole', x: centerX - 44, y: centerY + 38, size: 15 });
        decorations.push({ type: 'sewer', x: centerX + 55, y: centerY - 48, size: 22 });
        decorations.push({ type: 'streetlight', x: centerX - ROAD_WIDTH / 2 - 24, y: centerY - ROAD_WIDTH / 2 - 24 });
        if (random() < 0.7) {
            decorations.push({
                type: 'car',
                x: centerX + (random() - 0.5) * 44,
                y: baseY + 190 + random() * 170,
                rotation: Math.PI / 2,
                color: random() < 0.5 ? '#7c2d12' : '#334155'
            });
        }
        if (district === 'industrial') {
            decorations.push({ type: 'crates', x: baseX + 90, y: baseY + 90 });
            decorations.push({ type: 'crates', x: baseX + 810, y: baseY + 800 });
        }
        return { key, cx, cy, district, roads, decorations, structures };
    }

    function generateChunk(seed, cx, cy) {
        return generateChunkScene(seed, cx, cy).structures;
    }

    return {
        CHUNK_SIZE,
        ROAD_WIDTH,
        chunkKey,
        boundaryPoint,
        doorPoint,
        windowPoints,
        entryPoints,
        pointInside,
        openingIsPassable,
        wallSegments,
        structureNearPoint,
        structureNearSegment,
        segmentIntersectsRect,
        segmentHitsStructure,
        generateChunkScene,
        generateChunk
    };
});
