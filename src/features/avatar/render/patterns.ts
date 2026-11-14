import * as THREE from 'three';
import type { Pattern } from '../look/fashion';
import { rng, hashStr } from '../look/rng';

/**
 * Procedural fabric textures drawn on a canvas once and cached.
 * Tileable 256×256; the clothing meshes set repeat to taste.
 */
const cache = new Map<string, THREE.CanvasTexture>();

export function fabric(pattern: Pattern, c1: string, c2: string, c3: string): THREE.CanvasTexture {
  const key = `${pattern}|${c1}|${c2}|${c3}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const r = rng(hashStr(key));
  g.fillStyle = c1;
  g.fillRect(0, 0, S, S);
  switch (pattern) {
    case 'stripes':
      for (let y = 0; y < S; y += 32) {
        g.fillStyle = c2;
        g.fillRect(0, y, S, 12);
        g.fillStyle = c3;
        g.fillRect(0, y + 14, S, 3);
      }
      break;
    case 'pinstripe':
      g.fillStyle = c2;
      for (let x = 0; x < S; x += 16) g.fillRect(x, 0, 1.5, S);
      break;
    case 'plaid':
      g.globalAlpha = 0.55;
      g.fillStyle = c2;
      for (let i = 0; i < S; i += 64) {
        g.fillRect(i, 0, 26, S);
        g.fillRect(0, i, S, 26);
      }
      g.globalAlpha = 0.8;
      g.fillStyle = c3;
      for (let i = 40; i < S; i += 64) {
        g.fillRect(i, 0, 3, S);
        g.fillRect(0, i, S, 3);
      }
      g.globalAlpha = 1;
      break;
    case 'gingham':
      g.globalAlpha = 0.5;
      g.fillStyle = c2;
      for (let i = 0; i < S; i += 32) {
        g.fillRect(i, 0, 16, S);
        g.fillRect(0, i, S, 16);
      }
      g.globalAlpha = 1;
      break;
    case 'checker':
      g.fillStyle = c2;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 32, y * 32, 32, 32);
      break;
    case 'camo':
      for (const c of [c2, c3, '#00000033']) {
        g.fillStyle = c;
        for (let i = 0; i < 16; i++) blob(g, r() * S, r() * S, 18 + r() * 30, r);
      }
      break;
    case 'dots':
      g.fillStyle = c2;
      for (let y = 0; y < S; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < S; x += 32) circle(g, x + 8, y + 8, 5);
      break;
    case 'hearts':
      g.fillStyle = c2;
      for (let y = 0; y < S; y += 42) for (let x = (y / 42) % 2 ? 21 : 0; x < S + 21; x += 42) heart(g, x + 10, y + 12, 9);
      break;
    case 'stars':
      g.fillStyle = c2;
      for (let i = 0; i < 18; i++) star(g, r() * S, r() * S, 6 + r() * 6);
      break;
    case 'tiedye': {
      for (let i = 0; i < 9; i++) {
        const gr = g.createRadialGradient(r() * S, r() * S, 0, r() * S, r() * S, 90 + r() * 60);
        gr.addColorStop(0, i % 2 ? c2 : c3);
        gr.addColorStop(1, 'transparent');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
      }
      break;
    }
    case 'colorblock':
      g.fillStyle = c2;
      g.fillRect(0, S * 0.5, S, S * 0.5);
      g.fillStyle = c3;
      g.fillRect(0, S * 0.46, S, S * 0.06);
      break;
    case 'gradient': {
      const gr = g.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, c1);
      gr.addColorStop(1, c2);
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      break;
    }
    case 'fairisle':
      for (let band = 0; band < 4; band++) {
        const y0 = band * 64;
        g.fillStyle = c2;
        g.fillRect(0, y0 + 8, S, 4);
        g.fillRect(0, y0 + 52, S, 4);
        g.fillStyle = band % 2 ? c3 : c2;
        for (let x = 0; x < S; x += 16) {
          diamond(g, x + 8, y0 + 32, 7);
          g.fillRect(x + 7, y0 + 18, 2, 2);
          g.fillRect(x + 7, y0 + 44, 2, 2);
        }
      }
      break;
    case 'floral':
      for (let i = 0; i < 16; i++) flower(g, r() * S, r() * S, 8 + r() * 8, i % 2 ? c2 : c3);
      break;
    case 'paisley':
      for (let i = 0; i < 12; i++) {
        g.save();
        g.translate(r() * S, r() * S);
        g.rotate(r() * Math.PI * 2);
        g.fillStyle = i % 2 ? c2 : c3;
        g.beginPath();
        g.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = c1;
        circle(g, -3, 0, 4);
        g.restore();
      }
      break;
    case 'leopard':
      for (let i = 0; i < 40; i++) {
        const x = r() * S, y = r() * S, s = 6 + r() * 6;
        g.fillStyle = c2;
        blob(g, x, y, s, r);
        g.fillStyle = c3 || c1;
        blob(g, x, y, s * 0.5, r);
      }
      break;
    case 'zebra':
      g.strokeStyle = c2;
      g.lineWidth = 10;
      for (let i = -S; i < S * 2; i += 36) {
        g.beginPath();
        g.moveTo(i, 0);
        g.bezierCurveTo(i + 30, S * 0.3, i - 30, S * 0.6, i + 10, S);
        g.stroke();
      }
      break;
    case 'chevron':
      g.strokeStyle = c2;
      g.lineWidth = 9;
      for (let y = 0; y < S + 32; y += 32) {
        g.beginPath();
        for (let x = 0; x <= S; x += 32) g.lineTo(x, y + ((x / 32) % 2 ? 14 : 0));
        g.stroke();
      }
      break;
    case 'argyle':
      g.fillStyle = c2;
      for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) diamond(g, x + 32, y + 32, 30);
      g.strokeStyle = c3;
      g.lineWidth = 2;
      for (let i = -S; i < S * 2; i += 64) {
        line(g, i, 0, i + S, S);
        line(g, i + S, 0, i, S);
      }
      break;
    case 'knit':
      g.strokeStyle = 'rgba(0,0,0,.16)';
      g.lineWidth = 2;
      for (let x = 0; x < S; x += 8) for (let y = 0; y < S; y += 10) {
        line(g, x, y, x + 4, y + 8);
        line(g, x + 8, y, x + 4, y + 8);
      }
      break;
    case 'denim':
    case 'denimLight':
    case 'denimDark': {
      const shade = pattern === 'denimLight' ? 0.18 : pattern === 'denimDark' ? -0.25 : 0;
      g.fillStyle = shade > 0 ? 'rgba(255,255,255,.18)' : shade < 0 ? 'rgba(0,0,0,.3)' : 'transparent';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)';
        g.fillRect(r() * S, r() * S, 3, 1);
      }
      g.strokeStyle = 'rgba(255,255,255,.05)';
      for (let i = -S; i < S; i += 4) line(g, i, 0, i + S, S);
      break;
    }
    case 'emblem': {
      // original geometric chest emblem: an orbit + spark
      g.strokeStyle = c2;
      g.lineWidth = 7;
      g.beginPath();
      g.ellipse(S / 2, S / 2, 70, 26, -0.35, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = c3;
      circle(g, S / 2, S / 2, 34);
      g.fillStyle = c2;
      star(g, S / 2 + 58, S / 2 - 52, 16, 4);
      break;
    }
    default:
      break;
  }
  // subtle weave so every fabric reads as cloth
  g.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() > 0.5 ? '#ffffff' : '#000000';
    g.fillRect(r() * S, r() * S, 1, 1);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}
function line(g: CanvasRenderingContext2D, a: number, b: number, c: number, d: number) {
  g.beginPath();
  g.moveTo(a, b);
  g.lineTo(c, d);
  g.stroke();
}
function diamond(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.lineTo(x + s * 0.7, y);
  g.lineTo(x, y + s);
  g.lineTo(x - s * 0.7, y);
  g.closePath();
  g.fill();
}
function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.5, y - s * 1.1, x, y - s * 0.35);
  g.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  g.fill();
}
function star(g: CanvasRenderingContext2D, x: number, y: number, s: number, points = 5) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rr = i % 2 ? s * 0.42 : s;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}
function blob(g: CanvasRenderingContext2D, x: number, y: number, s: number, r: () => number) {
  g.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rr = s * (0.65 + r() * 0.5);
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75);
  }
  g.closePath();
  g.fill();
}
function flower(g: CanvasRenderingContext2D, x: number, y: number, s: number, c: string) {
  g.fillStyle = c;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    circle(g, x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.42);
  }
  g.fillStyle = '#f4e3c8';
  circle(g, x, y, s * 0.3);
}
