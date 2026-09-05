(function () {
    'use strict';

    const lab = document.getElementById('financeLab');
    const svg = document.getElementById('financeViz');
    const plot = document.getElementById('financePlot');
    if (!lab || !svg || !plot) return;

    const title = document.getElementById('financeTitle');
    const svgTitle = document.getElementById('financeSvgTitle');
    const svgDescription = document.getElementById('financeSvgDescription');
    const caption = document.getElementById('financeCaption');
    const counter = document.getElementById('financeCounter');
    const stage = document.getElementById('financeStage');
    const tooltip = document.getElementById('financeTooltip');
    const control = document.getElementById('financeControl');
    const controlLabel = document.getElementById('financeControlLabel');
    const controlOutput = document.getElementById('financeControlOutput');
    const secondaryParameter = document.getElementById('financeSecondaryParameter');
    const secondaryControl = document.getElementById('financeSecondaryControl');
    const secondaryLabel = document.getElementById('financeSecondaryLabel');
    const secondaryOutput = document.getElementById('financeSecondaryOutput');
    const playButton = lab.querySelector('[data-action="play"]');
    const sceneTabs = Array.from(lab.querySelectorAll('[data-scene]'));

    const NS = 'http://www.w3.org/2000/svg';
    const HEIGHT = 210;
    const AUTO_DELAY = 6500;
    const COLORS = {
        ink: '#0a1628',
        muted: '#626a75',
        axis: '#9ca3af',
        teal: '#2f7e7a',
        tealLight: '#a9cfca',
        amber: '#b57a2b',
        amberLight: '#e5c58f',
        red: '#b85450',
        redLight: '#e6b2ae',
        blue: '#4f6e98',
        blueLight: '#b5c4d8',
        cream: '#f5f0eb'
    };

    let width = 616;
    let currentScene = 0;
    let autoTimer = null;
    let isVisible = true;
    let isHovering = false;
    let hasFocus = false;
    let isDragging = false;
    let activeInteraction = null;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let isPaused = motionPreference.matches;
    const parameters = [0.7, 0.28, 0.72, 0.30, 0.48, { x: 0.62, y: 0.68 }];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function map(value, inMin, inMax, outMin, outMax) {
        return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
    }

    function signed(value, digits, suffix) {
        const rounded = Number(value).toFixed(digits);
        return `${value > 0 ? '+' : ''}${rounded}${suffix || ''}`;
    }

    function make(tag, attributes, textValue) {
        const node = document.createElementNS(NS, tag);
        Object.entries(attributes || {}).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            if (key === 'dataTip') node.dataset.tip = value;
            else if (key === 'dataRegimeSurface') node.dataset.regimeSurface = value;
            else node.setAttribute(key, String(value));
        });
        if (textValue !== undefined) node.textContent = textValue;
        return node;
    }

    function add(parent, tag, attributes, textValue) {
        const node = make(tag, attributes, textValue);
        parent.appendChild(node);
        return node;
    }

    function line(parent, x1, y1, x2, y2, className) {
        return add(parent, 'line', { x1, y1, x2, y2, class: className });
    }

    function label(parent, x, y, textValue, anchor, className) {
        return add(parent, 'text', {
            x,
            y,
            'text-anchor': anchor || 'middle',
            class: className || 'chart-label'
        }, textValue);
    }

    function pathFrom(points) {
        return points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    }

    function drawSignalQuality(group, parameter) {
        const compact = width < 410;
        const bounds = { left: compact ? 38 : 46, right: width - 12, top: compact ? 34 : 22, bottom: 174 };
        const base = [-11, -8.5, -6, -3.5, -1.2, 0.8, 3.2, 6.8, 10.5, 15];
        const scale = 1 - parameter * 0.44;
        const values = base.map(value => value * scale - (value > 0 ? parameter * 0.35 : 0));
        const uncertainty = 1.2 + parameter * 2.1;
        const yMin = -14;
        const yMax = 18;
        const zeroY = map(0, yMin, yMax, bounds.bottom, bounds.top);
        const plotWidth = bounds.right - bounds.left;
        const slot = plotWidth / values.length;
        const barWidth = Math.max(8, slot * 0.58);

        [-10, 0, 10].forEach(tick => {
            const y = map(tick, yMin, yMax, bounds.bottom, bounds.top);
            line(group, bounds.left, y, bounds.right, y, tick === 0 ? 'zero-line' : 'grid');
            label(group, bounds.left - 6, y + 4, signed(tick, 0, ''), 'end');
        });
        label(group, bounds.left, 13, compact ? 'Residual return (bps / mo)' : 'Residual return (bps / month)', 'start', 'chart-note');

        values.forEach((value, index) => {
            const x = bounds.left + slot * index + (slot - barWidth) / 2;
            const valueY = map(value, yMin, yMax, bounds.bottom, bounds.top);
            const top = Math.min(valueY, zeroY);
            const height = Math.max(1, Math.abs(zeroY - valueY));
            const centerX = x + barWidth / 2;
            const highY = map(value + uncertainty, yMin, yMax, bounds.bottom, bounds.top);
            const lowY = map(value - uncertainty, yMin, yMax, bounds.bottom, bounds.top);
            const tip = `Decile ${index + 1}: ${signed(value, 1, ' bps/month')} illustrative residual return`;

            add(group, 'rect', {
                x,
                y: top,
                width: barWidth,
                height,
                rx: 1.5,
                fill: value >= 0 ? COLORS.teal : COLORS.red,
                opacity: 0.82,
                class: 'mark',
                dataTip: tip
            });
            line(group, centerX, highY, centerX, lowY, 'axis');
            line(group, centerX - 3, highY, centerX + 3, highY, 'axis');
            line(group, centerX - 3, lowY, centerX + 3, lowY, 'axis');
            if (!compact || index % 2 === 0 || index === values.length - 1) {
                label(group, centerX, 192, `D${index + 1}`);
            }
        });

        const spread = values[values.length - 1] - values[0];
        label(group, bounds.right, compact ? 28 : 13, `Top–bottom spread ${spread.toFixed(1)} bps`, 'end', 'chart-value');

        const lens = parameter < 0.33 ? 'In-sample' : parameter < 0.67 ? 'Cross-validated' : 'Out-of-sample, net';
        return {
            output: lens,
            description: `Illustrative decile residual returns under the ${lens.toLowerCase()} evidence lens. The top-minus-bottom spread is ${spread.toFixed(1)} basis points per month.`,
            caption: parameter < 0.67
                ? 'Promising research can look orderly before holdouts, costs, and implementation frictions are introduced.'
                : 'The ordering survives, but the spread compresses once the evidence is made more realistic.',
            interaction: { x0: bounds.left, x1: bounds.right }
        };
    }

    function drawAlphaDecay(group, parameter) {
        const compact = width < 410;
        const bounds = { left: compact ? 38 : 46, right: width - 18, top: compact ? 36 : 25, bottom: 174 };
        const delay = Math.round(parameter * 20);
        const curves = [
            { name: 'Event', halfLife: 5, color: COLORS.red },
            { name: 'Revision', halfLife: 15, color: COLORS.amber },
            { name: 'Value', halfLife: 40, color: COLORS.teal }
        ];

        [0, 50, 100].forEach(tick => {
            const y = map(tick, 0, 100, bounds.bottom, bounds.top);
            line(group, bounds.left, y, bounds.right, y, tick === 0 ? 'axis' : 'grid');
            label(group, bounds.left - 6, y + 4, `${tick}%`, 'end');
        });
        [0, 20, 40, 60].forEach(tick => {
            const x = map(tick, 0, 60, bounds.left, bounds.right);
            label(group, x, 193, `${tick}d`);
        });
        label(group, bounds.left, 13, 'Signal remaining after publication', 'start', 'chart-note');

        curves.forEach((curve, curveIndex) => {
            const points = [];
            for (let day = 0; day <= 60; day += 1) {
                const remaining = 100 * Math.exp((-Math.log(2) * day) / curve.halfLife);
                points.push({
                    x: map(day, 0, 60, bounds.left, bounds.right),
                    y: map(remaining, 0, 100, bounds.bottom, bounds.top)
                });
            }
            add(group, 'path', {
                d: pathFrom(points),
                fill: 'none',
                stroke: curve.color,
                'stroke-width': 2.2,
                'vector-effect': 'non-scaling-stroke',
                class: 'mark'
            });
            const legendX = bounds.right - (compact ? 112 : 142) + curveIndex * (compact ? 38 : 48);
            const legendY = compact ? 28 : 17;
            add(group, 'line', {
                x1: legendX,
                y1: legendY,
                x2: legendX + 12,
                y2: legendY,
                stroke: curve.color,
                'stroke-width': 2,
                'vector-effect': 'non-scaling-stroke'
            });
            label(group, legendX + 15, legendY + 3, compact ? curve.name.slice(0, 3) : curve.name, 'start');
        });

        const delayX = map(delay, 0, 60, bounds.left, bounds.right);
        add(group, 'rect', {
            x: bounds.left,
            y: bounds.top,
            width: Math.max(0, delayX - bounds.left),
            height: bounds.bottom - bounds.top,
            fill: COLORS.ink,
            opacity: 0.035
        });
        line(group, delayX, bounds.top, delayX, bounds.bottom, 'zero-line');
        label(group, delayX + 5, bounds.top + 12, 'implementation', 'start');

        curves.forEach(curve => {
            const remaining = 100 * Math.exp((-Math.log(2) * delay) / curve.halfLife);
            const y = map(remaining, 0, 100, bounds.bottom, bounds.top);
            add(group, 'circle', {
                cx: delayX,
                cy: y,
                r: 4,
                fill: curve.color,
                stroke: COLORS.cream,
                'stroke-width': 1.5,
                dataTip: `${curve.name} signal: ${remaining.toFixed(0)}% remains after ${delay} trading days`
            });
        });

        const fastRemaining = 100 * Math.exp((-Math.log(2) * delay) / curves[0].halfLife);
        return {
            output: `${delay} trading ${delay === 1 ? 'day' : 'days'}`,
            description: `Three illustrative alpha signals decay at different speeds. After an implementation delay of ${delay} trading days, the fast event signal retains ${fastRemaining.toFixed(0)} percent of its initial strength.`,
            caption: `At a ${delay}-day delay, a fast event signal retains only ${fastRemaining.toFixed(0)}% of its initial strength; slower signals tolerate more patient execution.`,
            interaction: { x0: bounds.left, x1: map(20, 0, 60, bounds.left, bounds.right) }
        };
    }

    function drawPositionSizing(group, parameter) {
        const compact = width < 410;
        const bounds = { left: compact ? 38 : 46, right: width - 18, top: 24, bottom: 174 };
        const securities = [
            { name: 'A', alpha: -108, risk: 1.5, liquidity: 0.72, factor: -0.9 },
            { name: 'B', alpha: -82, risk: 0.8, liquidity: 0.90, factor: -0.1 },
            { name: 'C', alpha: -62, risk: 1.7, liquidity: 0.48, factor: 0.8 },
            { name: 'D', alpha: -35, risk: 1.1, liquidity: 0.62, factor: -0.5 },
            { name: 'E', alpha: -14, risk: 0.6, liquidity: 0.95, factor: 0.2 },
            { name: 'F', alpha: 12, risk: 1.4, liquidity: 0.46, factor: 0.7 },
            { name: 'G', alpha: 29, risk: 0.7, liquidity: 0.82, factor: -0.2 },
            { name: 'H', alpha: 48, risk: 1.8, liquidity: 0.38, factor: 0.9 },
            { name: 'I', alpha: 66, risk: 1.0, liquidity: 0.74, factor: 0.1 },
            { name: 'J', alpha: 84, risk: 1.5, liquidity: 0.52, factor: -0.7 },
            { name: 'K', alpha: 101, risk: 0.8, liquidity: 0.88, factor: 0.3 },
            { name: 'L', alpha: 116, risk: 1.9, liquidity: 0.33, factor: 0.95 }
        ];

        const x = value => map(value, -120, 120, bounds.left, bounds.right);
        const y = value => map(value, -4, 4, bounds.bottom, bounds.top);
        add(group, 'rect', {
            x: bounds.left,
            y: y(2.5),
            width: bounds.right - bounds.left,
            height: y(-2.5) - y(2.5),
            fill: COLORS.teal,
            opacity: 0.045
        });
        line(group, x(0), bounds.top, x(0), bounds.bottom, 'zero-line');
        line(group, bounds.left, y(0), bounds.right, y(0), 'zero-line');
        [-100, 0, 100].forEach(tick => label(group, x(tick), 193, signed(tick, 0, ' bps')));
        [-4, -2, 0, 2, 4].forEach(tick => label(group, bounds.left - 6, y(tick) + 4, signed(tick, 0, '%'), 'end'));
        label(group, bounds.left, 13, 'Expected residual return → active weight', 'start', 'chart-note');

        let grossExposure = 0;
        securities.forEach(security => {
            const rawWeight = security.alpha / 30;
            const constructedWeight = (security.alpha / 46) / (0.72 + 0.48 * security.risk)
                - security.factor * 0.28;
            const activeWeight = clamp(rawWeight * (1 - parameter) + constructedWeight * parameter, -4, 4);
            grossExposure += Math.abs(activeWeight);
            const color = security.factor < -0.3 ? COLORS.blue
                : security.factor > 0.3 ? COLORS.amber : COLORS.teal;
            const radius = 4 + security.liquidity * 4.5;
            add(group, 'circle', {
                cx: x(security.alpha),
                cy: y(activeWeight),
                r: radius,
                fill: color,
                opacity: 0.82,
                stroke: COLORS.cream,
                'stroke-width': 1.4,
                class: 'mark',
                dataTip: `${security.name}: forecast ${signed(security.alpha, 0, ' bps')}; active weight ${signed(activeWeight, 1, '%')}; ${security.liquidity > 0.7 ? 'higher' : 'lower'} liquidity`
            });
        });

        const legendY = compact ? 205 : 204;
        [
            { color: COLORS.blue, text: 'defensive tilt' },
            { color: COLORS.teal, text: 'neutral' },
            { color: COLORS.amber, text: 'cyclical tilt' }
        ].forEach((item, index) => {
            const start = compact ? 38 + index * 88 : width - 315 + index * 102;
            add(group, 'circle', { cx: start, cy: legendY - 3, r: 3.5, fill: item.color });
            label(group, start + 7, legendY, compact ? item.text.split(' ')[0] : item.text, 'start');
        });

        const state = parameter < 0.28 ? 'Raw conviction'
            : parameter < 0.72 ? 'Risk-adjusted' : 'Fully constrained';
        return {
            output: state,
            description: `Illustrative expected residual returns are translated into active weights under ${state.toLowerCase()} portfolio construction. Bubble size represents liquidity and color represents a factor tilt.`,
            caption: `The same research produces ${grossExposure.toFixed(1)}% gross active weight after risk, liquidity, and factor constraints reshape conviction.`,
            interaction: { x0: bounds.left, x1: bounds.right }
        };
    }

    function drawEffectiveBreadth(group, parameter) {
        const compact = width < 410;
        const count = 8;
        const matrixSize = compact ? Math.min(145, width * 0.47) : 158;
        const matrixX = compact ? 27 : 42;
        const matrixY = 27;
        const cell = matrixSize / count;
        const clusters = [0, 0, 1, 1, 1, 2, 2, 3];
        const names = compact ? ['V', 'Q', 'M', 'R', 'E', 'A', 'F', 'S']
            : ['Val', 'Qual', 'Mom', 'Rev', 'Est', 'Alt', 'Flow', 'Sent'];
        let correlationTotal = 0;
        let pairs = 0;

        for (let row = 0; row < count; row += 1) {
            for (let column = 0; column < count; column += 1) {
                const sameCluster = clusters[row] === clusters[column];
                const rho = row === column ? 1 : clamp(parameter * (sameCluster ? 1.12 : 0.56), 0, 0.92);
                if (column > row) {
                    correlationTotal += rho;
                    pairs += 1;
                }
                add(group, 'rect', {
                    x: matrixX + column * cell,
                    y: matrixY + row * cell,
                    width: cell - 1,
                    height: cell - 1,
                    rx: 1,
                    fill: COLORS.teal,
                    opacity: 0.08 + rho * 0.84,
                    dataTip: row === column ? `${names[row]} with itself`
                        : `${names[row]} / ${names[column]} overlap: ${(rho * 100).toFixed(0)}%`
                });
            }
            label(group, matrixX - 5, matrixY + row * cell + cell * 0.7, names[row], 'end');
            label(group, matrixX + row * cell + cell * 0.5, matrixY - 6, names[row], 'middle');
        }

        const averageCorrelation = correlationTotal / pairs;
        const effective = count / (1 + (count - 1) * averageCorrelation);
        const summaryX = matrixX + matrixSize + (compact ? 18 : 34);
        const summaryRight = width - 16;
        const barWidth = Math.max(45, summaryRight - summaryX);
        const effectiveWidth = barWidth * (effective / count);
        label(group, summaryX, 42, 'Signals counted', 'start', 'chart-note');
        add(group, 'rect', { x: summaryX, y: 52, width: barWidth, height: 18, rx: 2, fill: COLORS.blueLight });
        label(group, summaryRight - 5, 66, `${count}`, 'end', 'chart-value');
        label(group, summaryX, 102, 'Independent bets', 'start', 'chart-note');
        add(group, 'rect', { x: summaryX, y: 112, width: barWidth, height: 18, rx: 2, fill: COLORS.ink, opacity: 0.09 });
        add(group, 'rect', { x: summaryX, y: 112, width: effectiveWidth, height: 18, rx: 2, fill: COLORS.teal });
        label(group, summaryRight - 5, 126, effective.toFixed(1), 'end', 'chart-value');
        label(group, summaryX, 158, compact ? 'Overlap reduces breadth' : 'More rows do not guarantee more breadth', 'start');

        return {
            output: `${(averageCorrelation * 100).toFixed(0)}% average overlap`,
            description: `An illustrative correlation matrix of eight research signals has ${effective.toFixed(1)} effective independent bets at ${(averageCorrelation * 100).toFixed(0)} percent average overlap.`,
            caption: `Eight signals become roughly ${effective.toFixed(1)} independent bets once common information and correlated decisions are recognized.`,
            interaction: { x0: matrixX, x1: matrixX + matrixSize }
        };
    }

    function drawRiskAllocation(group, parameter) {
        const compact = width < 410;
        const correlation = -0.15 + parameter * 0.8;
        const equityWeight = 0.6;
        const bondWeight = 0.4;
        const equityVolatility = 0.15;
        const bondVolatility = 0.05;
        const covariance = correlation * equityVolatility * bondVolatility;
        const equityContribution = equityWeight * (
            equityWeight * equityVolatility * equityVolatility + bondWeight * covariance
        );
        const bondContribution = bondWeight * (
            bondWeight * bondVolatility * bondVolatility + equityWeight * covariance
        );
        const portfolioVariance = equityContribution + bondContribution;
        const equityRiskShare = clamp(equityContribution / portfolioVariance, 0, 1);
        const bondRiskShare = 1 - equityRiskShare;
        const portfolioVolatility = Math.sqrt(portfolioVariance) * 100;
        const left = compact ? 58 : 78;
        const right = width - 18;
        const fullWidth = right - left;

        label(group, left, 24, 'A 60 / 40 portfolio, viewed two ways', 'start', 'chart-note');
        const bars = [
            { y: 55, name: 'Capital', equity: 0.6, bonds: 0.4 },
            { y: 118, name: 'Risk', equity: equityRiskShare, bonds: bondRiskShare }
        ];
        bars.forEach(bar => {
            label(group, left - 9, bar.y + 22, bar.name, 'end', 'chart-note');
            add(group, 'rect', {
                x: left,
                y: bar.y,
                width: fullWidth * bar.equity,
                height: 34,
                rx: 2,
                fill: COLORS.teal,
                dataTip: `Equities: ${(bar.equity * 100).toFixed(0)}% of ${bar.name.toLowerCase()}`
            });
            add(group, 'rect', {
                x: left + fullWidth * bar.equity,
                y: bar.y,
                width: fullWidth * bar.bonds,
                height: 34,
                rx: 2,
                fill: COLORS.blue,
                dataTip: `Bonds: ${(bar.bonds * 100).toFixed(0)}% of ${bar.name.toLowerCase()}`
            });
            if (bar.equity > 0.15) label(group, left + fullWidth * bar.equity / 2, bar.y + 22, `${(bar.equity * 100).toFixed(0)}%`, 'middle', 'chart-on-color');
            if (bar.bonds > 0.15) label(group, left + fullWidth * (bar.equity + bar.bonds / 2), bar.y + 22, `${(bar.bonds * 100).toFixed(0)}%`, 'middle', 'chart-on-color');
        });
        add(group, 'rect', { x: left, y: 177, width: 10, height: 10, rx: 1, fill: COLORS.teal });
        label(group, left + 15, 186, 'Equities', 'start');
        add(group, 'rect', { x: left + 82, y: 177, width: 10, height: 10, rx: 1, fill: COLORS.blue });
        label(group, left + 97, 186, 'Bonds', 'start');
        label(group, right, compact ? 205 : 186, `Portfolio volatility ${portfolioVolatility.toFixed(1)}%`, 'end', 'chart-value');

        return {
            output: `ρ = ${signed(correlation, 2, '')}`,
            description: `A portfolio with 60 percent of capital in equities has ${(equityRiskShare * 100).toFixed(0)} percent of risk attributed to equities at a stock-bond correlation of ${correlation.toFixed(2)}.`,
            caption: `At this correlation, equities contribute ${(equityRiskShare * 100).toFixed(0)}% of portfolio risk despite receiving 60% of capital.`,
            interaction: { x0: left, x1: right }
        };
    }

    function drawRegimeStress(group, parameter) {
        const compact = width < 410;
        const matrixSize = compact ? 132 : 154;
        const matrixX = compact ? 24 : 38;
        const matrixY = 30;
        const growth = parameter.x * 2 - 1;
        const inflation = parameter.y * 2 - 1;
        const xWeight = (growth + 1) / 2;
        const yWeight = (inflation + 1) / 2;
        const profiles = {
            deflation: [-4.8, 2.4, -1.2, 0.2],
            goldilocks: [2.2, 0.8, 0.4, 0.3],
            stagflation: [-5.8, -2.6, -1.6, 2.0],
            reflation: [1.0, -1.8, -0.5, 1.4]
        };
        const contributions = profiles.deflation.map((_, index) => (
            profiles.deflation[index] * (1 - xWeight) * (1 - yWeight)
            + profiles.goldilocks[index] * xWeight * (1 - yWeight)
            + profiles.stagflation[index] * (1 - xWeight) * yWeight
            + profiles.reflation[index] * xWeight * yWeight
        ));
        const total = contributions.reduce((sum, value) => sum + value, 0);

        const quadrants = [
            { x: matrixX, y: matrixY, label: 'Stagflation', fill: COLORS.redLight },
            { x: matrixX + matrixSize / 2, y: matrixY, label: 'Reflation', fill: COLORS.amberLight },
            { x: matrixX, y: matrixY + matrixSize / 2, label: compact ? 'Deflation' : 'Growth shock', fill: COLORS.blueLight },
            { x: matrixX + matrixSize / 2, y: matrixY + matrixSize / 2, label: 'Goldilocks', fill: COLORS.tealLight }
        ];
        quadrants.forEach(quadrant => {
            add(group, 'rect', {
                x: quadrant.x,
                y: quadrant.y,
                width: matrixSize / 2 - 1,
                height: matrixSize / 2 - 1,
                fill: quadrant.fill,
                opacity: 0.48
            });
            label(group, quadrant.x + matrixSize / 4, quadrant.y + matrixSize / 4 + 4, quadrant.label);
        });
        line(group, matrixX + matrixSize / 2, matrixY, matrixX + matrixSize / 2, matrixY + matrixSize, 'axis');
        line(group, matrixX, matrixY + matrixSize / 2, matrixX + matrixSize, matrixY + matrixSize / 2, 'axis');
        add(group, 'rect', {
            x: matrixX,
            y: matrixY,
            width: matrixSize,
            height: matrixSize,
            fill: 'transparent',
            dataRegimeSurface: 'true'
        });
        const pointX = map(growth, -1, 1, matrixX, matrixX + matrixSize);
        const pointY = map(inflation, -1, 1, matrixY + matrixSize, matrixY);
        add(group, 'circle', { cx: pointX, cy: pointY, r: 7, fill: COLORS.ink, stroke: COLORS.cream, 'stroke-width': 2 });
        label(group, matrixX + matrixSize / 2, 201, 'Growth surprise →');
        const inflationAxisX = compact ? 12 : 10;
        const inflationLabel = label(group, inflationAxisX, matrixY + matrixSize / 2, 'Inflation surprise →', 'middle');
        inflationLabel.setAttribute('transform', `rotate(-90 ${inflationAxisX} ${matrixY + matrixSize / 2})`);

        const regionX = matrixX + matrixSize + (compact ? 16 : 34);
        const regionRight = width - 12;
        const labelWidth = compact ? 42 : 56;
        const plotLeft = regionX + labelWidth;
        const plotWidth = Math.max(48, regionRight - plotLeft);
        const zeroX = plotLeft + plotWidth * 0.52;
        const halfWidth = Math.min(zeroX - plotLeft, regionRight - zeroX);
        const names = compact ? ['Eq.', 'Rates', 'Credit', 'Real'] : ['Equities', 'Rates', 'Credit', 'Real assets'];
        label(group, regionX, 20, `Portfolio ${signed(total, 1, '%')}`, 'start', 'chart-value');
        line(group, zeroX, 34, zeroX, 170, 'zero-line');

        contributions.forEach((value, index) => {
            const y = 48 + index * 34;
            const length = clamp(Math.abs(value) / 6.5, 0, 1) * halfWidth;
            label(group, regionX, y + 5, names[index], 'start');
            add(group, 'rect', {
                x: value >= 0 ? zeroX : zeroX - length,
                y: y - 8,
                width: Math.max(1, length),
                height: 16,
                rx: 2,
                fill: value >= 0 ? COLORS.teal : COLORS.red,
                opacity: 0.86,
                dataTip: `${names[index]} contribution: ${signed(value, 1, '%')}`
            });
            label(group, value >= 0 ? zeroX + length + 4 : zeroX - length - 4, y + 4,
                signed(value, 1, '%'), value >= 0 ? 'start' : 'end');
        });

        const regime = inflation >= 0
            ? (growth >= 0 ? 'Reflation' : 'Stagflation')
            : (growth >= 0 ? 'Goldilocks' : 'Growth shock');
        return {
            output: growth > 0.18 ? 'Rising' : growth < -0.18 ? 'Falling' : 'Neutral',
            secondaryOutput: inflation > 0.18 ? 'Rising' : inflation < -0.18 ? 'Falling' : 'Neutral',
            description: `An illustrative ${regime.toLowerCase()} regime produces a hypothetical portfolio return of ${signed(total, 1, '%')}, decomposed across equities, rates, credit, and real assets.`,
            caption: `${regime}: correlated factor moves produce an illustrative portfolio result of ${signed(total, 1, '%')}. Drag the regime map to stress a different combination.`,
            interaction: {
                x0: matrixX,
                x1: matrixX + matrixSize,
                y0: matrixY,
                y1: matrixY + matrixSize,
                twoDimensional: true
            }
        };
    }

    const scenes = [
        {
            title: 'Does the signal travel?',
            controlLabel: 'Evidence lens',
            render: drawSignalQuality
        },
        {
            title: 'Alpha has a shelf life',
            controlLabel: 'Implementation delay',
            render: drawAlphaDecay
        },
        {
            title: 'From conviction to position',
            controlLabel: 'Construction discipline',
            render: drawPositionSizing
        },
        {
            title: 'Ten ideas—or three bets?',
            controlLabel: 'Signal overlap',
            render: drawEffectiveBreadth
        },
        {
            title: 'Capital is not risk',
            controlLabel: 'Stock–bond correlation',
            render: drawRiskAllocation
        },
        {
            title: 'What breaks the portfolio?',
            controlLabel: 'Growth surprise',
            secondaryLabel: 'Inflation surprise',
            render: drawRegimeStress
        }
    ];

    function updateControls(scene, result) {
        const parameter = parameters[currentScene];
        controlLabel.textContent = scene.controlLabel;
        control.value = String(Math.round((typeof parameter === 'number' ? parameter : parameter.x) * 100));
        controlOutput.textContent = result.output;
        const hasSecondary = typeof parameter === 'object';
        secondaryParameter.hidden = !hasSecondary;
        if (hasSecondary) {
            secondaryLabel.textContent = scene.secondaryLabel;
            secondaryControl.value = String(Math.round(parameter.y * 100));
            secondaryOutput.textContent = result.secondaryOutput;
        }
    }

    function render(animate) {
        const scene = scenes[currentScene];
        const group = make('g', {});
        const result = scene.render(group, parameters[currentScene]);
        plot.replaceChildren(...Array.from(group.childNodes));
        activeInteraction = result.interaction;

        title.textContent = scene.title;
        svgTitle.textContent = scene.title;
        svgDescription.textContent = result.description;
        caption.textContent = result.caption;
        counter.textContent = `${currentScene + 1} / ${scenes.length}`;
        updateControls(scene, result);
        sceneTabs.forEach((tab, index) => tab.setAttribute('aria-current', index === currentScene ? 'true' : 'false'));

        if (animate && !motionPreference.matches) {
            plot.animate(
                [
                    { opacity: 0.15, transform: 'translateY(3px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ],
                { duration: 340, easing: 'ease-out' }
            );
        }
    }

    function clearAutoTimer() {
        if (autoTimer !== null) window.clearTimeout(autoTimer);
        autoTimer = null;
    }

    function scheduleAuto() {
        clearAutoTimer();
        if (isPaused || motionPreference.matches || document.hidden || !isVisible || isHovering || hasFocus) return;
        autoTimer = window.setTimeout(() => {
            currentScene = (currentScene + 1) % scenes.length;
            render(true);
            scheduleAuto();
        }, AUTO_DELAY);
    }

    function updatePlayButton() {
        playButton.textContent = isPaused ? 'Play' : 'Pause';
        playButton.setAttribute('aria-label', isPaused ? 'Play animation' : 'Pause animation');
    }

    function pauseForInteraction() {
        isPaused = true;
        clearAutoTimer();
        updatePlayButton();
    }

    function showScene(index, fromUser) {
        currentScene = (index + scenes.length) % scenes.length;
        hideTooltip();
        if (fromUser) pauseForInteraction();
        render(true);
        scheduleAuto();
    }

    function updatePrimaryParameter(value, fromUser) {
        const normalized = clamp(value / 100, 0, 1);
        if (typeof parameters[currentScene] === 'number') parameters[currentScene] = normalized;
        else parameters[currentScene].x = normalized;
        if (fromUser) pauseForInteraction();
        render(false);
    }

    function updateSecondaryParameter(value, fromUser) {
        if (typeof parameters[currentScene] !== 'object') return;
        parameters[currentScene].y = clamp(value / 100, 0, 1);
        if (fromUser) pauseForInteraction();
        render(false);
    }

    function pointerPosition(event) {
        const rect = svg.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (width / rect.width),
            y: (event.clientY - rect.top) * (HEIGHT / rect.height)
        };
    }

    function updateFromPointer(event) {
        if (!activeInteraction) return;
        const point = pointerPosition(event);
        const xValue = clamp((point.x - activeInteraction.x0) / (activeInteraction.x1 - activeInteraction.x0), 0, 1);
        if (activeInteraction.twoDimensional) {
            const yValue = 1 - clamp((point.y - activeInteraction.y0) / (activeInteraction.y1 - activeInteraction.y0), 0, 1);
            parameters[currentScene].x = xValue;
            parameters[currentScene].y = yValue;
        } else {
            parameters[currentScene] = xValue;
        }
        pauseForInteraction();
        render(false);
    }

    function hideTooltip() {
        tooltip.hidden = true;
    }

    function showTooltip(event) {
        if (isDragging) return;
        const target = event.target.closest('[data-tip]');
        if (!target) {
            hideTooltip();
            return;
        }
        const rect = stage.getBoundingClientRect();
        const x = clamp(event.clientX - rect.left, 90, rect.width - 90);
        const y = clamp(event.clientY - rect.top, 38, rect.height - 8);
        tooltip.textContent = target.dataset.tip;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.hidden = false;
    }

    lab.querySelector('[data-action="previous"]').addEventListener('click', () => showScene(currentScene - 1, true));
    lab.querySelector('[data-action="next"]').addEventListener('click', () => showScene(currentScene + 1, true));
    playButton.addEventListener('click', () => {
        isPaused = !isPaused;
        updatePlayButton();
        scheduleAuto();
    });
    sceneTabs.forEach(tab => {
        tab.addEventListener('click', () => showScene(Number(tab.dataset.scene), true));
    });
    control.addEventListener('input', event => updatePrimaryParameter(Number(event.target.value), true));
    secondaryControl.addEventListener('input', event => updateSecondaryParameter(Number(event.target.value), true));

    svg.addEventListener('pointerdown', event => {
        const point = pointerPosition(event);
        if (!activeInteraction) return;
        const insideX = point.x >= activeInteraction.x0 && point.x <= activeInteraction.x1;
        const insideY = !activeInteraction.twoDimensional
            || (point.y >= activeInteraction.y0 && point.y <= activeInteraction.y1);
        if (!insideX || !insideY) return;
        isDragging = true;
        hideTooltip();
        svg.setPointerCapture(event.pointerId);
        updateFromPointer(event);
    });
    svg.addEventListener('pointermove', event => {
        if (isDragging) updateFromPointer(event);
        else showTooltip(event);
    });
    svg.addEventListener('pointerup', event => {
        isDragging = false;
        if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    });
    svg.addEventListener('pointercancel', () => { isDragging = false; });
    svg.addEventListener('pointerleave', hideTooltip);

    lab.addEventListener('mouseenter', () => {
        isHovering = true;
        clearAutoTimer();
    });
    lab.addEventListener('mouseleave', () => {
        isHovering = false;
        scheduleAuto();
    });
    lab.addEventListener('focusin', () => {
        hasFocus = true;
        clearAutoTimer();
    });
    lab.addEventListener('focusout', event => {
        if (lab.contains(event.relatedTarget)) return;
        hasFocus = false;
        scheduleAuto();
    });
    lab.addEventListener('keydown', event => {
        if (event.target.matches('input[type="range"]')) return;
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            showScene(currentScene - 1, true);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            showScene(currentScene + 1, true);
        }
    });

    document.addEventListener('visibilitychange', scheduleAuto);
    motionPreference.addEventListener('change', () => {
        if (motionPreference.matches) isPaused = true;
        updatePlayButton();
        render(false);
        scheduleAuto();
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            isVisible = entries[0].isIntersecting;
            scheduleAuto();
        }, { threshold: 0.15 });
        observer.observe(lab);
    }

    if ('ResizeObserver' in window) {
        let resizeFrame = null;
        const resizeObserver = new ResizeObserver(() => {
            if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = null;
                const nextWidth = Math.max(280, Math.round(svg.getBoundingClientRect().width));
                if (nextWidth === width) return;
                width = nextWidth;
                svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`);
                render(false);
            });
        });
        resizeObserver.observe(svg);
    }

    width = Math.max(280, Math.round(svg.getBoundingClientRect().width || width));
    svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`);
    updatePlayButton();
    render(false);
    scheduleAuto();
})();
