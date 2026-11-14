import type { ItemId } from '../data/items';

/**
 * Studio-grade 2D vector icon illustrations for all 8 cafe menu products.
 * Shared by Customer overhead order bubbles (3D sprites) and the live Wall Menu Board.
 * Drawn in a ~56x56 logical box centered at (cx, cy), scaled by `scale`.
 */
export function drawMenuItemIcon(
  ctx: CanvasRenderingContext2D,
  item: ItemId,
  cx: number,
  cy: number,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (item) {
    case 'cay':
      drawTurkishTea(ctx);
      break;
    case 'latte':
      drawLatteCup(ctx);
      break;
    case 'tost':
      drawGrilledToast(ctx);
      break;
    case 'waffle':
      drawBelgianWaffle(ctx);
      break;
    case 'frappe':
      drawIcedFrappe(ctx);
      break;
    case 'smoothie':
      drawFruitSmoothie(ctx);
      break;
    case 'dondurma':
      drawIceCreamCone(ctx);
      break;
    case 'milkshake':
      drawBerryMilkshake(ctx);
      break;
    default:
      drawLatteCup(ctx);
      break;
  }

  ctx.restore();
}

function drawShadow(ctx: CanvasRenderingContext2D, y: number, rx: number, ry: number): void {
  const g = ctx.createRadialGradient(0, y, 1, 0, y, rx);
  g.addColorStop(0, 'rgba(15, 28, 38, 0.24)');
  g.addColorStop(0.7, 'rgba(15, 28, 38, 0.10)');
  g.addColorStop(1, 'rgba(15, 28, 38, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTurkishTea(ctx: CanvasRenderingContext2D): void {
  drawShadow(ctx, 21.5, 22, 5.5);

  // Porcelain saucer with champagne-gold trim
  const saucerGrad = ctx.createLinearGradient(0, 12.5, 0, 23.5);
  saucerGrad.addColorStop(0, '#ffffff');
  saucerGrad.addColorStop(0.65, '#f2f5f8');
  saucerGrad.addColorStop(1, '#cfd9e2');
  ctx.fillStyle = saucerGrad;
  ctx.beginPath();
  ctx.ellipse(0, 18.0, 21.5, 5.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#c89b48';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.ellipse(0, 17.8, 19.8, 4.9, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Saucer well
  ctx.fillStyle = 'rgba(168, 184, 198, 0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 17.9, 11.8, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tiny silver tea spoon on the right side of saucer
  ctx.save();
  ctx.translate(12.5, 18.6);
  ctx.rotate(-0.28);
  const spoonGrad = ctx.createLinearGradient(-8, -2, 8, 2);
  spoonGrad.addColorStop(0, '#f8fafc');
  spoonGrad.addColorStop(0.5, '#94a3b8');
  spoonGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = spoonGrad;
  ctx.beginPath();
  ctx.ellipse(-3.5, 0, 3.6, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(-0.5, 0);
  ctx.lineTo(8.5, 0.5);
  ctx.stroke();
  ctx.restore();

  // Outer crystal glass silhouette (slender waisted ince belli)
  const traceOuterGlass = () => {
    ctx.beginPath();
    ctx.moveTo(-13.2, -15.2);
    ctx.bezierCurveTo(-12.6, -7.8, -7.8, -3.5, -7.8, 0.4);
    ctx.bezierCurveTo(-7.8, 4.8, -14.2, 9.2, -9.8, 16.6);
    ctx.quadraticCurveTo(0, 19.4, 9.8, 16.6);
    ctx.bezierCurveTo(14.2, 9.2, 7.8, 4.8, 7.8, 0.4);
    ctx.bezierCurveTo(7.8, -3.5, 12.6, -7.8, 13.2, -15.2);
    ctx.closePath();
  };

  const glassGrad = ctx.createLinearGradient(-14, -15, 14, 18);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  glassGrad.addColorStop(0.5, 'rgba(226, 240, 250, 0.86)');
  glassGrad.addColorStop(1, 'rgba(182, 208, 226, 0.94)');
  traceOuterGlass();
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // Thick crystal base refraction
  const baseCrystal = ctx.createLinearGradient(-9, 13.8, 9, 17.8);
  baseCrystal.addColorStop(0, '#ffffff');
  baseCrystal.addColorStop(0.5, '#d6e6f2');
  baseCrystal.addColorStop(1, '#9ab5c9');
  ctx.fillStyle = baseCrystal;
  ctx.beginPath();
  ctx.ellipse(0, 15.8, 9.4, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ruby-garnet Turkish tea liquid
  const teaGrad = ctx.createLinearGradient(0, -10.5, 0, 14.6);
  teaGrad.addColorStop(0, '#f97316');
  teaGrad.addColorStop(0.24, '#dc2626');
  teaGrad.addColorStop(0.68, '#991b1b');
  teaGrad.addColorStop(1, '#4c0519');
  ctx.beginPath();
  ctx.moveTo(-11.4, -10.0);
  ctx.bezierCurveTo(-10.4, -5.0, -6.8, -1.8, -6.8, 0.6);
  ctx.bezierCurveTo(-6.8, 4.6, -12.6, 8.8, -8.8, 14.3);
  ctx.quadraticCurveTo(0, 16.5, 8.8, 14.3);
  ctx.bezierCurveTo(12.6, 8.8, 6.8, 4.6, 6.8, 0.6);
  ctx.bezierCurveTo(6.8, -1.8, 10.4, -5.0, 11.4, -10.0);
  ctx.closePath();
  ctx.fillStyle = teaGrad;
  ctx.fill();

  // Warm subsurface amber glow in lower bulb
  const bulbGlow = ctx.createRadialGradient(-1.8, 6.8, 0.8, 0, 6.8, 9.8);
  bulbGlow.addColorStop(0, 'rgba(251, 146, 60, 0.68)');
  bulbGlow.addColorStop(0.6, 'rgba(239, 68, 68, 0.22)');
  bulbGlow.addColorStop(1, 'rgba(153, 27, 27, 0)');
  ctx.fillStyle = bulbGlow;
  ctx.fill();

  // Liquid top surface meniscus
  const surfGrad = ctx.createLinearGradient(-11, -12.5, 11, -7.5);
  surfGrad.addColorStop(0, '#fdba74');
  surfGrad.addColorStop(0.45, '#ea580c');
  surfGrad.addColorStop(1, '#991b1b');
  ctx.fillStyle = surfGrad;
  ctx.beginPath();
  ctx.ellipse(0, -10.0, 11.3, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 237, 213, 0.78)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.ellipse(0, -10.0, 9.4, 2.2, 0, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();

  // Subtle refined glass edge + golden rim
  traceOuterGlass();
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.52)';
  ctx.lineWidth = 1.15;
  ctx.stroke();

  // Left curved specular highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(-10.4, -12.2);
  ctx.bezierCurveTo(-9.6, -6.8, -5.6, -3.0, -5.6, 0.6);
  ctx.bezierCurveTo(-5.6, 4.2, -10.2, 8.2, -7.4, 12.6);
  ctx.stroke();

  // Right rim highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(9.8, -8.5);
  ctx.bezierCurveTo(6.2, -3.2, 6.2, 2.5, 8.6, 10.5);
  ctx.stroke();

  // Top crystal lip with delicate gold band
  ctx.strokeStyle = '#d4a24c';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(0, -15.2, 13.1, 3.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(0, -15.2, 12.8, 3.3, 0, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();

  // Soft rising steam wisps
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-3.2, -18.2);
  ctx.quadraticCurveTo(-5.6, -21.2, -2.4, -24.2);
  ctx.moveTo(3.4, -17.6);
  ctx.quadraticCurveTo(1.4, -20.5, 4.2, -23.2);
  ctx.stroke();
}

function drawLatteCup(ctx: CanvasRenderingContext2D): void {
  drawShadow(ctx, 20.5, 23, 5.8);

  // Saucer
  const saucerG = ctx.createLinearGradient(0, 11, 0, 22);
  saucerG.addColorStop(0, '#ffffff');
  saucerG.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = saucerG;
  ctx.beginPath();
  ctx.ellipse(-1, 16.8, 22, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Cup handle (right)
  ctx.strokeStyle = '#2d6a5b';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.arc(14.5, 1.5, 6.8, -Math.PI * 0.48, Math.PI * 0.48);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(14.5, 1.0, 6.8, -Math.PI * 0.4, Math.PI * 0.25);
  ctx.stroke();

  // Ceramic cup body (artisan cafe emerald-teal)
  const cupG = ctx.createLinearGradient(-17, -8, 15, 16);
  cupG.addColorStop(0, '#3d8b78');
  cupG.addColorStop(0.55, '#285e50');
  cupG.addColorStop(1, '#183c33');
  ctx.fillStyle = cupG;
  ctx.beginPath();
  ctx.moveTo(-16.5, -6.5);
  ctx.bezierCurveTo(-16.2, 8.5, -10.5, 15.8, -1, 15.8);
  ctx.bezierCurveTo(8.5, 15.8, 14.2, 8.5, 14.5, -6.5);
  ctx.closePath();
  ctx.fill();

  // Cup specular highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(-13.2, -3.0);
  ctx.quadraticCurveTo(-12.2, 7.2, -6.5, 12.2);
  ctx.stroke();

  // Ivory inner rim
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(-1, -6.5, 15.5, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Golden espresso crema
  const cremaG = ctx.createRadialGradient(-3, -7, 2, -1, -6.5, 14);
  cremaG.addColorStop(0, '#d99b56');
  cremaG.addColorStop(0.7, '#a8682e');
  cremaG.addColorStop(1, '#6f3e18');
  ctx.fillStyle = cremaG;
  ctx.beginPath();
  ctx.ellipse(-1, -6.5, 13.6, 5.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crisp white heart/tulip latte art
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.moveTo(-1, -3.3);
  ctx.bezierCurveTo(-7.2, -5.8, -6.8, -9.8, -2.5, -9.2);
  ctx.bezierCurveTo(-1.2, -9.0, -1, -7.8, -1, -7.8);
  ctx.bezierCurveTo(-1, -7.8, -0.8, -9.0, 0.5, -9.2);
  ctx.bezierCurveTo(4.8, -9.8, 5.2, -5.8, -1, -3.3);
  ctx.closePath();
  ctx.fill();

  // Steam
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -14.5);
  ctx.quadraticCurveTo(-6.5, -18.5, -3, -22);
  ctx.moveTo(2.5, -14);
  ctx.quadraticCurveTo(0.5, -17.5, 3.5, -21);
  ctx.stroke();
}

function drawGrilledToast(ctx: CanvasRenderingContext2D): void {
  drawShadow(ctx, 18.5, 24, 6.2);

  // Clean cafe plate
  const plateG = ctx.createLinearGradient(0, 4, 0, 21);
  plateG.addColorStop(0, '#ffffff');
  plateG.addColorStop(1, '#d5dee8');
  ctx.fillStyle = plateG;
  ctx.beginPath();
  ctx.ellipse(0, 13.0, 23.5, 8.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Back toast triangle
  drawToastHalf(ctx, -3.5, -3.5, -0.08);
  // Front overlapping toast triangle with melted cheese pull
  drawToastHalf(ctx, 3.8, 3.5, 0.06);

  // Fresh parsley/basil leaf garnish
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(-13.5, 12.5, 4.2, 2.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.ellipse(-10.8, 13.8, 3.4, 1.8, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawToastHalf(ctx: CanvasRenderingContext2D, ox: number, oy: number, rot: number): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(rot);

  // Crust bottom thickness
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.moveTo(-15, 5);
  ctx.lineTo(13, 8);
  ctx.lineTo(5, -9);
  ctx.closePath();
  ctx.fill();

  // Melted golden kasar/cheddar ooze layer
  const cheeseG = ctx.createLinearGradient(-12, 2, 12, 8);
  cheeseG.addColorStop(0, '#fde047');
  cheeseG.addColorStop(0.5, '#facc15');
  cheeseG.addColorStop(1, '#ea580c');
  ctx.fillStyle = cheeseG;
  ctx.beginPath();
  ctx.moveTo(-14.5, 3.2);
  ctx.quadraticCurveTo(-5, 8.6, 0, 5.8);
  ctx.quadraticCurveTo(6, 9.8, 13, 6.2);
  ctx.lineTo(5, -9);
  ctx.closePath();
  ctx.fill();

  // Golden toasted bread top
  const breadG = ctx.createLinearGradient(-14, -10, 12, 6);
  breadG.addColorStop(0, '#f6cf86');
  breadG.addColorStop(0.6, '#e2a04a');
  breadG.addColorStop(1, '#b96d22');
  ctx.fillStyle = breadG;
  ctx.beginPath();
  ctx.moveTo(-15, 1.5);
  ctx.quadraticCurveTo(-1, 4.5, 12.8, 4.2);
  ctx.quadraticCurveTo(9.5, -4, 4.2, -10.8);
  ctx.quadraticCurveTo(-6, -6, -15, 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Panini sear stripes
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.62)';
  ctx.lineWidth = 1.8;
  for (let i = -2; i <= 1; i++) {
    const sx = i * 5.2;
    ctx.beginPath();
    ctx.moveTo(sx - 2, 1.2);
    ctx.lineTo(sx + 3.2, -5.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBelgianWaffle(ctx: CanvasRenderingContext2D): void {
  drawShadow(ctx, 19.0, 23.5, 6.0);

  // Plate
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(0, 13.5, 23, 8.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.38)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Golden waffle base (tilted rounded diamond)
  ctx.save();
  ctx.translate(0, 6.5);
  ctx.scale(1, 0.62);
  ctx.rotate(Math.PI / 4);

  // Side thickness
  ctx.fillStyle = '#9a5216';
  roundBoxPath(ctx, -14.5, -12.5, 29, 29, 5);
  ctx.fill();

  const wafG = ctx.createLinearGradient(-14, -14, 14, 14);
  wafG.addColorStop(0, '#f8d284');
  wafG.addColorStop(0.55, '#e09a3e');
  wafG.addColorStop(1, '#b86b1b');
  ctx.fillStyle = wafG;
  roundBoxPath(ctx, -14.5, -14.5, 29, 29, 5);
  ctx.fill();

  // Crisp waffle pockets
  ctx.fillStyle = 'rgba(133, 66, 14, 0.55)';
  for (let gx = -9; gx <= 9; gx += 6) {
    for (let gy = -9; gy <= 9; gy += 6) {
      ctx.fillRect(gx - 2, gy - 2, 4, 4);
    }
  }
  ctx.restore();

  // Chocolate/berry syrup ribbon
  ctx.strokeStyle = '#6b2114';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(-11, 6);
  ctx.bezierCurveTo(-5, 1, 5, 11, 11, 5);
  ctx.stroke();

  // Whipped cream rosette
  const creamG = ctx.createRadialGradient(-2, -1, 1, 0, 0, 8);
  creamG.addColorStop(0, '#ffffff');
  creamG.addColorStop(1, '#fde8ef');
  ctx.fillStyle = creamG;
  ctx.beginPath();
  ctx.arc(0, 1.5, 6.8, 0, Math.PI * 2);
  ctx.fill();

  // Glossy strawberry crown
  const berryG = ctx.createRadialGradient(-1.5, -5.5, 1, 0, -4, 6.5);
  berryG.addColorStop(0, '#fb7185');
  berryG.addColorStop(0.5, '#e11d48');
  berryG.addColorStop(1, '#881337');
  ctx.fillStyle = berryG;
  ctx.beginPath();
  ctx.moveTo(0, -10.5);
  ctx.bezierCurveTo(5.8, -8.5, 5.5, -1.0, 0, 0.5);
  ctx.bezierCurveTo(-5.5, -1.0, -5.8, -8.5, 0, -10.5);
  ctx.fill();
}

function drawIcedFrappe(ctx: CanvasRenderingContext2D): void {
  drawShadow(ctx, 21.5, 16.5, 4.5);

  // Green cafe straw
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(3, -8);
  ctx.lineTo(9.5, -23.5);
  ctx.stroke();

  // Tall tapered iced coffee cup
  const cupG = ctx.createLinearGradient(-12, -8, 12, 19);
  cupG.addColorStop(0, '#f5d7b2');
  cupG.addColorStop(0.38, '#c68b52');
  cupG.addColorStop(0.78, '#7c4722');
  cupG.addColorStop(1, '#43200d');
  ctx.fillStyle = cupG;
  ctx.beginPath();
  ctx.moveTo(-12.5, -8.5);
  ctx.lineTo(-8.8, 18.5);
  ctx.quadraticCurveTo(0, 21.2, 8.8, 18.5);
  ctx.lineTo(12.5, -8.5);
  ctx.closePath();
  ctx.fill();

  // Milk swirl + translucent ice cubes
  ctx.fillStyle = 'rgba(255, 248, 235, 0.42)';
  ctx.beginPath();
  ctx.ellipse(-3, 2, 5.5, 3.2, 0.35, 0, Math.PI * 2);
  ctx.ellipse(3.5, 8.5, 4.8, 2.8, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  roundBoxPath(ctx, -6.5, -4, 5.5, 5.2, 1.4);
  ctx.fill();
  roundBoxPath(ctx, 1.2, -2.5, 5.2, 5.0, 1.4);
  ctx.fill();

  // Fluffy whipped cream dome
  const whipG = ctx.createRadialGradient(-3, -13, 1.5, 0, -10, 13.5);
  whipG.addColorStop(0, '#ffffff');
  whipG.addColorStop(0.7, '#fef3c7');
  whipG.addColorStop(1, '#e7d5b8');
  ctx.fillStyle = whipG;
  ctx.beginPath();
  ctx.moveTo(-13.2, -8.2);
  ctx.bezierCurveTo(-13.5, -16.5, -6, -20.5, 0, -21.2);
  ctx.bezierCurveTo(6, -20.5, 13.5, -16.5, 13.2, -8.2);
  ctx.quadraticCurveTo(0, -5.8, -13.2, -8.2);
  ctx.fill();

  // Caramel drizzle over cream
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-8.5, -11.5);
  ctx.quadraticCurveTo(-2, -15.5, 5.5, -11);
  ctx.moveTo(-5.5, -15.5);
  ctx.quadraticCurveTo(0, -18, 7, -14.2);
  ctx.stroke();

  // Glass outline & left specular shine
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.48)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-12.5, -8.5);
  ctx.lineTo(-8.8, 18.5);
  ctx.quadraticCurveTo(0, 21.2, 8.8, 18.5);
  ctx.lineTo(12.5, -8.5);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-9.6, -5.5);
  ctx.lineTo(-6.8, 15.5);
  ctx.stroke();
}

function drawFruitSmoothie(ctx: CanvasRenderingContext2D): void {
  drawShadow(ctx, 21.5, 16.5, 4.5);

  // Coral straw
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(2.5, -9);
  ctx.lineTo(8.5, -24);
  ctx.stroke();

  // Two-tone tropical smoothie body (mango gold base + berry pink top)
  const smG = ctx.createLinearGradient(0, -9, 0, 19);
  smG.addColorStop(0, '#fb7185');
  smG.addColorStop(0.48, '#f43f5e');
  smG.addColorStop(0.75, '#fb923c');
  smG.addColorStop(1, '#facc15');
  ctx.fillStyle = smG;
  ctx.beginPath();
  ctx.moveTo(-12.5, -8.5);
  ctx.lineTo(-8.6, 18.5);
  ctx.quadraticCurveTo(0, 21.2, 8.6, 18.5);
  ctx.lineTo(12.5, -8.5);
  ctx.closePath();
  ctx.fill();

  // Clear dome lid
  const lidG = ctx.createLinearGradient(-12, -20, 12, -8);
  lidG.addColorStop(0, 'rgba(255,255,255,0.86)');
  lidG.addColorStop(0.5, 'rgba(224,242,254,0.42)');
  lidG.addColorStop(1, 'rgba(255,255,255,0.75)');
  ctx.fillStyle = lidG;
  ctx.beginPath();
  ctx.arc(0, -8.5, 12.6, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Cup rim band
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, -8.5, 13.2, 2.8, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Mint leaf accent inside/on rim
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(-5.2, -11.5, 4.2, 2.2, -0.45, 0, Math.PI * 2);
  ctx.fill();

  // Left glass highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(-9.6, -4.5);
  ctx.lineTo(-6.8, 15.5);
  ctx.stroke();
}

function drawIceCreamCone(ctx: CanvasRenderingContext2D): void {
  drawShadow(ctx, 22.0, 13, 3.8);

  // Waffle cone
  const coneG = ctx.createLinearGradient(-10, 0, 10, 21);
  coneG.addColorStop(0, '#f5c26b');
  coneG.addColorStop(0.6, '#d98a36');
  coneG.addColorStop(1, '#92400e');
  ctx.fillStyle = coneG;
  ctx.beginPath();
  ctx.moveTo(-10.8, 0.5);
  ctx.lineTo(0, 21.8);
  ctx.lineTo(10.8, 0.5);
  ctx.closePath();
  ctx.fill();

  // Waffle crosshatch lines
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(-7.5, 2); ctx.lineTo(3.5, 14);
  ctx.moveTo(-2.5, 2); ctx.lineTo(6.2, 10);
  ctx.moveTo(7.5, 2); ctx.lineTo(-3.5, 14);
  ctx.moveTo(2.5, 2); ctx.lineTo(-6.2, 10);
  ctx.stroke();

  // Bottom scoop tier (strawberry pink)
  const pinkG = ctx.createRadialGradient(-4, -3, 1.5, 0, -1, 13.5);
  pinkG.addColorStop(0, '#ffe4e6');
  pinkG.addColorStop(0.55, '#fb7185');
  pinkG.addColorStop(1, '#be123c');
  ctx.fillStyle = pinkG;
  ctx.beginPath();
  ctx.ellipse(0, -1.2, 13.0, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Middle swirl tier (vanilla cream)
  const vanG = ctx.createRadialGradient(-3, -10, 1, 0, -8.5, 11);
  vanG.addColorStop(0, '#ffffff');
  vanG.addColorStop(0.7, '#fef3c7');
  vanG.addColorStop(1, '#d6c29f');
  ctx.fillStyle = vanG;
  ctx.beginPath();
  ctx.ellipse(0, -8.2, 10.2, 5.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top soft-serve peak (pink swirl)
  ctx.fillStyle = pinkG;
  ctx.beginPath();
  ctx.moveTo(-7.2, -11.5);
  ctx.bezierCurveTo(-6.5, -18.5, -1, -21.5, 1.8, -22.5);
  ctx.bezierCurveTo(3.2, -18.0, 7.2, -15.5, 7.2, -11.5);
  ctx.quadraticCurveTo(0, -9.2, -7.2, -11.5);
  ctx.fill();

  // Glossy red cherry
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.arc(4.8, -19.2, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(3.8, -20.2, 1.0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBerryMilkshake(ctx: CanvasRenderingContext2D): void {
  drawShadow(ctx, 21.5, 15.5, 4.4);

  // Striped retro straw
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(-4, -9);
  ctx.lineTo(-9.5, -24);
  ctx.stroke();

  // Footed fountain pedestal base
  ctx.fillStyle = '#dbeafe';
  ctx.beginPath();
  ctx.ellipse(0, 19.2, 9.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-2.6, 13.5, 5.2, 5.5);

  // Fluted milkshake glass body
  const shakeG = ctx.createLinearGradient(-12, -8, 12, 15);
  shakeG.addColorStop(0, '#fce7f3');
  shakeG.addColorStop(0.45, '#f472b6');
  shakeG.addColorStop(1, '#be185d');
  ctx.fillStyle = shakeG;
  ctx.beginPath();
  ctx.moveTo(-12.2, -8.5);
  ctx.bezierCurveTo(-11.5, 4.5, -7.2, 14.2, 0, 14.5);
  ctx.bezierCurveTo(7.2, 14.2, 11.5, 4.5, 12.2, -8.5);
  ctx.closePath();
  ctx.fill();

  // Whipped cream cloud
  const whipG = ctx.createRadialGradient(-2, -14, 1.5, 0, -11, 13);
  whipG.addColorStop(0, '#ffffff');
  whipG.addColorStop(0.75, '#fdf2f8');
  whipG.addColorStop(1, '#fbcfe8');
  ctx.fillStyle = whipG;
  ctx.beginPath();
  ctx.moveTo(-12.8, -8.2);
  ctx.bezierCurveTo(-13, -17, -5, -21, 0, -21.5);
  ctx.bezierCurveTo(5, -21, 13, -17, 12.8, -8.2);
  ctx.quadraticCurveTo(0, -5.8, -12.8, -8.2);
  ctx.fill();

  // Sprinkles + cherry
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.arc(0.5, -21.2, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-0.5, -22.2, 1.0, 0, Math.PI * 2);
  ctx.fill();

  const colors = ['#facc15', '#38bdf8', '#ec4899', '#4ade80'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-7 + i * 2.6, -13.5 + (i % 2) * 2.4, 2.2, 1.2);
  }

  // Specular glass shine
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-9.2, -5.0);
  ctx.quadraticCurveTo(-8.2, 5.5, -4.5, 11.5);
  ctx.stroke();
}

function roundBoxPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
