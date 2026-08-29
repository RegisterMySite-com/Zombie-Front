/**
 * Wall images for Zombie Front 1944
 *
 * Drop PNG / JPG / WEBP / SVG files in:
 *   public/textures/walls/     — tiled onto the four boundary walls
 *   public/textures/posters/   — hung on the inner face of a wall
 *
 * Then point `wallTexture` / `src` at those files below.
 * Missing files fail quietly; the wall stays the fallback color.
 *
 * Walls: "north" (z = -40), "south" (z = +40), "east" (x = +40), "west" (x = -40)
 * Poster `along` is meters along the wall, -32 … +32. `y` is height of the center.
 */

export const WALL_ART = {
  default: {
    wallTexture: "./textures/walls/plaster.svg",
    wallRepeat: [8, 2],
    posters: [
      { src: "./textures/posters/wanted.svg", wall: "north", along: -12, y: 3.2, width: 3.2, height: 4.2 },
      { src: "./textures/posters/orders.svg", wall: "north", along: 10, y: 3.0, width: 4.0, height: 3.2 },
      { src: "./textures/posters/flag.svg", wall: "south", along: 0, y: 3.4, width: 5.0, height: 3.4 },
      { src: "./textures/posters/warning.svg", wall: "east", along: -8, y: 3.1, width: 3.4, height: 3.4 },
      { src: "./textures/posters/photo.svg", wall: "west", along: 6, y: 3.0, width: 3.6, height: 3.6 }
    ]
  },
  1: {
    wallTexture: "./textures/walls/village-brick.svg",
    wallRepeat: [10, 2],
    posters: [
      { src: "./textures/posters/wanted.svg", wall: "north", along: -14, y: 3.2, width: 3.2, height: 4.2 },
      { src: "./textures/posters/orders.svg", wall: "north", along: 8, y: 3.0, width: 4.2, height: 3.2 },
      { src: "./textures/posters/flag.svg", wall: "south", along: -6, y: 3.4, width: 5.2, height: 3.5 },
      { src: "./textures/posters/photo.svg", wall: "south", along: 14, y: 3.0, width: 3.4, height: 3.4 },
      { src: "./textures/posters/warning.svg", wall: "east", along: 0, y: 3.1, width: 3.6, height: 3.6 },
      { src: "./textures/posters/wanted.svg", wall: "west", along: -10, y: 3.2, width: 3.0, height: 4.0 }
    ]
  },
  2: {
    wallTexture: "./textures/walls/sandbag.svg",
    wallRepeat: [12, 2],
    posters: [
      { src: "./textures/posters/orders.svg", wall: "north", along: 0, y: 3.1, width: 4.4, height: 3.2 },
      { src: "./textures/posters/warning.svg", wall: "east", along: -12, y: 3.0, width: 3.2, height: 3.2 },
      { src: "./textures/posters/warning.svg", wall: "west", along: 12, y: 3.0, width: 3.2, height: 3.2 },
      { src: "./textures/posters/flag.svg", wall: "south", along: 0, y: 3.3, width: 5.0, height: 3.2 }
    ]
  },
  3: {
    wallTexture: "./textures/walls/metal.svg",
    wallRepeat: [8, 2],
    posters: [
      { src: "./textures/posters/warning.svg", wall: "north", along: -16, y: 3.2, width: 3.6, height: 3.6 },
      { src: "./textures/posters/warning.svg", wall: "north", along: 16, y: 3.2, width: 3.6, height: 3.6 },
      { src: "./textures/posters/orders.svg", wall: "south", along: 0, y: 3.1, width: 4.6, height: 3.2 },
      { src: "./textures/posters/photo.svg", wall: "east", along: 4, y: 3.0, width: 3.4, height: 3.4 }
    ]
  },
  4: {
    wallTexture: "./textures/walls/stone.svg",
    wallRepeat: [6, 2],
    posters: [
      { src: "./textures/posters/occult.svg", wall: "north", along: 0, y: 3.6, width: 4.4, height: 4.4 },
      { src: "./textures/posters/occult.svg", wall: "south", along: 0, y: 3.6, width: 4.4, height: 4.4 },
      { src: "./textures/posters/wanted.svg", wall: "east", along: -8, y: 3.2, width: 3.2, height: 4.2 },
      { src: "./textures/posters/flag.svg", wall: "west", along: 8, y: 3.3, width: 4.6, height: 3.2 }
    ]
  }
};
