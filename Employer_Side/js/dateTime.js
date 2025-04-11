// Custom font definition
Chart.defaults.global.defaultFontFamily = 'interBold';

// DateTime Display with Analog Clock
var dateTimeCanvas = document.getElementById("dateTime");
var ctx = dateTimeCanvas.getContext("2d");

// Function to resize canvas based on container
function resizeCanvas() {
    const container = dateTimeCanvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Set canvas size to match container
    dateTimeCanvas.width = containerWidth;
    dateTimeCanvas.height = containerHeight;
    
    // Force redraw after resize
    updateDateTime();
}

function drawClock(ctx, now) {
    // Calculate responsive clock size
    const minDimension = Math.min(dateTimeCanvas.width, dateTimeCanvas.height) * 0.5;
    const clockRadius = minDimension * 0.6; // Make clock 60% of the minimum dimension
    const centerX = dateTimeCanvas.width / 2;
    const centerY = dateTimeCanvas.height / 2;

    // Draw clock face
    ctx.beginPath();
    ctx.arc(centerX, centerY, clockRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#073884';
    ctx.lineWidth = clockRadius * 0.02; // Responsive line width
    ctx.stroke();

    // Draw hour marks and numbers
    for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI / 6) - Math.PI / 2;
        const startRadius = clockRadius - (clockRadius * 0.15);
        const endRadius = clockRadius - (clockRadius * 0.05);
        const numberRadius = clockRadius + (clockRadius * 0.15);
        
        // Draw hour marks
        const startX = centerX + Math.cos(angle) * startRadius;
        const startY = centerY + Math.sin(angle) * startRadius;
        const endX = centerX + Math.cos(angle) * endRadius;
        const endY = centerY + Math.sin(angle) * endRadius;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = '#073884';
        ctx.lineWidth = clockRadius * 0.02;
        ctx.stroke();

        // Draw numbers
        const number = i === 0 ? 12 : i;
        const textX = centerX + Math.cos(angle) * numberRadius;
        const textY = centerY + Math.sin(angle) * numberRadius;
        
        ctx.font = `${clockRadius * 0.15}px montserratBold`;
        ctx.fillStyle = '#858796';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number, textX, textY);
    }

    // Get current time
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Draw hands with responsive lengths
    drawHand(ctx, centerX, centerY, 
        (hours * Math.PI / 6) + (minutes * Math.PI / 360) - Math.PI / 2,
        clockRadius * 0.5, clockRadius * 0.04, '#073884'); // Hour hand

    drawHand(ctx, centerX, centerY,
        (minutes * Math.PI / 30) - Math.PI / 2,
        clockRadius * 0.7, clockRadius * 0.03, '#1cc88a'); // Minute hand

    drawHand(ctx, centerX, centerY,
        (seconds * Math.PI / 30) - Math.PI / 2,
        clockRadius * 0.8, clockRadius * 0.01, '#e74a3b'); // Second hand

    // Draw center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, clockRadius * 0.03, 0, 2 * Math.PI);
    ctx.fillStyle = '#073884';
    ctx.fill();
}

function drawHand(ctx, centerX, centerY, angle, length, width, color) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(angle) * length,
        centerY + Math.sin(angle) * length
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}

function updateDateTime() {
    // Clear the canvas
    ctx.clearRect(0, 0, dateTimeCanvas.width, dateTimeCanvas.height);
    
    var now = new Date();
    var date = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    var time = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });

    // Draw analog clock
    drawClock(ctx, now);

    // Responsive text sizes
    const fontSize = Math.min(dateTimeCanvas.width, dateTimeCanvas.height) * 0.06;
    
    // Draw date
    ctx.font = `bold ${fontSize}px montserratBold`;
    ctx.fillStyle = "#073884";
    ctx.textAlign = "center";
    ctx.fillText(date, dateTimeCanvas.width / 2, fontSize); // Top position
    
    // Draw digital time
    ctx.font = `bold ${fontSize * 1.5}px montserratBold`;
    ctx.fillStyle = "#1cc88a";
    ctx.fillText(time, dateTimeCanvas.width / 2, dateTimeCanvas.height - fontSize); // Bottom position
}

// Add resize listener
window.addEventListener('resize', resizeCanvas);

// Initial setup
resizeCanvas();

// Update every second
setInterval(updateDateTime, 1000);