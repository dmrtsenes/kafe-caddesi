/** High-converting mobile UA ad overlay with Kafe Caddesi branding. */
export function composePremiumFrame(
  ctx: CanvasRenderingContext2D,
  phase: number,
  time: number,
  badge: string,
  badgeAt: number,
) {
  const cream = "#FFF3D7",
    gold = "#FFC44A",
    teal = "#128D80",
    ink = "#103D40",
    mint = "#9FE9C5";

  // Clean, subtle cinematic top/bottom gradients (leaves the beautiful 3D cafe bright and vibrant)
  const topGrad = ctx.createLinearGradient(0, 0, 0, 420);
  topGrad.addColorStop(0, "rgba(8,45,50,0.88)");
  topGrad.addColorStop(0.65, "rgba(8,45,50,0.45)");
  topGrad.addColorStop(1, "rgba(8,45,50,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 1080, 420);

  const bottomGrad = ctx.createLinearGradient(0, 1550, 0, 1920);
  bottomGrad.addColorStop(0, "rgba(8,45,50,0)");
  bottomGrad.addColorStop(0.4, "rgba(8,45,50,0.55)");
  bottomGrad.addColorStop(1, "rgba(8,45,50,0.92)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 1550, 1080, 370);

  function roundBox(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  if (phase < 6) {
    // Top Brand Pill (Clean, punchy, modern)
    ctx.save();
    ctx.fillStyle = "rgba(16,61,64,0.85)";
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.5;
    roundBox(540 - 240, 68, 480, 56, 28);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = gold;
    ctx.font = "800 24px 'Arial',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⭐ KAFE CADDESİ • 3D TYCOON ⭐", 540, 96);
    ctx.restore();

    // Bold, energetic headline (My Mini Mart / My Perfect Hotel style)
    const titles = [
      { top: "KAFENİ GENİŞLET!", sub: "LÜKS MEKÂN. MUTLU MİSAFİRLER." },
      { top: "TEPSİNİ DOLDUR!", sub: "HIZLI SERVİS. BÜYÜK KAZANÇ." },
      { top: "PARALARI TOPLA!", sub: "KASADA BİRİKEN NAKİTLER." },
      { top: "HEPSİNİ TEMİZLE!", sub: "PIRIL PIRIL MASALAR." },
      { top: "5 FARKLI LEZZET!", sub: "ÇAY, LATTE, TOST, WAFFLE, FRAPPE" },
      { top: "VIP SERVİS YAP!", sub: "EKİBİNLE KAFENİ BÜYÜT." },
    ][phase];

    // Main 3D Banner
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 3D Text Shadow
    ctx.font = "900 78px 'Arial',sans-serif";
    ctx.fillStyle = "rgba(8,30,34,0.85)";
    ctx.fillText(titles.top, 542, 206);

    // Primary Text with Gold/Cream gradient
    ctx.fillStyle = phase % 2 === 0 ? gold : cream;
    ctx.fillText(titles.top, 540, 202);

    // Secondary sub-header pill
    ctx.fillStyle = teal;
    roundBox(540 - 320, 268, 640, 52, 26);
    ctx.fill();
    ctx.strokeStyle = mint;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = cream;
    ctx.font = "700 27px 'Arial',sans-serif";
    ctx.fillText(titles.sub, 540, 294);
    ctx.restore();

    // Floating dynamic rewards / badge indicator
    const age = time - badgeAt;
    if (age >= 0 && age < 1.35) {
      const scale = Math.min(1, age * 8);
      const alpha = Math.min(1, age * 6, (1.35 - age) * 3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(540, 1490 - age * 18);
      ctx.scale(scale, scale);

      ctx.fillStyle = gold;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      roundBox(-220, -42, 440, 84, 42);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = cream;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = ink;
      ctx.font = "900 38px 'Arial',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badge, 0, 2);
      ctx.restore();
    }

    // Bottom Footer Ticker
    const footers = [
      "KENDİ KAFENİ BAŞTAN YÖNET • EN İYİ HİZMETİ SUN",
      "SİPARİŞLERİ BEKLETMEDEN ULAŞTIR",
      "KASADA BİRİKEN PARALARI ANINDA İŞLETMEYE YATIR",
      "MASALARI TEMİZ TUT, DAHA ÇOK MİSAFİR GELSİN",
      "USTA BARİSTALAR VE GARSONLARLA EKİBİNİ KUR",
      "VIP BÖLÜMÜ AÇ, GELİRİNİ İKİYE KATLA",
    ][phase];
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = mint;
    ctx.font = "700 26px 'Arial',sans-serif";
    ctx.fillText(footers, 540, 1820);
    ctx.restore();
  } else {
    // Phase 6: Grand Outro Call To Action (High-Converting End Screen)
    const a = Math.min(1, (time - 22.5) * 3.5);
    ctx.save();
    ctx.globalAlpha = a;

    // Dark luxury overlay
    ctx.fillStyle = "rgba(8,38,42,0.72)";
    ctx.fillRect(0, 0, 1080, 1920);

    // Awning Banner Header
    ctx.fillStyle = gold;
    roundBox(120, 160, 840, 260, 36);
    ctx.fill();
    ctx.strokeStyle = cream;
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.font = "900 86px 'Arial',sans-serif";
    ctx.fillText("KAFE CADDESİ", 540, 255);

    ctx.fillStyle = teal;
    ctx.font = "800 32px 'Arial',sans-serif";
    ctx.fillText("CAFE AVENUE • 3D IDLE TYCOON", 540, 345);

    // 5 Stars
    ctx.fillStyle = gold;
    ctx.font = "52px 'Segoe UI Emoji','Arial',sans-serif";
    ctx.fillText("⭐⭐⭐⭐⭐", 540, 485);

    ctx.fillStyle = cream;
    ctx.font = "700 34px 'Arial',sans-serif";
    ctx.fillText("KÜÇÜK BAŞLA. BİRLİKTE BÜYÜT.", 540, 560);

    // Large Pulsating "ŞİMDİ ÜCRETSİZ OYNA" Button
    const pulse = 1 + 0.035 * Math.sin(time * 12);
    ctx.save();
    ctx.translate(540, 1580);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = gold;
    ctx.shadowColor = "rgba(255,196,74,0.6)";
    ctx.shadowBlur = 30;
    roundBox(-380, -65, 760, 130, 65);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = cream;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.font = "900 50px 'Arial',sans-serif";
    ctx.fillText("ŞİMDİ ÜCRETSİZ OYNA ➔", 0, 0);

    // Animated 3D Tap Hand 👆
    const tapBob = 8 * Math.sin(time * 14);
    ctx.font = "58px 'Segoe UI Emoji','Arial',sans-serif";
    ctx.fillText("👆", 270, 45 + tapBob);
    ctx.restore();

    ctx.fillStyle = mint;
    ctx.font = "600 28px 'Arial',sans-serif";
    ctx.fillText("Google Play • Ücretsiz İndir", 540, 1725);

    ctx.restore();
  }
}

