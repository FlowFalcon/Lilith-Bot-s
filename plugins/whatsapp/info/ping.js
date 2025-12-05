const { createCanvas } = require("canvas");
const { performance } = require("perf_hooks");
const os = require("os");
const { execSync } = require("child_process");
const https = require("https");

const THEME = {
    bg: '#0a0e27',
    bgGradient: '#1a1f3a',
    card: '#161b33',
    cardBorder: '#2d3548',
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    
    cpu: '#ef4444',
    cpuGlow: '#fca5a5',
    memory: '#3b82f6',
    memoryGlow: '#93c5fd',
    disk: '#8b5cf6',
    diskGlow: '#c4b5fd',
    network: '#06b6d4',
    networkGlow: '#67e8f9',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    pink: '#ec4899',
    
    glow: 'rgba(59, 130, 246, 0.2)'
};

const MAX_HISTORY_POINTS = 60;
let pingHistory = [];
let cpuHistory = [];
let ramHistory = [];

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
};

const formatUptime = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
};

const getPing = () => {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const req = https.get('https://www.google.com', (res) => {
            res.resume();
            resolve(Date.now() - startTime);
        });
        req.on('error', () => resolve(-1));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve(-1);
        });
    });
};

const getCpuUsage = () => {
    return new Promise((resolve) => {
        try {
            const startMeasure = os.cpus();
            setTimeout(() => {
                const endMeasure = os.cpus();
                let idleDiff = 0, totalDiff = 0;
                for (let i = 0; i < startMeasure.length; i++) {
                    const start = startMeasure[i].times;
                    const end = endMeasure[i].times;
                    const startIdle = start.idle;
                    const startTotal = Object.values(start).reduce((a, b) => a + b);
                    const endIdle = end.idle;
                    const endTotal = Object.values(end).reduce((a, b) => a + b);
                    idleDiff += endIdle - startIdle;
                    totalDiff += endTotal - startTotal;
                }
                const cpuPercent = 100 - (100 * idleDiff / totalDiff);
                resolve(Math.round(cpuPercent));
            }, 1000);
        } catch (error) {
            resolve(50);
        }
    });
};

const getNetworkStats = () => {
    try {
        const interfaces = os.networkInterfaces();
        let totalRx = 0, totalTx = 0, activeInterface = 'N/A', ip = 'N/A';

        for (const [name, addrs] of Object.entries(interfaces)) {
            if (name.toLowerCase().includes('lo')) continue;
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    activeInterface = name;
                    ip = addr.address;
                    break;
                }
            }
        }

        try {
            const netstat = execSync("cat /proc/net/dev 2>/dev/null || echo ''").toString();
            const lines = netstat.split('\n');
            for (const line of lines) {
                if (line.includes(':') && !line.includes('lo:')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 10) {
                        totalRx += parseInt(parts[1]) || 0;
                        totalTx += parseInt(parts[9]) || 0;
                    }
                }
            }
        } catch (e) {}

        return { totalRx, totalTx, activeInterface, ip };
    } catch (e) {
        return { totalRx: 0, totalTx: 0, activeInterface: 'N/A', ip: 'N/A' };
    }
};

function drawBackground(ctx, w, h) {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, THEME.bg);
    gradient.addColorStop(0.5, THEME.bgGradient);
    gradient.addColorStop(1, THEME.bg);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.02;
    for (let i = 0; i < 150; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const size = Math.random() * 2;
        ctx.fillStyle = THEME.textPrimary;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = THEME.cardBorder;
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
    }
    for (let i = 0; i < h; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawCard(ctx, x, y, w, h, radius, glowColor = THEME.glow) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = THEME.card;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = THEME.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    const highlightGradient = ctx.createLinearGradient(x, y, x, y + h/3);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fill();
    
    ctx.restore();
}

