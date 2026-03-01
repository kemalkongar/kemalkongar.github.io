(function () {
    const canvas = document.getElementById('financeCanvas');
    const ctx = canvas.getContext('2d');
    const DISPLAY_TIME = 4000;
    const FADE_TIME = 1800;
    const DARK = '#0a1628';
    const GRAY = '#9ca3af';
    const MUTED = '#6b7280';
    const SERIF = '"Times New Roman", Georgia, serif';
    const SANS = 'Calibri, sans-serif';

    function resize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const w = () => canvas.width / devicePixelRatio;
    const h = () => canvas.height / devicePixelRatio;

    function drawAxes(xLabel, yLabel) {
        const compact = w() < 360;
        const mx = compact ? 36 : 50, my = 20, bm = 24, rm = compact ? 10 : 20;
        const fsz = compact ? 10 : 12;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx, h() - bm);
        ctx.lineTo(w() - rm, h() - bm);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = MUTED;
        ctx.font = `${fsz}px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText(xLabel, (mx + w() - rm) / 2, h() - 6);
        ctx.save();
        ctx.translate(compact ? 10 : 14, (my + h() - bm) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
        return { left: mx, top: my, bottom: h() - bm, right: w() - rm };
    }

    // Simple centered formula renderer
    function drawFormula(text) {
        const compact = w() < 360;
        const sz = compact ? 17 : 21;
        ctx.fillStyle = DARK;
        ctx.font = `${sz}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.fillText(text, w() / 2, h() * 0.55);
    }

    // 1. Efficient Frontier
    function drawEfficientFrontier() {
        const b = drawAxes('σ (Risk)', 'E(R)');
        const plotW = b.right - b.left;
        const plotH = b.bottom - b.top;
        const minSigX = 0.18;
        const pts = [];
        for (let t = -1; t <= 1; t += 0.015) {
            const sx = minSigX + 0.7 * t * t;
            const ry = 0.5 + 0.4 * t;
            pts.push({ x: b.left + sx * plotW, y: b.bottom - ry * plotH });
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 2;
        ctx.stroke();

        const rfY = b.bottom - 0.15 * plotH;
        const tTan = 0.4;
        const tanX = b.left + (minSigX + 0.7 * tTan * tTan) * plotW;
        const tanY = b.bottom - (0.5 + 0.4 * tTan) * plotH;
        const slope = (tanY - rfY) / (tanX - b.left);

        ctx.beginPath();
        ctx.setLineDash([5, 4]);
        ctx.moveTo(b.left, rfY);
        const cmlEndY = rfY + slope * (b.right - b.left);
        ctx.lineTo(b.right, Math.max(b.top, cmlEndY));
        ctx.strokeStyle = MUTED;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        [-0.6, -0.2, 0.15, 0.5, 0.8].forEach(t => {
            const dx = b.left + (minSigX + 0.7 * t * t + 0.04) * plotW;
            const dy = b.bottom - (0.5 + 0.4 * t - 0.02) * plotH;
            ctx.beginPath();
            ctx.arc(dx, dy, 3, 0, Math.PI * 2);
            ctx.fillStyle = DARK;
            ctx.fill();
        });

        ctx.fillStyle = MUTED;
        ctx.font = `11px ${SANS}`;
        ctx.textAlign = 'left';
        ctx.fillText('Rꜰ', b.left + 4, rfY - 6);
        ctx.fillText('CML', b.right - 32, Math.max(b.top + 12, cmlEndY - 6));
    }

    // 2. Security Market Line
    function drawSML() {
        const b = drawAxes('', 'E(R)');
        const plotH = b.bottom - b.top;
        const plotW = b.right - b.left;
        const rfY = b.bottom - 0.15 * plotH;
        const mktX = b.left + 0.5 * plotW;
        const mktY = b.bottom - 0.6 * plotH;
        const slope = (mktY - rfY) / (mktX - b.left);

        ctx.beginPath();
        ctx.moveTo(b.left, rfY);
        ctx.lineTo(b.right, Math.max(b.top, rfY + slope * plotW));
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mktX, mktY, 4, 0, Math.PI * 2);
        ctx.fillStyle = DARK;
        ctx.fill();
        ctx.fillStyle = MUTED;
        ctx.font = `11px ${SANS}`;
        ctx.textAlign = 'left';
        ctx.fillText('M', mktX + 7, mktY + 4);
        ctx.textAlign = 'right';
        ctx.fillText('Rꜰ', b.left - 5, rfY + 4);

        // β = 1 tick label beneath the market point
        ctx.beginPath();
        ctx.moveTo(mktX, b.bottom);
        ctx.lineTo(mktX, b.bottom - 4);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = MUTED;
        ctx.font = `${w() < 360 ? 9 : 10}px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText('β=1', mktX, b.bottom + 13);

        [{ beta: 0.3, off: 0.04 }, { beta: 0.6, off: -0.05 },
        { beta: 0.8, off: 0.06 }, { beta: 1.2, off: -0.03 },
        { beta: 1.5, off: 0.07 }, { beta: 1.8, off: -0.04 }].forEach(s => {
            const sx = b.left + (s.beta / 2) * plotW;
            const sy = rfY + slope * (sx - b.left) - s.off * plotH;
            ctx.beginPath();
            ctx.arc(sx, Math.max(b.top + 3, sy), 2.5, 0, Math.PI * 2);
            ctx.fillStyle = MUTED;
            ctx.fill();
        });
    }

    // 3. Normal distribution with VaR
    function drawNormalDist() {
        const compact = w() < 360;
        const mx = compact ? 28 : 40, my = 20, bm = 24, rm = compact ? 10 : 20;
        const b = { left: mx, top: my, bottom: h() - bm, right: w() - rm };

        ctx.beginPath();
        ctx.moveTo(b.left, b.bottom);
        ctx.lineTo(b.right, b.bottom);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 1;
        ctx.stroke();

        const centerX = (b.left + b.right) / 2;
        const spread = (b.right - b.left) * 0.35;
        const peakH = (b.bottom - b.top) * 0.85;
        const pts = [];
        const n = 100;
        for (let i = 0; i <= n; i++) {
            const t = (i / n) * 2 - 1;
            const x = centerX + t * spread * 1.8;
            const gauss = Math.exp(-0.5 * Math.pow(t * 2.8, 2));
            pts.push({ x, y: b.bottom - gauss * peakH });
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 2;
        ctx.stroke();

        const varCutoff = Math.floor(n * 0.15);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, b.bottom);
        for (let i = 0; i <= varCutoff; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[varCutoff].x, b.bottom);
        ctx.closePath();
        ctx.fillStyle = 'rgba(10, 22, 40, 0.12)';
        ctx.fill();

        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.moveTo(pts[varCutoff].x, b.bottom);
        ctx.lineTo(pts[varCutoff].x, pts[varCutoff].y);
        ctx.strokeStyle = MUTED;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = MUTED;
        ctx.font = `11px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText('VaR', pts[varCutoff].x, b.bottom + 14);
        ctx.fillText('μ', centerX, b.bottom + 14);
        ctx.fillText('−σ', centerX - spread * 0.71, b.bottom + 14);
        ctx.fillText('+σ', centerX + spread * 0.71, b.bottom + 14);
    }

    // 4. Monte Carlo VaR — sorted bar chart with 5th percentile cutoff
    function drawMonteCarloVaR() {
        const b = drawAxes('Simulation', 'Return');
        const plotW = b.right - b.left;
        const plotH = b.bottom - b.top;
        const compact = w() < 360;

        const nSims = 80;
        const mu = 0.02, sigma = 0.16;

        function pseudoRand(seed, i) {
            return Math.sin(seed * 1000 + i * 137.5) * 0.5 + 0.5;
        }

        // Generate returns using Box-Muller (two per pair for better normal coverage)
        const returns = [];
        for (let p = 0; p < nSims; p++) {
            const r1 = pseudoRand(p * 3.7 + 1.1, p * 2 + 7);
            const r2 = pseudoRand(p * 5.3 + 2.9, p * 2 + 13);
            const u1 = Math.max(r1, 0.001);
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * r2);
            returns.push(mu + sigma * z);
        }

        // Sort worst to best
        returns.sort((a, bv) => a - bv);

        const cutoff = Math.ceil(nSims * 0.05);
        const varLevel = returns[cutoff - 1];

        const yMin = Math.min(...returns) * 1.15;
        const yMax = Math.max(...returns) * 1.15;
        const yRange = yMax - yMin;

        // Zero line
        const zeroY = b.bottom - ((0 - yMin) / yRange) * plotH;
        ctx.beginPath();
        ctx.moveTo(b.left, zeroY);
        ctx.lineTo(b.right, zeroY);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        function toY(v) { return b.bottom - ((v - yMin) / yRange) * plotH; }

        // Draw bars
        const gap = 1;
        const barW = (plotW - gap * (nSims - 1)) / nSims;
        returns.forEach((ret, i) => {
            const x = b.left + i * (barW + gap);
            const barTop = Math.min(zeroY, toY(ret));
            const barH = Math.abs(toY(ret) - zeroY);
            ctx.fillStyle = i < cutoff ? 'rgba(10, 22, 40, 0.7)' : 'rgba(10, 22, 40, 0.2)';
            ctx.fillRect(x, barTop, barW, barH);
        });

        // VaR vertical dotted line at the cutoff boundary
        const varX = b.left + cutoff * (barW + gap) - gap / 2;
        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.moveTo(varX, b.top);
        ctx.lineTo(varX, b.bottom);
        ctx.strokeStyle = MUTED;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = MUTED;
        ctx.font = `${compact ? 8 : 10}px ${SANS}`;
        ctx.textAlign = 'left';
        ctx.fillText('VaR 5%', varX + 4, b.top + 10);
    }

    // Factor return components shared by decomposition charts
    const FACTOR_COMPONENTS = [
        { label: 'Market', value: 0.32, alpha: 0.25 },
        { label: 'Industry', value: 0.12, alpha: 0.40 },
        { label: 'Style', value: -0.08, alpha: 0.55 },
        { label: 'Idiosyncratic', value: 0.14, alpha: 0.75 }
    ];

    // 5. Return Decomposition — Barra-style waterfall chart
    function drawReturnDecomposition() {
        const compact = w() < 360;
        const mx = compact ? 36 : 50, my = 20, bm = 30, rm = 14;
        const b = { left: mx, top: my, bottom: h() - bm, right: w() - rm };
        const plotH = b.bottom - b.top;

        ctx.beginPath();
        ctx.moveTo(b.left, b.top);
        ctx.lineTo(b.left, b.bottom);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = MUTED;
        ctx.font = `${compact ? 10 : 12}px ${SANS}`;
        ctx.save();
        ctx.translate(compact ? 10 : 14, (b.top + b.bottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('Return', 0, 0);
        ctx.restore();

        const components = FACTOR_COMPONENTS;
        const total = components.reduce((s, c) => s + c.value, 0);

        const maxVal = Math.max(total, components.reduce((s, c) => s + Math.max(c.value, 0), 0)) * 1.15;
        const minVal = Math.min(0, ...(() => {
            let r = 0;
            return components.map(c => { r += c.value; return r; });
        })()) * 1.15;
        const range = maxVal - minVal;
        const yScale = plotH / range;
        const zeroY = b.top + maxVal * yScale;

        const barCount = components.length + 1;
        const totalWidth = b.right - b.left;
        const gapFrac = compact ? 0.03 : 0.05;
        const gap = totalWidth * gapFrac;
        const barW = (totalWidth - gap * (barCount + 1)) / barCount;
        const labelSz = compact ? 8 : 10;
        const shortLabels = compact
            ? ['Mkt', 'Ind', 'Style', 'Idio', 'Total']
            : ['Market', 'Industry', 'Style', 'Idio', 'Total'];

        let running = 0;
        components.forEach((c, i) => {
            const x = b.left + gap + i * (barW + gap);
            const barTop = zeroY - Math.max(running + c.value, running) * yScale;
            const barBot = zeroY - Math.min(running + c.value, running) * yScale;

            ctx.fillStyle = `rgba(10, 22, 40, ${c.alpha})`;
            ctx.fillRect(x, barTop, barW, barBot - barTop);

            if (i < components.length - 1) {
                const connY = zeroY - (running + c.value) * yScale;
                ctx.beginPath();
                ctx.setLineDash([3, 2]);
                ctx.moveTo(x + barW, connY);
                ctx.lineTo(x + barW + gap, connY);
                ctx.strokeStyle = GRAY;
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.setLineDash([]);
            }

            ctx.fillStyle = MUTED;
            ctx.font = `${labelSz}px ${SANS}`;
            ctx.textAlign = 'center';
            ctx.fillText(shortLabels[i], x + barW / 2, b.bottom + 13);

            running += c.value;
        });

        const tX = b.left + gap + components.length * (barW + gap);
        const tTop = zeroY - Math.max(total, 0) * yScale;
        const tBot = zeroY - Math.min(total, 0) * yScale;
        ctx.fillStyle = DARK;
        ctx.fillRect(tX, tTop, barW, tBot - tTop);
        ctx.fillStyle = MUTED;
        ctx.font = `${labelSz}px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText(shortLabels[4], tX + barW / 2, b.bottom + 13);

        ctx.beginPath();
        ctx.moveTo(b.left, zeroY);
        ctx.lineTo(b.right, zeroY);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    // 6. Return Decomposition over time — stacked area chart
    function drawReturnTimeSeries() {
        const compact = w() < 360;
        const mx = compact ? 36 : 50, my = 16, bm = 24, rm = compact ? 10 : 20;
        const b = { left: mx, top: my, bottom: h() - bm, right: w() - rm };
        const plotW = b.right - b.left;
        const plotH = b.bottom - b.top;

        ctx.beginPath();
        ctx.moveTo(b.left, b.top);
        ctx.lineTo(b.left, b.bottom);
        ctx.lineTo(b.right, b.bottom);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = MUTED;
        ctx.font = `${compact ? 10 : 12}px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText('Time', (b.left + b.right) / 2, h() - 4);
        ctx.save();
        ctx.translate(compact ? 10 : 14, (b.top + b.bottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Return', 0, 0);
        ctx.restore();

        const n = 60;
        const factors = FACTOR_COMPONENTS;
        const seeds = [2.1, 5.3, 8.7, 12.1];
        function pseudoRand(seed, i) {
            return Math.sin(seed * 1000 + i * 137.5) * 0.5 + 0.5;
        }

        const series = factors.map((f, fi) => {
            const pts = [0];
            const drift = f.value / n;
            for (let i = 1; i <= n; i++) {
                const noise = (pseudoRand(seeds[fi], i) - 0.5) * 0.015;
                pts.push(pts[i - 1] + drift + noise);
            }
            return pts;
        });

        const stacked = series.map((_, fi) =>
            Array.from({ length: n + 1 }, (_, i) =>
                series.slice(0, fi + 1).reduce((s, sr) => s + sr[i], 0)
            )
        );

        const allVals = stacked[stacked.length - 1];
        const yMin = Math.min(0, ...stacked.flat()) * 1.1;
        const yMax = Math.max(...allVals) * 1.15;
        const yRange = yMax - yMin;

        function toX(i) { return b.left + (i / n) * plotW; }
        function toY(v) { return b.bottom - ((v - yMin) / yRange) * plotH; }

        for (let fi = stacked.length - 1; fi >= 0; fi--) {
            const top = stacked[fi];
            const bot = fi > 0 ? stacked[fi - 1] : Array(n + 1).fill(0);

            ctx.beginPath();
            ctx.moveTo(toX(0), toY(top[0]));
            for (let i = 1; i <= n; i++) ctx.lineTo(toX(i), toY(top[i]));
            for (let i = n; i >= 0; i--) ctx.lineTo(toX(i), toY(bot[i]));
            ctx.closePath();
            ctx.fillStyle = `rgba(10, 22, 40, ${factors[fi].alpha})`;
            ctx.fill();
        }

        if (yMin < 0) {
            ctx.beginPath();
            ctx.setLineDash([4, 3]);
            ctx.moveTo(b.left, toY(0));
            ctx.lineTo(b.right, toY(0));
            ctx.strokeStyle = GRAY;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        const legendLabels = compact
            ? ['Mkt', 'Ind', 'Style', 'Idio']
            : ['Market', 'Industry', 'Style', 'Idio'];
        const legSz = compact ? 7 : 9;
        ctx.font = `${legSz}px ${SANS}`;
        const swatchW = compact ? 6 : 8;
        const legGap = compact ? 6 : 10;
        const items = legendLabels.map((l, i) => ({
            label: l, alpha: factors[i].alpha,
            tw: ctx.measureText(l).width
        }));
        const totalLegW = items.reduce((s, it) => s + swatchW + 3 + it.tw + legGap, -legGap);
        let lx = b.left + (plotW - totalLegW) / 2;
        const ly = b.top + 6;
        items.forEach(it => {
            ctx.fillStyle = `rgba(10, 22, 40, ${it.alpha})`;
            ctx.fillRect(lx, ly - swatchW + 1, swatchW, swatchW);
            ctx.fillStyle = MUTED;
            ctx.textAlign = 'left';
            ctx.fillText(it.label, lx + swatchW + 3, ly + 1);
            lx += swatchW + 3 + it.tw + legGap;
        });
    }

    // 7. Active Return formula
    function drawActiveReturn() {
        drawFormula('αᵢ = IC · σᵢ · sᵢ');
    }

    // 8. Proportional weight formula
    function drawProportionalWeight() {
        const compact = w() < 360;
        const cx = w() / 2;
        const cy = h() * 0.48;
        const mainSz = compact ? 15 : 19;
        const subSz = compact ? 10 : 13;
        const supSz = compact ? 10 : 13;

        // Δw*ᵢ = (μᵢ / σ²ᵢ) · (σ_A / IC√BR)
        // Render: Δwᵢ* =  fraction1  ·  fraction2

        // Measure parts to center everything
        ctx.font = `${mainSz}px ${SERIF}`;
        const lhs = 'Δwᵢ* = ';
        const dot = '  ·  ';
        const lhsW = ctx.measureText(lhs).width;
        const dotW = ctx.measureText(dot).width;

        // Fraction widths
        ctx.font = `${subSz}px ${SERIF}`;
        const num1 = 'μᵢ';
        const den1 = 'σᵢ²';
        const num2 = 'σ';
        const den2W = ctx.measureText('IC√BR').width;
        const num1W = ctx.measureText(num1).width;
        const den1W = ctx.measureText(den1).width;
        const num2W = ctx.measureText(num2).width;
        ctx.font = `${supSz}px ${SERIF}`;
        const subA = 'A';
        const subAW = ctx.measureText(subA).width;

        const frac1W = Math.max(num1W, den1W) + 8;
        const frac2W = Math.max(num2W + subAW, den2W) + 8;
        const totalW = lhsW + frac1W + dotW + frac2W;
        let x = cx - totalW / 2;

        // LHS
        ctx.fillStyle = DARK;
        ctx.font = `${mainSz}px ${SERIF}`;
        ctx.textAlign = 'left';
        ctx.fillText(lhs, x, cy + mainSz * 0.15);
        x += lhsW;

        // Fraction 1: μᵢ / σᵢ²
        const f1cx = x + frac1W / 2;
        ctx.font = `${subSz}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.fillText(num1, f1cx, cy - 6);
        ctx.beginPath();
        ctx.moveTo(x + 2, cy);
        ctx.lineTo(x + frac1W - 2, cy);
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillText(den1, f1cx, cy + subSz + 2);
        x += frac1W;

        // Dot
        ctx.font = `${mainSz}px ${SERIF}`;
        ctx.textAlign = 'left';
        ctx.fillText(dot, x, cy + mainSz * 0.15);
        x += dotW;

        // Fraction 2: σ_A / IC√BR
        const f2cx = x + frac2W / 2;
        ctx.font = `${subSz}px ${SERIF}`;
        ctx.textAlign = 'center';
        // numerator: σ with subscript A
        const sigW = ctx.measureText('σ').width;
        const numStart = f2cx - (sigW + subAW) / 2;
        ctx.fillText('σ', numStart + sigW / 2, cy - 6);
        ctx.font = `${supSz * 0.75}px ${SERIF}`;
        ctx.textAlign = 'left';
        ctx.fillText('A', numStart + sigW, cy - 3);
        // fraction line
        ctx.beginPath();
        ctx.moveTo(x + 2, cy);
        ctx.lineTo(x + frac2W - 2, cy);
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // denominator: IC√BR
        ctx.font = `${subSz}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.fillText('IC√BR', f2cx, cy + subSz + 2);
    }

    // 8. IC Scatter — predicted vs realized rank
    function drawICScatter() {
        const b = drawAxes('Predicted Rank', 'Realized Rank');
        const plotW = b.right - b.left;
        const plotH = b.bottom - b.top;

        // Generate ~25 dots with positive correlation
        const seed = 42;
        function rand(i) {
            return ((Math.sin(seed + i * 127.1) * 43758.5453) % 1 + 1) % 1;
        }
        const nPts = 25;
        const dots = [];
        for (let i = 0; i < nPts; i++) {
            const px = 0.08 + 0.84 * (i / (nPts - 1));
            const noise = (rand(i) - 0.5) * 0.35;
            const py = Math.max(0.05, Math.min(0.95, px + noise));
            dots.push({ x: b.left + px * plotW, y: b.bottom - py * plotH });
        }

        // Best-fit line (simple: from bottom-left to top-right region)
        const sumX = dots.reduce((s, d) => s + d.x, 0) / nPts;
        const sumY = dots.reduce((s, d) => s + d.y, 0) / nPts;
        let num = 0, den = 0;
        dots.forEach(d => {
            num += (d.x - sumX) * (d.y - sumY);
            den += (d.x - sumX) * (d.x - sumX);
        });
        const m = num / den;
        const bInt = sumY - m * sumX;

        ctx.beginPath();
        ctx.setLineDash([5, 4]);
        ctx.moveTo(b.left, m * b.left + bInt);
        ctx.lineTo(b.right, m * b.right + bInt);
        ctx.strokeStyle = MUTED;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // Dots
        dots.forEach(d => {
            ctx.beginPath();
            ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = DARK;
            ctx.fill();
        });
    }

    // 9. IR vs Breadth — Fundamental Law curves
    function drawIRvsBreadth() {
        const b = drawAxes('Breadth (BR)', 'IR');
        const plotW = b.right - b.left;
        const plotH = b.bottom - b.top;
        const compact = w() < 360;

        const icValues = [
            { ic: 0.02, label: 'IC=0.02' },
            { ic: 0.05, label: 'IC=0.05' },
            { ic: 0.10, label: 'IC=0.10' }
        ];
        const maxBR = 500;
        const maxIR = 0.10 * Math.sqrt(maxBR) * 1.1; // max Y based on highest IC

        const alphas = [0.3, 0.55, 0.85];
        icValues.forEach((cfg, ci) => {
            const n = 60;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const br = (i / n) * maxBR;
                const ir = cfg.ic * Math.sqrt(br);
                const x = b.left + (i / n) * plotW;
                const y = b.bottom - (ir / maxIR) * plotH;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(10, 22, 40, ${alphas[ci]})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label at end of curve
            const endIR = cfg.ic * Math.sqrt(maxBR);
            const endY = b.bottom - (endIR / maxIR) * plotH;
            ctx.fillStyle = `rgba(10, 22, 40, ${alphas[ci]})`;
            ctx.font = `${compact ? 8 : 10}px ${SANS}`;
            ctx.textAlign = 'right';
            ctx.fillText(cfg.label, b.right - 4, endY - 5);
        });
    }

    // 10. Value added vs active risk — concave parabola peaking at ω*
    function drawActiveRiskCurve() {
        const b = drawAxes('', 'Value Added');
        const plotW = b.right - b.left;
        const plotH = b.bottom - b.top;
        const n = 80;
        const pts = [];
        const peakT = 0.45;
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const va = 0.15 + 0.7 * (1 - Math.pow((t - peakT) / 0.55, 2));
            pts.push({ x: b.left + t * plotW, y: b.bottom - Math.max(va, 0.05) * plotH });
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 2;
        ctx.stroke();

        const optX = b.left + peakT * plotW;
        const optY = pts[Math.round(peakT * n)].y;
        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.moveTo(optX, b.bottom);
        ctx.lineTo(optX, optY);
        ctx.strokeStyle = MUTED;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(optX, optY, 4, 0, Math.PI * 2);
        ctx.fillStyle = DARK;
        ctx.fill();

        // Tick label on x-axis
        ctx.beginPath();
        ctx.moveTo(optX, b.bottom);
        ctx.lineTo(optX, b.bottom - 4);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = MUTED;
        ctx.font = `${w() < 360 ? 9 : 10}px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText('ωₐ=ω*', optX, b.bottom + 13);
    }

    // 11. Alpha Decay Curve — exponential decay with half-life
    function drawAlphaDecayCurve() {
        const b = drawAxes('Holding Period (days)', 'Alpha Signal');
        const plotW = b.right - b.left;
        const plotH = b.bottom - b.top;
        const compact = w() < 360;

        // Dashed zero line
        const zeroY = b.bottom - 0.08 * plotH;
        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.moveTo(b.left, zeroY);
        ctx.lineTo(b.right, zeroY);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // Exponential decay: alpha(t) = A * exp(-lambda * t)
        const n = 80;
        const peakY = 0.88;
        const lambda = 3.0;
        const halfLifeT = Math.log(2) / lambda; // ~0.23

        // Shaded region under curve near origin (first 30%)
        const shadeCutoff = Math.round(n * 0.30);
        ctx.beginPath();
        ctx.moveTo(b.left, zeroY);
        for (let i = 0; i <= shadeCutoff; i++) {
            const t = i / n;
            const alpha = peakY * Math.exp(-lambda * t);
            const x = b.left + t * plotW;
            const y = zeroY - alpha * (zeroY - b.top);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(b.left + (shadeCutoff / n) * plotW, zeroY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(10, 22, 40, 0.10)';
        ctx.fill();

        // Curve
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const alpha = peakY * Math.exp(-lambda * t);
            const x = b.left + t * plotW;
            const y = zeroY - alpha * (zeroY - b.top);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Half-life mark
        const hlX = b.left + halfLifeT * plotW;
        const hlAlpha = peakY * Math.exp(-lambda * halfLifeT);
        const hlY = zeroY - hlAlpha * (zeroY - b.top);

        // Tick mark
        ctx.beginPath();
        ctx.moveTo(hlX, zeroY);
        ctx.lineTo(hlX, zeroY - 4);
        ctx.strokeStyle = GRAY;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dashed line up to curve
        ctx.beginPath();
        ctx.setLineDash([3, 2]);
        ctx.moveTo(hlX, zeroY);
        ctx.lineTo(hlX, hlY);
        ctx.strokeStyle = MUTED;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(hlX, hlY, 3, 0, Math.PI * 2);
        ctx.fillStyle = DARK;
        ctx.fill();

        ctx.fillStyle = MUTED;
        ctx.font = `${compact ? 9 : 11}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.fillText('t½', hlX, zeroY + 13);
    }

    // Scene order: theory → risk → factor models → active management
    const scenes = [
        drawEfficientFrontier, drawSML,
        drawNormalDist, drawMonteCarloVaR,
        drawReturnDecomposition, drawReturnTimeSeries,
        drawActiveReturn, drawProportionalWeight, drawICScatter, drawIRvsBreadth, drawActiveRiskCurve,
        drawAlphaDecayCurve
    ];
    let current = 0;
    let cycleStart = performance.now();

    function render(now) {
        const elapsed = now - cycleStart;
        const totalCycle = DISPLAY_TIME + FADE_TIME;

        if (elapsed >= totalCycle) {
            current = (current + 1) % scenes.length;
            cycleStart = now;
        }

        const pos = now - cycleStart;
        ctx.clearRect(0, 0, w(), h());

        if (pos >= DISPLAY_TIME) {
            const t = (pos - DISPLAY_TIME) / FADE_TIME;
            const next = (current + 1) % scenes.length;
            ctx.save();
            ctx.globalAlpha = 1 - t;
            scenes[current]();
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = t;
            scenes[next]();
            ctx.restore();
        } else {
            scenes[current]();
        }

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
})();
