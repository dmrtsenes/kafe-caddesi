/** Film typography: stable safe margins, short action copy, and event-derived rewards. */
export function composeFlagshipFrame(
  ctx: CanvasRenderingContext2D,
  phase: number,
  time: number,
  badge: string,
  badgeAt: number,
) {
  const W = 1080,
    H = 1920,
    ink = "#18262b",
    white = "#fff8ec",
    amber = "#ffbd57";
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, "rgba(18,29,33,.80)");
  wash.addColorStop(0.24, "rgba(18,29,33,0)");
  wash.addColorStop(0.76, "rgba(18,29,33,0)");
  wash.addColorStop(1, "rgba(18,29,33,.85)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  function type(
    s: string,
    x: number,
    y: number,
    size: number,
    color = white,
    weight = 900,
    max = 920,
    align: CanvasTextAlign = "center",
  ) {
    ctx.font = `${weight} ${size}px 'Arial',sans-serif`;
    while (ctx.measureText(s).width > max && size > 20) {
      size--;
      ctx.font = `${weight} ${size}px 'Arial',sans-serif`;
    }
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(13,23,28,.48)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (phase < 6) {
    ctx.fillStyle = amber;
    ctx.fillRect(72, 89, 8, 32);
    type("KAFE CADDESİ", 99, 106, 26, white, 700, 600, "left");
    type(`${phase + 1} / 6`, 1008, 106, 22, "#c9d1cf", 500, 200, "right");
    const copy = [
      ["BURASI SENİN.", "TEMPO SENİN."],
      ["AL. TAŞI.", "SERVİS ET."],
      ["KAZANCINI", "TOPLA."],
      ["TEMİZLE.", "YENİDEN BAŞLA."],
      ["BEŞ LEZZET.", "TEK BİR EKİP."],
      ["KAFEN BÜYÜSÜN.", "HİKÂYEN BAŞLASIN."],
    ][phase];
    type(copy[0], 540, 226, 82);
    type(copy[1], 540, 321, 85, amber);
    const sub = [
      "İŞİN BAŞINA GEÇ",
      "HER FİNCAN BİR MİSAFİR",
      "EMEĞİN KARŞILIĞINI AL",
      "MASAYI YENİ MİSAFİRE HAZIRLA",
      "ÇAY  ·  LATTE  ·  TOST  ·  WAFFLE  ·  FRAPPE",
      "SENİN KAFEN. SENİN TARZIN.",
    ][phase];
    ctx.fillStyle = "rgba(255,248,236,.27)";
    ctx.fillRect(90, 1714, 900, 2);
    type(sub, 540, 1770, 29, white, 700, 920);
    const age = time - badgeAt;
    if (age >= 0 && age < 1.25) {
      ctx.globalAlpha = Math.min(1, age * 10, (1.25 - age) * 4);
      ctx.fillStyle = amber;
      ctx.beginPath();
      ctx.roundRect(286, 1558 - age * 12, 508, 72, 10);
      ctx.fill();
      type(badge, 540, 1594 - age * 12, 34, ink, 800, 460);
      ctx.globalAlpha = 1;
    }
  } else {
    const fade = Math.min(1, (time - 22.5) * 4);
    ctx.globalAlpha = fade;
    type("KAFE", 540, 172, 102);
    type("SOKAĞI", 540, 280, 102, amber);
    type("KAFENİ KUR. İŞİNİ BÜYÜT.", 540, 385, 31, white, 700);
    ctx.fillStyle = amber;
    ctx.beginPath();
    ctx.roundRect(110, 1660, 860, 94, 14);
    ctx.fill();
    type("HİKÂYEN BURADA BAŞLAR", 540, 1707, 39, ink, 800, 790);
    ctx.globalAlpha = 1;
  }
}
