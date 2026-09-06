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
    const parameters = [0.65, 0.30, 0.48, { x: 0.62, y: 0.68 }];

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

    function mean(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function make(tag, attributes, textValue) {
        const node = document.createElementNS(NS, tag);
        Object.entries(attributes || {}).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            if (key === 'dataTip') node.dataset.tip = value;
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
        const bounds = { left: compact ? 36 : 44, right: width - 12, top: 34, bottom: 150 };
        const values = [
            0.06, 0.08, 0.05, 0.09, 0.07, 0.11, 0.04, 0.08,
            0.06, 0.10, 0.07, 0.05, 0.09, 0.06, 0.08, 0.04,
            0.07, 0.06, 0.05, 0.03, 0.04, 0.02, 0.05, 0.01,
            0.03, -0.01, 0.04, 0.02, 0.00, 0.03, 0.01, 0.02
        ];
        const split = Math.round(map(parameter, 0, 1, 12, 24));
        const inSampleMean = mean(values.slice(0, split));
        const outSampleValues = values.slice(split);
        const outSampleMean = mean(outSampleValues);
        const x = index => map(index, 0, values.length - 1, bounds.left, bounds.right);
        const y = value => map(value, -0.02, 0.12, bounds.bottom, bounds.top);
        const splitX = (x(split - 1) + x(split)) / 2;

        add(group, 'rect', {
            x: splitX,
            y: bounds.top,
            width: bounds.right - splitX,
            height: bounds.bottom - bounds.top,
            fill: COLORS.teal,
            opacity: 0.055
        });
        [-0.02, 0, 0.05, 0.10].forEach(tick => {
            const tickY = y(tick);
            line(group, bounds.left, tickY, bounds.right, tickY, tick === 0 ? 'zero-line' : 'grid');
            label(group, bounds.left - 6, tickY + 4, signed(tick, 2, ''), 'end');
        });
        label(group, bounds.left, 13, compact ? 'Monthly rank IC' : 'Monthly cross-sectional rank IC', 'start', 'chart-note');
        label(group, (bounds.left + splitX) / 2, 27,
            `${compact ? 'IS' : 'In-sample'} ${signed(inSampleMean, 2, '')}`, 'middle', 'chart-note');
        label(group, (splitX + bounds.right) / 2, 27,
            `${compact ? 'OOS' : 'Out-of-sample'} ${signed(outSampleMean, 2, '')}`, 'middle', 'chart-note');

        const inSamplePoints = values.slice(0, split).map((value, index) => ({ x: x(index), y: y(value) }));
        const outSamplePoints = values.slice(split - 1).map((value, index) => ({ x: x(index + split - 1), y: y(value) }));
        [
            { points: inSamplePoints, color: COLORS.blue },
            { points: outSamplePoints, color: COLORS.teal }
        ].forEach(series => add(group, 'path', {
            d: pathFrom(series.points),
            fill: 'none',
            stroke: series.color,
            'stroke-width': 2,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
            'vector-effect': 'non-scaling-stroke',
            class: 'mark'
        }));
        values.forEach((value, index) => add(group, 'circle', {
            cx: x(index),
            cy: y(value),
            r: compact ? 2.2 : 2.7,
            fill: index < split ? COLORS.blue : COLORS.teal,
            stroke: COLORS.cream,
            'stroke-width': 1,
            dataTip: `Month ${index + 1}: rank IC ${signed(value, 2, '')}; ${index < split ? 'in-sample' : 'out-of-sample'}`
        }));
        line(group, splitX, bounds.top, splitX, bounds.bottom, 'zero-line');
        label(group, bounds.left, 168, 'M1', 'start');
        label(group, splitX, 168, `M${split}`, 'middle');
        label(group, bounds.right, 168, `M${values.length}`, 'end');

        line(group, bounds.left, 179, bounds.right, 179, 'grid');
        if (compact) {
            label(group, bounds.left, 198, 'Signal +1.00', 'start', 'chart-note');
            label(group, bounds.right, 198, 'Controls  0.00', 'end', 'chart-note');
        } else {
            const exposures = ['Target signal  +1.00', 'Market  0.00', 'Size  0.00', 'Value  0.00', 'Momentum  0.00'];
            exposures.forEach((textValue, index) => {
                const exposureX = map(index, 0, exposures.length - 1, bounds.left, bounds.right);
                const anchor = index === 0 ? 'start' : index === exposures.length - 1 ? 'end' : 'middle';
                label(group, exposureX, 198, textValue, anchor, index === 0 ? 'chart-note' : 'chart-label');
            });
        }

        return {
            output: `Month ${split}`,
            description: `Monthly rank IC averages ${inSampleMean.toFixed(2)} in-sample and ${outSampleMean.toFixed(2)} out-of-sample. The factor-mimicking portfolio has exposure 1.00 to the signal and 0.00 to market, size, value, and momentum.`,
            caption: `Mean IC is ${signed(inSampleMean, 2, '')} in-sample and ${signed(outSampleMean, 2, '')} out-of-sample. Portfolio exposures are signal 1.00 and controls 0.00.`,
            interaction: { x0: bounds.left, x1: bounds.right }
        };
    }

    function drawEffectiveBreadth(group, parameter) {
        const compact = width < 410;
        const count = 8;
        const matrixSize = compact ? Math.min(132, width * 0.46) : 136;
        const matrixX = compact ? 36 : 62;
        const matrixY = 64;
        const cell = matrixSize / count;
        const clusters = [0, 0, 1, 1, 1, 2, 2, 3];
        const names = ['Value', 'Quality', 'Momentum', 'Revisions', 'Estimates', 'Alt data', 'Flows', 'Sentiment'];
        const rowNames = compact ? ['Val', 'Qual', 'Mom', 'Rev', 'Est', 'Alt', 'Flow', 'Sent'] : names;
        const columnNames = ['Val', 'Qual', 'Mom', 'Rev', 'Est', 'Alt', 'Flow', 'Sent'];
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
            label(group, matrixX - 5, matrixY + row * cell + cell * 0.7, rowNames[row], 'end');
        }
        columnNames.forEach((name, column) => {
            const columnX = matrixX + column * cell + cell * 0.5;
            const columnY = 48;
            const columnLabel = label(group, columnX, columnY, name, 'end');
            columnLabel.setAttribute('transform', `rotate(-52 ${columnX} ${columnY})`);
        });

        const averageCorrelation = correlationTotal / pairs;
        const effective = count / (1 + (count - 1) * averageCorrelation);
        const summaryX = matrixX + matrixSize + (compact ? 16 : 34);
        const summaryRight = width - 16;
        const barWidth = Math.max(45, summaryRight - summaryX);
        const effectiveWidth = barWidth * (effective / count);
        label(group, summaryX, 62, 'Signals counted', 'start', 'chart-note');
        add(group, 'rect', { x: summaryX, y: 72, width: barWidth, height: 18, rx: 2, fill: COLORS.blueLight });
        label(group, summaryRight - 5, 86, `${count}`, 'end', 'chart-value');
        label(group, summaryX, 122, 'Independent bets', 'start', 'chart-note');
        add(group, 'rect', { x: summaryX, y: 132, width: barWidth, height: 18, rx: 2, fill: COLORS.ink, opacity: 0.09 });
        add(group, 'rect', { x: summaryX, y: 132, width: effectiveWidth, height: 18, rx: 2, fill: COLORS.teal });
        label(group, summaryRight - 5, 146, effective.toFixed(1), 'end', 'chart-value');
        label(group, summaryX, 178, compact ? 'Overlap reduces breadth' : 'More rows do not guarantee more breadth', 'start');

        return {
            output: `${(averageCorrelation * 100).toFixed(0)}%`,
            description: `A correlation matrix of value, quality, momentum, revisions, estimates, alternative data, flows, and sentiment has ${effective.toFixed(1)} effective independent bets at a mean pairwise correlation of ${(averageCorrelation * 100).toFixed(0)} percent.`,
            caption: `At a mean pairwise correlation of ${(averageCorrelation * 100).toFixed(0)}%, these eight signals provide about ${effective.toFixed(1)} independent bets.`,
            interaction: { x0: matrixX, x1: matrixX + matrixSize }
        };
    }

    function drawRiskAllocation(group, parameter) {
        const compact = width < 410;
        const concentration = parameter;
        const activeRisk = 3.2 + concentration * 1.8;
        const sources = [
            { name: 'Style', compactName: 'Style', share: 0.24 + concentration * 0.16, color: COLORS.teal, drivers: 'Value, Momentum, Quality' },
            { name: 'Industry', compactName: 'Ind.', share: 0.18 + concentration * 0.14, color: COLORS.blue, drivers: 'Technology, Financials, Energy' },
            { name: 'Country', compactName: 'Ctry', share: 0.10 + concentration * 0.10, color: COLORS.amber, drivers: 'United States, Japan, United Kingdom' },
            { name: 'Idiosyncratic', compactName: 'Idio', share: 0, color: COLORS.red, drivers: 'Stock-specific residual risk' }
        ];
        sources[3].share = 1 - sources.slice(0, 3).reduce((sum, source) => sum + source.share, 0);
        const left = compact ? 14 : 42;
        const right = width - 18;
        const fullWidth = right - left;
        const barLeft = compact ? 72 : 118;
        const barRight = compact ? width - 52 : 372;
        const barWidth = barRight - barLeft;

        label(group, left, 15, 'Equity portfolio active risk', 'start', 'chart-note');
        label(group, right, 15, `${activeRisk.toFixed(1)}%`, 'end', 'chart-value');
        let segmentX = left;
        sources.forEach(source => {
            const segmentWidth = fullWidth * source.share;
            add(group, 'rect', {
                x: segmentX,
                y: 28,
                width: segmentWidth,
                height: 26,
                rx: 2,
                fill: source.color,
                dataTip: `${source.name}: ${(source.share * 100).toFixed(0)}% of active risk. Drivers: ${source.drivers}.`
            });
            const segmentLabel = compact ? source.compactName : source.name;
            if (segmentWidth > (compact ? 34 : 44)) {
                label(group, segmentX + segmentWidth / 2, 45, segmentLabel, 'middle', 'chart-on-color');
            }
            segmentX += segmentWidth;
        });
        label(group, left, 72, 'Share of active risk', 'start', 'chart-note');

        sources.forEach((source, index) => {
            const y = 84 + index * 28;
            const shareWidth = barWidth * source.share;
            label(group, compact ? 64 : 106, y + 10, compact ? source.compactName : source.name, 'end', 'chart-note');
            add(group, 'rect', { x: barLeft, y, width: barWidth, height: 14, rx: 2, fill: COLORS.ink, opacity: 0.08 });
            add(group, 'rect', {
                x: barLeft,
                y,
                width: shareWidth,
                height: 14,
                rx: 2,
                fill: source.color,
                opacity: 0.88,
                dataTip: `${source.name}: ${(source.share * 100).toFixed(0)}% of active risk. Drivers: ${source.drivers}.`
            });
            label(group, barRight + 7, y + 10, `${(source.share * 100).toFixed(0)}%`, 'start', 'chart-note');
            if (!compact) label(group, 406, y + 10, source.drivers, 'start');
        });

        const state = concentration < 0.34 ? 'Diversified' : concentration < 0.68 ? 'Balanced' : 'Concentrated';

        return {
            output: state,
            description: `An equity portfolio has ${activeRisk.toFixed(1)} percent active risk. Its risk sources are ${(sources[0].share * 100).toFixed(0)} percent style, ${(sources[1].share * 100).toFixed(0)} percent industry, ${(sources[2].share * 100).toFixed(0)} percent country, and ${(sources[3].share * 100).toFixed(0)} percent idiosyncratic.`,
            caption: `Active risk is ${activeRisk.toFixed(1)}%. Style, industry, country, and stock-specific exposures contribute ${(sources[0].share * 100).toFixed(0)}%, ${(sources[1].share * 100).toFixed(0)}%, ${(sources[2].share * 100).toFixed(0)}%, and ${(sources[3].share * 100).toFixed(0)}%.`,
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
            fill: 'transparent'
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
            description: `The ${regime.toLowerCase()} scenario produces a sample portfolio return of ${signed(total, 1, '%')}, split across equities, rates, credit, and real assets.`,
            caption: `${regime} scenario: portfolio return ${signed(total, 1, '%')}. Drag the point to change the growth and inflation surprises.`,
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
            title: 'Factor-mimicking portfolio',
            controlLabel: 'Out-of-sample begins',
            render: drawSignalQuality
        },
        {
            title: 'Effective breadth',
            controlLabel: 'Mean pairwise correlation',
            render: drawEffectiveBreadth
        },
        {
            title: 'Risk contribution',
            controlLabel: 'Active concentration',
            render: drawRiskAllocation
        },
        {
            title: 'Regime stress test',
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
