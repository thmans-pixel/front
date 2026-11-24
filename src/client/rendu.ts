// Rendu WebGL2 de la carte, en dalles de 2048 × 2048 tuiles (spec 002 § 3 et 7.3).
// Deux textures par dalle : terrain (R8UI) et propriétaire (R16UI). Le dessin lit
// les identifiants dans le shader ; seules les parties modifiées sont renvoyées
// à la carte graphique.

const DALLE = 2048;

export interface Camera {
  /** Tuile au centre de l'écran. */
  x: number;
  y: number;
  /** Pixels CSS par tuile. */
  zoom: number;
}

export type Vue = 'pays' | 'terrain';

const VERT = `#version 300 es
in vec2 aCoin;
uniform vec2 uOrigine;
uniform vec2 uTaille;
uniform vec2 uCam;
uniform float uZoom;
uniform vec2 uEcran;
out vec2 vLocal;
void main() {
  vec2 local = aCoin * uTaille;
  vLocal = local;
  vec2 px = ((uOrigine + local) - uCam) * uZoom;
  vec2 ndc = vec2(px.x / (uEcran.x * 0.5), -px.y / (uEcran.y * 0.5));
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
in vec2 vLocal;
out vec4 sortie;
uniform usampler2D uProprio;
uniform usampler2D uTerrain;
uniform sampler2D uPalette;
uniform vec2 uTaille;
uniform float uZoom;
uniform int uVue;
uniform uint uMoi;

float hachage(ivec2 c) {
  uint h = uint(c.x) * 374761393u + uint(c.y) * 668265263u;
  h = (h ^ (h >> 13)) * 1274126177u;
  return float((h ^ (h >> 16)) & 255u) / 255.0;
}

vec3 couleurTerrain(uint t) {
  uint type = t & 7u;
  if ((t & 128u) == 0u) return vec3(0.09, 0.24, 0.44);
  if (type == 1u) return vec3(0.42, 0.64, 0.33);
  if (type == 2u) return vec3(0.60, 0.57, 0.34);
  if (type == 3u) return vec3(0.56, 0.54, 0.53);
  return vec3(0.86, 0.91, 0.96);
}

uint proprioVoisin(ivec2 c, ivec2 d, uint defaut) {
  ivec2 n = c + d;
  if (n.x < 0 || n.y < 0 || n.x >= int(uTaille.x) || n.y >= int(uTaille.y)) return defaut;
  return texelFetch(uProprio, n, 0).r;
}

void main() {
  ivec2 c = ivec2(floor(vLocal));
  c = clamp(c, ivec2(0), ivec2(uTaille) - 1);
  uint t = texelFetch(uTerrain, c, 0).r;
  uint o = texelFetch(uProprio, c, 0).r;
  vec3 col = couleurTerrain(t) * (0.94 + 0.12 * hachage(c));
  if (uVue == 0 && o != 0u) {
    vec3 pal = texelFetch(uPalette, ivec2(int(o & 255u), int(o >> 8)), 0).rgb;
    col = mix(col, pal, 0.82);
    vec2 f = fract(vLocal);
    float e = min(1.6 / uZoom, 0.5);
    bool bord = (f.x < e && proprioVoisin(c, ivec2(-1, 0), o) != o)
             || (f.x > 1.0 - e && proprioVoisin(c, ivec2(1, 0), o) != o)
             || (f.y < e && proprioVoisin(c, ivec2(0, -1), o) != o)
             || (f.y > 1.0 - e && proprioVoisin(c, ivec2(0, 1), o) != o);
    if (bord) col = (o == uMoi) ? vec3(1.0) : pal * 0.55;
  }
  sortie = vec4(col, 1.0);
}`;