function drawIcon(ctx, x, y, type, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch(type) {
        case 'cpu':
            ctx.strokeRect(x - 12, y - 12, 24, 24);
            ctx.fillRect(x - 6, y - 6, 12, 12);
            for (let i = -8; i <= 8; i += 8) {
                ctx.beginPath();
                ctx.moveTo(x - 12, y + i);
                ctx.lineTo(x - 16, y + i);
                ctx.moveTo(x + 12, y + i);
                ctx.lineTo(x + 16, y + i);
                ctx.stroke();
            }
            break;
        case 'memory':
            for (let i = 0; i < 4; i++) {
                ctx.strokeRect(x - 10 + i * 6, y - 12, 5, 24);
            }
            break;
        case 'disk':
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'network':
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y - 8);
            ctx.lineTo(x, y + 8);
            ctx.moveTo(x - 8, y);
            ctx.lineTo(x + 8, y);
            ctx.stroke();
            for (let i = 0; i < 4; i++) {
                const px = i % 2 === 0 ? -6 : 6;
                const py = i < 2 ? -6 : 6;
                ctx.beginPath();
                ctx.arc(x + px, y + py, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case 'server':
            for (let i = 0; i < 3; i++) {
                ctx.strokeRect(x - 12, y - 10 + i * 8, 24, 6);
                ctx.beginPath();
                ctx.arc(x + 8, y - 7 + i * 8, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case 'clock':
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - 8);
            ctx.moveTo(x, y);
            ctx.lineTo(x + 6, y);
            ctx.stroke();
            break;
    }
    ctx.restore();
}

function drawLogo(ctx, x, y, size) {
    ctx.save();
    const gradient = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
    gradient.addColorStop(0, THEME.cpu);
    gradient.addColorStop(0.33, THEME.memory);
    gradient.addColorStop(0.66, THEME.disk);
    gradient.addColorStop(1, THEME.network);
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.closePath();
    ctx.stroke();
    
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - size/2, y);
    ctx.lineTo(x, y - size/2);
    ctx.lineTo(x + size/2, y);
    ctx.lineTo(x, y + size/2);
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();
}

function drawDonutChart(ctx, x, y, radius, lineWidth, percent, color, glowColor) {
    ctx.save();
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = THEME.bgGradient;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * (percent / 100));
    
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    const gradient = ctx.createLinearGradient(x - radius, y, x + radius, y);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, glowColor);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    ctx.shadowBlur = 0;
    
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(percent)}%`, x, y - 5);
    
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = "500 12px Arial";
    ctx.fillText("USAGE", x, y + 18);
    
    ctx.restore();
}

function drawProgressCard(ctx, x, y, w, h, title, iconType, progress, subtext, color, glowColor) {
    drawCard(ctx, x, y, w, h, 16);
    
    drawIcon(ctx, x + 32, y + 38, iconType, color);
    
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = '600 17px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 65, y + 44);
    
    const statusColor = progress > 80 ? THEME.danger : progress > 60 ? THEME.warning : THEME.success;
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(x + w - 30, y + 30, 7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowColor = statusColor;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    drawDonutChart(ctx, x + w/2, y + 120, 52, 13, progress, color, glowColor);
    
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(subtext, x + w/2, y + h - 25);
}

function drawInfoCard(ctx, x, y, w, h, title, iconType, text, color) {
    drawCard(ctx, x, y, w, h, 16);
    
    drawIcon(ctx, x + 32, y + 38, iconType, color);
    
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = '600 17px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 65, y + 44);
    
    ctx.fillStyle = THEME.success;
    ctx.beginPath();
    ctx.arc(x + w - 30, y + 30, 7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateText(ctx, text, w - 60), x + w/2, y + h/2 + 15);
}

function drawMetricChart(ctx, x, y, w, h, title, data, color, glowColor, unit = '%') {
    drawCard(ctx, x, y, w, h, 16);
    
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 30, y + 38);
    
    const latestValue = data[data.length - 1];
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(latestValue)}${unit}`, x + w - 30, y + 38);
    
    const padding = { t: 65, r: 30, b: 45, l: 50 };
    const chartW = w - padding.l - padding.r;
    const chartH = h - padding.t - padding.b;
    const chartX = x + padding.l;
    const chartY = y + padding.t;
    
    const maxVal = 100;
    
    ctx.strokeStyle = THEME.cardBorder;
    ctx.lineWidth = 1;
    ctx.font = '500 11px Arial';
    ctx.fillStyle = THEME.textTertiary;
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 4; i++) {
        const gridY = chartY + (i / 4) * chartH;
        const value = maxVal - (i / 4) * maxVal;
        ctx.fillText(Math.round(value).toString(), chartX - 10, gridY + 4);
        ctx.beginPath();
        ctx.moveTo(chartX, gridY);
        ctx.lineTo(chartX + chartW, gridY);
        ctx.stroke();
    }
    
    ctx.textAlign = 'center';
    const xLabels = ['-60s', '-30s', 'Now'];
    for (let i = 0; i < xLabels.length; i++) {
        const labelX = chartX + (i / (xLabels.length - 1)) * chartW;
        ctx.fillText(xLabels[i], labelX, chartY + chartH + 20);
    }
    
    const points = data.map((d, i) => ({
        x: chartX + (i / (data.length - 1)) * chartW,
        y: chartY + chartH - ((d / maxVal) * chartH)
    }));
    
    ctx.save();
    roundRect(ctx, x, y, w, h, 16);
    ctx.clip();
    
    const fillGradient = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
    fillGradient.addColorStop(0, color + '50');
    fillGradient.addColorStop(1, color + '05');
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, chartY + chartH);
    ctx.lineTo(chartX, chartY + chartH);
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();
    
    ctx.restore();
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.quadraticCurveTo(
        points[points.length - 2].x, 
        points[points.length - 2].y, 
        points[points.length - 1].x, 
        points[points.length - 1].y
    );
    
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    for (let i = 0; i < points.length; i += 15) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = THEME.card;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawNetworkCard(ctx, x, y, w, h, rxData, txData, ip, interfaceName) {
    drawCard(ctx, x, y, w, h, 16);
    
    drawIcon(ctx, x + 32, y + 38, 'network', THEME.network);
    
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = '600 17px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('NETWORK', x + 65, y + 44);
    
    ctx.fillStyle = THEME.success;
    ctx.beginPath();
    ctx.arc(x + w - 30, y + 30, 7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 13px Arial';
    ctx.fillText(`Interface: ${interfaceName}`, x + 30, y + 75);
    
    const boxW = (w - 90) / 2;
    const boxH = 65;
    const box1X = x + 30;
    const box2X = x + w - boxW - 30;
    const boxY = y + 95;
    
    ctx.fillStyle = THEME.bgGradient;
    roundRect(ctx, box1X, boxY, boxW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = THEME.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = THEME.network;
    ctx.font = '500 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('↓ DOWNLOAD', box1X + 15, boxY + 22);
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = 'bold 20px Arial';
    ctx.fillText(formatBytes(rxData), box1X + 15, boxY + 48);
    
    ctx.fillStyle = THEME.bgGradient;
    roundRect(ctx, box2X, boxY, boxW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = THEME.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = THEME.pink;
    ctx.font = '500 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('↑ UPLOAD', box2X + 15, boxY + 22);
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = 'bold 20px Arial';
    ctx.fillText(formatBytes(txData), box2X + 15, boxY + 48);
    
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 13px Arial';
    ctx.textAlign = 'center';
}

function drawSystemOverview(ctx, x, y, w, h, hostname, osInfo, cpuCores, uptime, cpuLoad, currentPing) {
    drawCard(ctx, x, y, w, h, 16);
    
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('System Overview', x + 30, y + 40);
    
    const statusColor = cpuLoad < 80 ? THEME.success : THEME.danger;
    ctx.fillStyle = statusColor;
    ctx.font = '600 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(cpuLoad < 80 ? '● Operational' : '● Critical', x + w - 30, y + 40);
    
    ctx.strokeStyle = THEME.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 58);
    ctx.lineTo(x + w - 30, y + 58);
    ctx.stroke();
    
    const col1X = x + 30;
    const col2X = x + w/2 + 30;
    let row1Y = y + 88;
    const lineH = 32;
    
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 14px Arial';
    ctx.textAlign = 'left';
    
    ctx.fillText('Hostname', col1X, row1Y);
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 14px Arial';
    ctx.fillText(hostname, col1X + 120, row1Y);
    
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 14px Arial';
    ctx.fillText('CPU Cores', col2X, row1Y);
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 14px Arial';
    ctx.fillText(`${cpuCores} cores`, col2X + 120, row1Y);
    
    row1Y += lineH;
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 14px Arial';
    ctx.fillText('Operating System', col1X, row1Y);
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 14px Arial';
    ctx.fillText(truncateText(ctx, osInfo, 180), col1X + 120, row1Y);
    
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 14px Arial';
    ctx.fillText('Uptime', col2X, row1Y);
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 14px Arial';
    ctx.fillText(uptime, col2X + 120, row1Y);
    
    row1Y += lineH;
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 14px Arial';
    ctx.fillText('Last Ping', col1X, row1Y);
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 14px Arial';
    ctx.fillText(currentPing > 0 ? `${currentPing}ms` : 'Timeout', col1X + 120, row1Y);
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 14px Arial';
    ctx.fillText('Updated', col2X, row1Y);
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '600 14px Arial';
    ctx.fillText(timeStr, col2X + 120, row1Y);
}

function truncateText(ctx, text, maxWidth) {
    let width = ctx.measureText(text).width;
    if (width <= maxWidth) return text;
    const ellipsis = '...';
    while (width >= maxWidth - ctx.measureText(ellipsis).width) {
        text = text.slice(0, -1);
        width = ctx.measureText(text).width;
    }
    return text + ellipsis;
}

async function renderDashboard(stats) {
    const W = 1200;
    const H = 1750;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    drawBackground(ctx, W, H);

    drawLogo(ctx, 70, 58, 24);
    
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = 'bold 38px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('VPS SERVER MONITOR', 115, 68);
    
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = '500 16px Arial';
    ctx.fillText(`Real-time Performance Dashboard • ${stats.hostname}`, 115, 95);

    const gradient = ctx.createLinearGradient(50, 118, W - 50, 118);
    gradient.addColorStop(0, THEME.cpu);
    gradient.addColorStop(0.25, THEME.memory);
    gradient.addColorStop(0.5, THEME.disk);
    gradient.addColorStop(0.75, THEME.network);
    gradient.addColorStop(1, THEME.pink);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 118);
    ctx.lineTo(W - 50, 118);
    ctx.stroke();

    const overviewY = 150;
    const overviewH = 170;
    drawSystemOverview(ctx, 50, overviewY, W - 100, overviewH, stats.hostname, stats.osInfo, stats.cpuCores, stats.uptime, stats.cpuLoad, stats.currentPing);

    const cardW = 350;
    const cardH = 220;
    const gap = 25;
    const startX = 50;
    let currentY = overviewY + overviewH + 30;

    drawProgressCard(ctx, startX, currentY, cardW, cardH, 'CPU USAGE', 'cpu', stats.cpuLoad, `${stats.cpuCores} Cores @ ${stats.cpuSpeed} MHz`, THEME.cpu, THEME.cpuGlow);
    drawProgressCard(ctx, startX + cardW + gap, currentY, cardW, cardH, 'MEMORY', 'memory', stats.memPercent, `${formatBytes(stats.memUsed)} / ${formatBytes(stats.memTotal)}`, THEME.memory, THEME.memoryGlow);
    drawProgressCard(ctx, startX + (cardW + gap) * 2, currentY, cardW, cardH, 'STORAGE', 'disk', stats.diskPercent, `${stats.diskUsed} / ${stats.diskTotal}`, THEME.disk, THEME.diskGlow);

    currentY += cardH + gap;
    
    const chartW = (W - 100 - gap) / 2;
    const chartH = 240;
    
    drawMetricChart(ctx, startX, currentY, chartW, chartH, 'CPU Usage History', stats.cpuHistory, THEME.cpu, THEME.cpuGlow);
    drawMetricChart(ctx, startX + chartW + gap, currentY, chartW, chartH, 'Memory Usage History', stats.ramHistory, THEME.memory, THEME.memoryGlow);

    currentY += chartH + gap;
    
    drawNetworkCard(ctx, startX, currentY, W - 100, 200, stats.networkRx, stats.networkTx, stats.networkIP, stats.networkInterface);

    currentY += 200 + gap;
    
    drawInfoCard(ctx, startX, currentY, cardW, 160, 'CPU MODEL', 'server', stats.cpuModel, THEME.success);
    drawInfoCard(ctx, startX + cardW + gap, currentY, cardW, 160, 'PACKAGES', 'server', stats.packages, THEME.pink);
    drawInfoCard(ctx, startX + (cardW + gap) * 2, currentY, cardW, 160, 'NODE.JS', 'server', `v${stats.nodeVersion}`, THEME.network);

    currentY += 160 + gap;
    
    const pingChartH = 280;
    drawMetricChart(ctx, startX, currentY, W - 100, pingChartH, 'Network Latency History', stats.pingHistory.map(p => p > 0 ? p : 0), THEME.network, THEME.networkGlow, 'ms');

    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    ctx.fillStyle = THEME.textTertiary;
    ctx.font = '500 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Report Generated: ${dateStr}`, W / 2, H - 25);

    return canvas.toBuffer('image/png');
}

let handler = async (m, { conn }) => {
    try {
        const loadingMsg = await m.adReply('Just Wait...');

        const [cpuLoad, currentPing] = await Promise.all([
            getCpuUsage(),
            getPing()
        ]);

        if (pingHistory.length === 0) {
            const initialPing = currentPing > 0 ? currentPing : 100;
            pingHistory = new Array(MAX_HISTORY_POINTS).fill(initialPing);
        }
        pingHistory.push(currentPing > 0 ? currentPing : 100);
        if (pingHistory.length > MAX_HISTORY_POINTS) pingHistory.shift();

        if (cpuHistory.length === 0) {
            cpuHistory = new Array(MAX_HISTORY_POINTS).fill(cpuLoad);
        }
        cpuHistory.push(cpuLoad);
        if (cpuHistory.length > MAX_HISTORY_POINTS) cpuHistory.shift();

        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = Math.round((1 - freeMem / totalMem) * 100);

        if (ramHistory.length === 0) {
            ramHistory = new Array(MAX_HISTORY_POINTS).fill(memPercent);
        }
        ramHistory.push(memPercent);
        if (ramHistory.length > MAX_HISTORY_POINTS) ramHistory.shift();

        let diskTotal = 0, diskUsed = 0, diskPercent = 0;
        try {
            const df = execSync('df -k --output=size,used / 2>/dev/null').toString();
            const lines = df.trim().split('\n');
            if (lines.length > 1) {
                const [total, used] = lines[1].trim().split(/\s+/).map(Number);
                diskTotal = total * 1024;
                diskUsed = used * 1024;
                diskPercent = Math.round((diskUsed / diskTotal) * 100);
            }
        } catch (e) {}

        const networkStats = getNetworkStats();
        
        let packages = 'N/A';
        try {
            const pkgCount = execSync('dpkg -l 2>/dev/null | grep "^ii" | wc -l || rpm -qa 2>/dev/null | wc -l || echo "0"').toString().trim();
            packages = pkgCount + ' packages';
        } catch (e) {}

        const stats = {
            hostname: os.hostname(),
            osInfo: `${os.type()} ${os.release()}`,
            cpuModel: cpus[0].model.trim().substring(0, 35),
            cpuSpeed: cpus[0].speed,
            cpuCores: cpus.length,
            cpuLoad: cpuLoad,
            uptime: formatUptime(os.uptime()),
            memPercent: memPercent,
            memUsed: totalMem - freeMem,
            memTotal: totalMem,
            diskPercent: diskPercent,
            diskUsed: formatBytes(diskUsed),
            diskTotal: formatBytes(diskTotal),
            currentPing: currentPing > 0 ? currentPing : 0,
            pingHistory: pingHistory,
            cpuHistory: cpuHistory,
            ramHistory: ramHistory,
            networkRx: networkStats.totalRx,
            networkTx: networkStats.totalTx,
            networkIP: networkStats.ip,
            networkInterface: networkStats.activeInterface,
            packages: packages,
            nodeVersion: process.version.replace('v', '')
        };

        const imageBuffer = await renderDashboard(stats);

        await conn.sendMessage(m.chat, {
            image: imageBuffer,
            caption: `*『 SERVER MONITOR 』*\n\n` +
                     `┌─ *System Status*\n` +
                     `├ CPU: ${stats.cpuLoad}% (${stats.cpuCores} cores)\n` +
                     `├ RAM: ${formatBytes(stats.memUsed)} / ${formatBytes(stats.memTotal)} (${stats.memPercent}%)\n` +
                     `├ Disk: ${stats.diskUsed} / ${stats.diskTotal} (${stats.diskPercent}%)\n` +
                     `├ Latency: ${stats.currentPing}ms\n` +
                     `├ Network: ↓${formatBytes(stats.networkRx)} ↑${formatBytes(stats.networkTx)}\n` +
                     `├ Uptime: ${stats.uptime}\n` +
                     `└ Host: ${stats.hostname}`
        }, { quoted: m });

        await conn.sendMessage(m.chat, { delete: loadingMsg.key });

    } catch (e) {
        console.error(e);
        m.reply(`Error: ${e.message}`);
    }
};

handler.help = ['ping'];
handler.tags = ['info'];
handler.command = ['ping'];
module.exports = handler;