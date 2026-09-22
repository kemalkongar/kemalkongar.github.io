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
    const TAP_SLOP = 6;
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
    let activeInteraction = null;
    let gesture = null;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let isPaused = motionPreference.matches;
    const parameters = [0.65, 0.30, 0.30, { x: 0.70, y: 0.72 }];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function map(value, inMin, inMax, outMin, outMax) {
        return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
    }

    function signed(value, digits, suffix) {
        const rounded = Number(Number(value).toFixed(digits));
        const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
        return `${sign}${Math.abs(rounded).toFixed(digits)}${suffix || ''}`;
    }

    function mean(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function tStat(values) {
        const average = mean(values);
        const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
        return average / Math.sqrt(variance / values.length);
    }

    function make(tag, attributes, textValue) {
        const node = document.createElementNS(NS, tag);
        Object.entries(attributes || {}).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            node.setAttribute(key, String(value));
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
        const bounds = { left: compact ? 38 : 44, right: width - 12, top: 34, bottom: 174 };
        const values = [
            0.08, 0.02, 0.11, 0.05, -0.03, 0.09, 0.06, 0.13,
            0.01, 0.07, 0.04, 0.10, -0.02, 0.08, 0.05, 0.03,
            0.09, 0.00, 0.06, 0.04, 0.05, -0.01, 0.06, 0.02,
            -0.02, 0.06, 0.02, -0.01, 0.05, 0.01, 0.04, 0.03
        ];
        const split = Math.round(map(parameter, 0, 1, 12, 24));
        const inSampleValues = values.slice(0, split);
        const outSampleValues = values.slice(split);
        const inSampleMean = mean(inSampleValues);
        const outSampleMean = mean(outSampleValues);
        const inSampleT = tStat(inSampleValues);
        const outSampleT = tStat(outSampleValues);
        const x = index => map(index, 0, values.length - 1, bounds.left, bounds.right);
        const y = value => map(value, -0.08, 0.15, bounds.bottom, bounds.top);
        const splitX = (x(split - 1) + x(split)) / 2;

        add(group, 'rect', {
            x: splitX,
            y: bounds.top,
            width: bounds.right - splitX,
            height: bounds.bottom - bounds.top,
            fill: COLORS.teal,
            opacity: 0.055
        });
        [-0.05, 0, 0.05, 0.10].forEach(tick => {
            const tickY = y(tick);
            line(group, bounds.left, tickY, bounds.right, tickY, tick === 0 ? 'zero-line' : 'grid');
            label(group, bounds.left - 6, tickY + 4, signed(tick, 2, ''), 'end');
        });
        label(group, bounds.left, 13, compact ? 'Monthly rank IC' : 'Monthly cross-sectional rank IC', 'start', 'chart-note');
        label(group, (bounds.left + splitX) / 2, 27,
            `${compact ? 'IS' : 'In-sample'} t-stat ${inSampleT.toFixed(1)}`, 'middle', 'chart-note');
        label(group, (splitX + bounds.right) / 2, 27,
            `${compact ? 'OOS' : 'Out-of-sample'} t-stat ${outSampleT.toFixed(1)}`, 'middle', 'chart-note');

        const inSamplePoints = inSampleValues.map((value, index) => ({ x: x(index), y: y(value) }));
        const outSamplePoints = values.slice(split - 1).map((value, index) => ({ x: x(index + split - 1), y: y(value) }));
        [
            { points: inSamplePoints, color: COLORS.blue },
            { points: outSamplePoints, color: COLORS.teal }
        ].forEach(series => add(group, 'path', {
            d: pathFrom(series.points),
            fill: 'none',
            stroke: series.color,
            'stroke-width': 1.6,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
            'vector-effect': 'non-scaling-stroke',
            opacity: 0.75,
            class: 'mark'
        }));
        values.forEach((value, index) => add(group, 'circle', {
            cx: x(index),
            cy: y(value),
            r: compact ? 2.2 : 2.7,
            fill: index < split ? COLORS.blue : COLORS.teal,
            stroke: COLORS.cream,
            'stroke-width': 1
        }));
        [
            { x1: bounds.left, x2: splitX, value: inSampleMean, color: COLORS.blue },
            { x1: splitX, x2: bounds.right, value: outSampleMean, color: COLORS.teal }
        ].forEach(segment => add(group, 'line', {
            x1: segment.x1,
            y1: y(segment.value),
            x2: segment.x2,
            y2: y(segment.value),
            stroke: segment.color,
            'stroke-width': 2.5,
            'stroke-dasharray': '6 4',
            'vector-effect': 'non-scaling-stroke'
        }));
        line(group, splitX, bounds.top, splitX, bounds.bottom, 'zero-line');
        label(group, bounds.left, 192, 'M1', 'start');
        label(group, splitX, 192, `M${split}`, 'middle');
        label(group, bounds.right, 192, `M${values.length}`, 'end');

        return {
            output: `Month ${split}`,
            description: `Monthly rank IC averages ${inSampleMean.toFixed(3)} in-sample with a t-statistic of ${inSampleT.toFixed(1)}, and ${outSampleMean.toFixed(3)} out-of-sample with a t-statistic of ${outSampleT.toFixed(1)}.`,
            caption: Math.abs(outSampleT) >= 2
                ? `Mean IC falls from ${signed(inSampleMean, 3, '')} in-sample to ${signed(outSampleMean, 3, '')} out-of-sample, but a t-stat of ${outSampleT.toFixed(1)} means the signal still works.`
                : `Mean IC falls from ${signed(inSampleMean, 3, '')} in-sample to ${signed(outSampleMean, 3, '')} out-of-sample, and a t-stat of ${outSampleT.toFixed(1)} is no longer significant.`,
            interaction: { x0: bounds.left, x1: bounds.right }
        };
    }

    function drawSignalOverlap(group, parameter) {
        const compact = width < 410;
        const count = 8;
        const signalIc = 0.03;
        const matrixSize = compact ? Math.min(132, width * 0.44) : 136;
        const matrixX = compact ? 36 : 62;
        const matrixY = 52;
        const cell = matrixSize / count;
        const clusters = [0, 0, 1, 1, 1, 2, 2, 3];
        const names = ['Value', 'Quality', 'Momentum', 'Revisions', 'Surprise', 'Alt data', 'Flows', 'Sentiment'];
        const shortNames = ['Val', 'Qual', 'Mom', 'Rev', 'Surp', 'Alt', 'Flow', 'Sent'];
        const rowNames = compact ? shortNames : names;
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
                    opacity: 0.08 + rho * 0.84
                });
            }
            label(group, matrixX - 5, matrixY + row * cell + cell * 0.7, rowNames[row], 'end');
        }
        shortNames.forEach((name, column) => {
            const columnX = matrixX + column * cell + cell * 0.5;
            const columnY = matrixY - 8;
            const columnLabel = label(group, columnX, columnY, name, 'start');
            columnLabel.setAttribute('transform', `rotate(-45 ${columnX} ${columnY})`);
        });

        const averageCorrelation = correlationTotal / pairs;
        const effective = count / (1 + (count - 1) * averageCorrelation);
        const combinedIc = signalIc * Math.sqrt(effective);
        const independentIc = signalIc * Math.sqrt(count);
        const summaryX = matrixX + matrixSize + (compact ? 16 : 34);
        const summaryRight = width - 16;
        const barWidth = Math.max(45, summaryRight - summaryX);
        label(group, summaryX, 40, 'Signals counted', 'start', 'chart-note');
        add(group, 'rect', { x: summaryX, y: 48, width: barWidth, height: 18, rx: 2, fill: COLORS.blueLight });
        label(group, summaryRight - 5, 62, `${count}`, 'end', 'chart-value');
        label(group, summaryX, 92, 'Independent bets', 'start', 'chart-note');
        add(group, 'rect', { x: summaryX, y: 100, width: barWidth, height: 18, rx: 2, fill: COLORS.ink, opacity: 0.09 });
        add(group, 'rect', { x: summaryX, y: 100, width: barWidth * (effective / count), height: 18, rx: 2, fill: COLORS.teal });
        label(group, summaryRight - 5, 114, effective.toFixed(1), 'end', 'chart-value');
        label(group, summaryX, 146, 'Combined IC', 'start', 'chart-note');
        label(group, summaryX, 168, combinedIc.toFixed(3), 'start', 'chart-value');
        label(group, summaryX + 42, 167,
            compact ? `of ${independentIc.toFixed(3)} max` : `vs ${independentIc.toFixed(3)} if the signals were uncorrelated`, 'start');

        return {
            output: `${(averageCorrelation * 100).toFixed(0)}%`,
            description: `A correlation matrix of value, quality, momentum, revisions, earnings surprise, alternative data, flows, and sentiment signals. At a mean pairwise correlation of ${(averageCorrelation * 100).toFixed(0)} percent they act like ${effective.toFixed(1)} independent signals. If each has an IC of ${signalIc}, the combined IC is ${combinedIc.toFixed(3)} rather than ${independentIc.toFixed(3)}.`,
            caption: `At ${(averageCorrelation * 100).toFixed(0)}% mean correlation, eight signals with an IC of ${signalIc.toFixed(2)} each act like ${effective.toFixed(1)} independent ones: combined IC = ${signalIc.toFixed(2)} × √${effective.toFixed(1)}.`,
            interaction: { x0: matrixX, x1: matrixX + matrixSize }
        };
    }

    function drawRiskAllocation(group, parameter) {
        const compact = width < 410;
        const tilt = parameter;
        const trackingError = 4.0 + tilt * 1.5;
        const sources = [
            { name: 'Style', compactName: 'Style', share: 0.10 + tilt * 0.25, color: COLORS.teal, drivers: 'Value, Momentum, Quality' },
            { name: 'Industry', compactName: 'Ind.', share: 0.08 + tilt * 0.17, color: COLORS.blue, drivers: 'Technology, Financials, Energy' },
            { name: 'Country', compactName: 'Ctry', share: 0.04 + tilt * 0.08, color: COLORS.amber, drivers: 'United States, Japan, United Kingdom' },
            { name: 'Stock-specific', compactName: 'Stock', share: 0, color: COLORS.red, drivers: 'Company-level residual risk' }
        ];
        sources[3].share = 1 - sources.slice(0, 3).reduce((sum, source) => sum + source.share, 0);
        const left = compact ? 0 : 42;
        const right = width - (compact ? 4 : 18);
        const barLeft = compact ? 44 : 138;
        const barRight = compact ? width - 44 : 382;
        const barWidth = barRight - barLeft;

        label(group, left, 17, compact ? 'Share of active risk' : 'Share of active risk (variance)', 'start', 'chart-note');
        label(group, right, 17, `${trackingError.toFixed(1)}%`, 'end', 'chart-value');
        label(group, right - 40, 17, compact ? 'TE' : 'Ex-ante tracking error', 'end');

        sources.forEach((source, index) => {
            const y = 38 + index * 38;
            const shareWidth = barWidth * source.share;
            label(group, barLeft - 8, y + 14, compact ? source.compactName : source.name, 'end', 'chart-note');
            add(group, 'rect', { x: barLeft, y, width: barWidth, height: 20, rx: 2, fill: COLORS.ink, opacity: 0.08 });
            add(group, 'rect', {
                x: barLeft,
                y,
                width: shareWidth,
                height: 20,
                rx: 2,
                fill: source.color,
                opacity: 0.88
            });
            label(group, barRight + 7, y + 14, `${(source.share * 100).toFixed(0)}%`, 'start', 'chart-note');
            if (!compact) label(group, barRight + 40, y + 14, source.drivers, 'start');
        });
        const factorShare = 1 - sources[3].share;
        label(group, barLeft, 196, `Factor risk ${(factorShare * 100).toFixed(0)}% · stock-specific ${(sources[3].share * 100).toFixed(0)}%`, 'start');

        const state = tilt < 0.34 ? 'Stock picker' : tilt < 0.68 ? 'Blended' : 'Factor-heavy';

        return {
            output: state,
            description: `An equity portfolio has ${trackingError.toFixed(1)} percent ex-ante tracking error. Its active risk comes ${(sources[0].share * 100).toFixed(0)} percent from style, ${(sources[1].share * 100).toFixed(0)} percent from industry, ${(sources[2].share * 100).toFixed(0)} percent from country, and ${(sources[3].share * 100).toFixed(0)} percent from stock-specific risk.`,
            caption: tilt < 0.34
                ? `A bottom-up stock picker should spend most of its risk budget on company-specific views: here ${(sources[3].share * 100).toFixed(0)}% of ${trackingError.toFixed(1)}% tracking error.`
                : `Factor tilts now drive ${(factorShare * 100).toFixed(0)}% of ${trackingError.toFixed(1)}% tracking error, so returns depend more on style and sector moves than on stock selection.`,
            interaction: { x0: barLeft, x1: barRight }
        };
    }

    function drawRegimeStress(group, parameter) {
        const compact = width < 410;
        const matrixSize = compact ? 124 : 154;
        const matrixX = compact ? 20 : 38;
        const matrixY = 30;
        const growth = parameter.x * 2 - 1;
        const inflation = parameter.y * 2 - 1;
        // Corner scenarios (full two-sided surprises); contributions to a multi-asset portfolio in %.
        const corners = {
            deflation: [-4.8, 2.4, -1.2, -1.0],
            goldilocks: [2.2, 0.8, 0.4, 0.3],
            stagflation: [-5.8, -2.6, -1.6, 2.0],
            reflation: [1.0, -1.8, -0.5, 1.4]
        };
        // Fit r = a·(g² + π²)/2 + b·g + c·π + d·g·π, which hits every corner but returns zero with no surprise.
        const contributions = corners.deflation.map((_, index) => {
            const deflation = corners.deflation[index];
            const goldilocks = corners.goldilocks[index];
            const stagflation = corners.stagflation[index];
            const reflation = corners.reflation[index];
            const convexity = (deflation + goldilocks + stagflation + reflation) / 4;
            const growthBeta = (goldilocks + reflation - deflation - stagflation) / 4;
            const inflationBeta = (stagflation + reflation - deflation - goldilocks) / 4;
            const interaction = (deflation + reflation - goldilocks - stagflation) / 4;
            return convexity * (growth * growth + inflation * inflation) / 2
                + growthBeta * growth + inflationBeta * inflation + interaction * growth * inflation;
        });
        const total = contributions.reduce((sum, value) => sum + value, 0);

        const inset = 6;
        const quadrants = [
            { x: matrixX, y: matrixY, label: 'Stagflation', fill: COLORS.redLight, textX: matrixX + inset, textY: matrixY + 14, anchor: 'start' },
            { x: matrixX + matrixSize / 2, y: matrixY, label: 'Reflation', fill: COLORS.amberLight, textX: matrixX + matrixSize - inset, textY: matrixY + 14, anchor: 'end' },
            { x: matrixX, y: matrixY + matrixSize / 2, label: 'Deflation', fill: COLORS.blueLight, textX: matrixX + inset, textY: matrixY + matrixSize - 7, anchor: 'start' },
            { x: matrixX + matrixSize / 2, y: matrixY + matrixSize / 2, label: 'Goldilocks', fill: COLORS.tealLight, textX: matrixX + matrixSize - inset, textY: matrixY + matrixSize - 7, anchor: 'end' }
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
            label(group, quadrant.textX, quadrant.textY, quadrant.label, quadrant.anchor);
        });
        line(group, matrixX + matrixSize / 2, matrixY, matrixX + matrixSize / 2, matrixY + matrixSize, 'axis');
        line(group, matrixX, matrixY + matrixSize / 2, matrixX + matrixSize, matrixY + matrixSize / 2, 'axis');
        add(group, 'rect', {
            x: matrixX,
            y: matrixY,
            width: matrixSize,
            height: matrixSize,
            fill: 'transparent',
            class: 'drag-surface'
        });
        const pointX = map(growth, -1, 1, matrixX, matrixX + matrixSize);
        const pointY = map(inflation, -1, 1, matrixY + matrixSize, matrixY);
        add(group, 'circle', { cx: pointX, cy: pointY, r: 7, fill: COLORS.ink, stroke: COLORS.cream, 'stroke-width': 2, 'pointer-events': 'none' });
        label(group, matrixX + matrixSize / 2, matrixY + matrixSize + 18, 'Growth surprise →');
        const inflationAxisX = compact ? 10 : 12;
        const inflationLabel = label(group, inflationAxisX, matrixY + matrixSize / 2, 'Inflation surprise →', 'middle');
        inflationLabel.setAttribute('transform', `rotate(-90 ${inflationAxisX} ${matrixY + matrixSize / 2})`);

        const regionX = matrixX + matrixSize + (compact ? 14 : 34);
        const regionRight = width - (compact ? 4 : 12);
        const names = ['Equities', 'Rates', 'Credit', 'Real assets'];
        label(group, regionX, 20, `Portfolio ${signed(total, 1, '%')}`, 'start', 'chart-value');

        if (compact) {
            // Stack each row: name and value on one line, a full-width bar beneath.
            const zeroX = (regionX + regionRight) / 2;
            const halfWidth = regionRight - zeroX;
            line(group, zeroX, 34, zeroX, 176, 'zero-line');
            contributions.forEach((value, index) => {
                const y = 46 + index * 36;
                const length = clamp(Math.abs(value) / 6.5, 0, 1) * halfWidth;
                label(group, regionX, y, names[index], 'start');
                label(group, regionRight, y, signed(value, 1, '%'), 'end', 'chart-note');
                add(group, 'rect', {
                    x: value >= 0 ? zeroX : zeroX - length,
                    y: y + 5,
                    width: Math.max(1, length),
                    height: 12,
                    rx: 2,
                    fill: value >= 0 ? COLORS.teal : COLORS.red,
                    opacity: 0.86
                });
            });
        } else {
            const plotLeft = regionX + 64;
            const plotWidth = Math.max(48, regionRight - plotLeft);
            const zeroX = plotLeft + plotWidth * 0.5;
            const halfWidth = Math.min(zeroX - plotLeft, regionRight - zeroX) - 40;
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
                    opacity: 0.86
                });
                label(group, value >= 0 ? zeroX + length + 5 : zeroX - length - 5, y + 4,
                    signed(value, 1, '%'), value >= 0 ? 'start' : 'end');
            });
        }

        const nearBaseline = Math.max(Math.abs(growth), Math.abs(inflation)) < 0.18;
        const regime = nearBaseline ? 'Baseline'
            : inflation >= 0
                ? (growth >= 0 ? 'Reflation' : 'Stagflation')
                : (growth >= 0 ? 'Goldilocks' : 'Deflation');
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
            title: 'Out-of-sample decay',
            controlLabel: 'Out-of-sample begins',
            render: drawSignalQuality
        },
        {
            title: 'Signal overlap',
            controlLabel: 'Mean pairwise correlation',
            render: drawSignalOverlap
        },
        {
            title: 'Risk budget',
            controlLabel: 'Factor tilt',
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
        control.setAttribute('aria-valuetext', result.output);
        const hasSecondary = typeof parameter === 'object';
        secondaryParameter.hidden = !hasSecondary;
        if (hasSecondary) {
            secondaryLabel.textContent = scene.secondaryLabel;
            secondaryControl.value = String(Math.round(parameter.y * 100));
            secondaryOutput.textContent = result.secondaryOutput;
            secondaryControl.setAttribute('aria-valuetext', result.secondaryOutput);
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
        if (isPaused || motionPreference.matches || document.hidden || !isVisible) return;
        autoTimer = window.setTimeout(() => {
            currentScene = (currentScene + 1) % scenes.length;
            render(true);
            scheduleAuto();
        }, AUTO_DELAY);
    }

    function updatePlayButton() {
        playButton.textContent = isPaused ? 'Play' : 'Pause';
        playButton.setAttribute('aria-label', isPaused ? 'Play slideshow' : 'Pause slideshow');
    }

    function pauseForInteraction() {
        isPaused = true;
        clearAutoTimer();
        updatePlayButton();
    }

    function showScene(index, fromUser) {
        currentScene = (index + scenes.length) % scenes.length;
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

    function insideInteraction(point) {
        if (!activeInteraction) return false;
        const insideX = point.x >= activeInteraction.x0 && point.x <= activeInteraction.x1;
        const insideY = !activeInteraction.twoDimensional
            || (point.y >= activeInteraction.y0 && point.y <= activeInteraction.y1);
        return insideX && insideY;
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

    function startDrag(event) {
        gesture.dragging = true;
        svg.setPointerCapture(event.pointerId);
        updateFromPointer(event);
    }

    lab.querySelector('[data-action="play"]').addEventListener('click', () => {
        isPaused = !isPaused;
        updatePlayButton();
        scheduleAuto();
    });
    sceneTabs.forEach(tab => {
        tab.addEventListener('click', () => showScene(Number(tab.dataset.scene), true));
    });
    control.addEventListener('input', event => updatePrimaryParameter(Number(event.target.value), true));
    secondaryControl.addEventListener('input', event => updateSecondaryParameter(Number(event.target.value), true));

    // Mouse and pen drag immediately. Touch waits for a horizontal move or a tap, so vertical swipes
    // over the chart still scroll the page (the Stress grid opts out via .drag-surface).
    svg.addEventListener('pointerdown', event => {
        const point = pointerPosition(event);
        if (!insideInteraction(point)) return;
        gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
        if (event.pointerType !== 'touch' || activeInteraction.twoDimensional) startDrag(event);
    });
    svg.addEventListener('pointermove', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        if (gesture.dragging) {
            updateFromPointer(event);
            return;
        }
        const dx = Math.abs(event.clientX - gesture.startX);
        const dy = Math.abs(event.clientY - gesture.startY);
        if (dx > TAP_SLOP && dx > dy) startDrag(event);
    });
    svg.addEventListener('pointerup', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        if (!gesture.dragging) updateFromPointer(event);
        if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        gesture = null;
    });
    svg.addEventListener('pointercancel', () => { gesture = null; });
    // iOS Safari ignores touch-action on SVG children, so block scrolling inside the Stress grid directly.
    svg.addEventListener('touchstart', event => {
        if (!activeInteraction || !activeInteraction.twoDimensional) return;
        if (insideInteraction(pointerPosition(event.touches[0]))) event.preventDefault();
    }, { passive: false });

    lab.addEventListener('keydown', event => {
        if (event.target.matches('input[type="range"]')) return;
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            showScene(currentScene - 1, true);
            sceneTabs[currentScene].focus();
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            showScene(currentScene + 1, true);
            sceneTabs[currentScene].focus();
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