interface Dalle {
  x0: number;
  y0: number;
  w: number;
  h: number;
  proprio: WebGLTexture;
  terrain: WebGLTexture;
  sale: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class Rendu {
  readonly largeur: number;
  readonly hauteur: number;
  readonly proprio: Uint16Array;
  readonly terrain: Uint8Array;
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  vue: Vue = 'pays';
  moi = 1;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private dalles: Dalle[] = [];
  private nx: number;
  private ny: number;
  private palette: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private dpr = 1;
  private cssL = 1;
  private cssH = 1;

  constructor(private canvas: HTMLCanvasElement, largeur: number, hauteur: number, terrain: Uint8Array) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error("WebGL2 n'est pas disponible sur cet appareil ou ce navigateur.");
    this.gl = gl;
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.terrain = terrain;
    this.proprio = new Uint16Array(largeur * hauteur);
    this.prog = this.compiler();
    for (const n of ['uOrigine', 'uTaille', 'uCam', 'uZoom', 'uEcran', 'uProprio', 'uTerrain', 'uPalette', 'uVue', 'uMoi']) {
      this.loc[n] = gl.getUniformLocation(this.prog, n);
    }
    // Un quad unité partagé par toutes les dalles.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(this.prog, 'aCoin');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

    this.nx = Math.ceil(largeur / DALLE);
    this.ny = Math.ceil(hauteur / DALLE);
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        const x0 = i * DALLE;
        const y0 = j * DALLE;
        const w = Math.min(DALLE, largeur - x0);
        const h = Math.min(DALLE, hauteur - y0);
        const d: Dalle = {
          x0, y0, w, h, proprio: this.creerTexture(gl.R16UI, w, h), terrain: this.creerTexture(gl.R8UI, w, h),
          sale: false, minX: 0, minY: 0, maxX: 0, maxY: 0,
        };
        this.televerser(d, gl.R8UI, d.terrain, this.terrain, 0, 0, w, h);
        this.dalles.push(d);
      }
    }
    this.palette = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(256 * 256 * 4));
    this.camera = { x: largeur / 2, y: hauteur / 2, zoom: 1 };
  }

  private compiler(): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader : ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Programme : ' + gl.getProgramInfoLog(p));
    return p;
  }

  private creerTexture(format: number, w: number, h: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h);
    return t;
  }

  /** Envoie la zone [x, x+w) × [y, y+h) (coordonnées de la dalle) à la carte graphique. */
  private televerser(d: Dalle, format: number, tex: WebGLTexture, source: Uint8Array | Uint16Array, x: number, y: number, w: number, h: number): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, this.largeur);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, d.x0 + x);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, d.y0 + y);
    const type = format === gl.R16UI ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE;
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RED_INTEGER, type, source);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  }

  /** Couleurs des joueurs (RGBA, 4 octets par identifiant, jusqu'à 65 536). */
  definirPalette(rgba: Uint8Array): void {
    const gl = this.gl;
    const plein = new Uint8Array(256 * 256 * 4);
    plein.set(rgba.subarray(0, plein.length));
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, plein);
  }

  /** Applique des paires (tuile, propriétaire) venues de la simulation. */
  appliquer(modifs: Uint32Array): void {
    const W = this.largeur;
    for (let k = 0; k < modifs.length; k += 2) {
      const t = modifs[k];
      this.proprio[t] = modifs[k + 1];
      const x = t % W;
      const y = (t - x) / W;
      const d = this.dalles[Math.floor(y / DALLE) * this.nx + Math.floor(x / DALLE)];
      const lx = x - d.x0;
      const ly = y - d.y0;
      if (!d.sale) {
        d.sale = true;
        d.minX = d.maxX = lx;
        d.minY = d.maxY = ly;
      } else {
        if (lx < d.minX) d.minX = lx;
        if (lx > d.maxX) d.maxX = lx;
        if (ly < d.minY) d.minY = ly;
        if (ly > d.maxY) d.maxY = ly;
      }
    }
  }

  redimensionner(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssL = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, Math.floor(this.cssL * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.cssH * this.dpr));
  }

  cssCentre(): { x: number; y: number } {
    return { x: this.cssL / 2, y: this.cssH / 2 };
  }

  get zoomMin(): number {
    return Math.min(this.cssL / this.largeur, this.cssH / this.hauteur) * 0.95;
  }

  get zoomMax(): number {
    return 16;
  }

  /** Cadre toute la carte. */
  cadrer(): void {
    this.camera = { x: this.largeur / 2, y: this.hauteur / 2, zoom: this.zoomMin };
  }

  limiter(): void {
    const c = this.camera;
    c.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, c.zoom));
    // La carte reste dans l'écran : centrée si elle est plus petite que lui, sinon bornée aux bords.
    const demiL = this.cssL / 2 / c.zoom;
    const demiH = this.cssH / 2 / c.zoom;
    c.x = demiL * 2 >= this.largeur ? this.largeur / 2 : Math.min(this.largeur - demiL, Math.max(demiL, c.x));
    c.y = demiH * 2 >= this.hauteur ? this.hauteur / 2 : Math.min(this.hauteur - demiH, Math.max(demiH, c.y));
  }

  /** Écran (pixels CSS depuis le coin du canvas) → tuile (réelle). */
  ecranVersTuile(px: number, py: number): { x: number; y: number } {
    const c = this.camera;
    return { x: c.x + (px - this.cssL / 2) / c.zoom, y: c.y + (py - this.cssH / 2) / c.zoom };
  }

  tuileVersEcran(x: number, y: number): { x: number; y: number } {
    const c = this.camera;
    return { x: (x - c.x) * c.zoom + this.cssL / 2, y: (y - c.y) * c.zoom + this.cssH / 2 };
  }

  /** Zoom autour d'un point de l'écran. */
  zoomer(facteur: number, px: number, py: number): void {
    const avant = this.ecranVersTuile(px, py);
    this.camera.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, this.camera.zoom * facteur));
    const apres = this.ecranVersTuile(px, py);
    this.camera.x += avant.x - apres.x;
    this.camera.y += avant.y - apres.y;
    this.limiter();
  }

  dessiner(): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.03, 0.05, 0.09, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    const c = this.camera;
    gl.uniform2f(this.loc.uCam, c.x, c.y);
    gl.uniform1f(this.loc.uZoom, c.zoom);
    gl.uniform2f(this.loc.uEcran, this.cssL, this.cssH);
    gl.uniform1i(this.loc.uVue, this.vue === 'pays' ? 0 : 1);
    gl.uniform1ui(this.loc.uMoi, this.moi);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.uniform1i(this.loc.uPalette, 2);
    const g = this.ecranVersTuile(0, 0);
    const b = this.ecranVersTuile(this.cssL, this.cssH);
    for (const d of this.dalles) {
      if (d.x0 > b.x || d.y0 > b.y || d.x0 + d.w < g.x || d.y0 + d.h < g.y) continue;
      if (d.sale) {
        this.televerser(d, gl.R16UI, d.proprio, this.proprio, d.minX, d.minY, d.maxX - d.minX + 1, d.maxY - d.minY + 1);
        d.sale = false;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, d.proprio);
      gl.uniform1i(this.loc.uProprio, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, d.terrain);
      gl.uniform1i(this.loc.uTerrain, 1);
      gl.uniform2f(this.loc.uOrigine, d.x0, d.y0);
      gl.uniform2f(this.loc.uTaille, d.w, d.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
}
