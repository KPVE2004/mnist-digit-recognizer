// Configuración
const API_URL = 'http://127.0.0.1:8000/predict';

// Variables globales
let currentImageData = null;
let currentInputMode = 'upload';
let drawCanvas = null;
let drawCtx = null;
let isDrawing = false;
let chart = null;

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando frontend...');
    initializeTabs();
    initializeUpload();
    initializeCanvas();
    initializeButtons();
    testConnection();
});

// Probar conexión con la API
async function testConnection() {
    try {
        const response = await fetch('http://127.0.0.1:8000/health');
        const data = await response.json();
        console.log('✅ API conectada:', data);
    } catch (error) {
        console.error('❌ API no disponible:', error);
        alert('⚠️ No se pudo conectar con la API. Asegúrate de que esté corriendo en http://127.0.0.1:8000');
    }
}

// Inicializar tabs
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            currentInputMode = tabId;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(`${tabId}Panel`).classList.add('active');
            
            resetPrediction();
        });
    });
}

// Inicializar upload
function initializeUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', () => fileInput.click());
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                processImageFile(file);
            }
        });
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processImageFile(file);
}

function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 28;
            tempCanvas.height = 28;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0, 28, 28);
            
            const imageData = tempCtx.getImageData(0, 0, 28, 28);
            currentImageData = { data: imageData.data, file: file };
            
            showUploadPreview(e.target.result);
            document.getElementById('predictBtn').disabled = false;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function showUploadPreview(imageUrl) {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    uploadArea.innerHTML = `
        <div class="upload-content">
            <i class="fas fa-check-circle upload-icon" style="color: #48bb78;"></i>
            <h3>¡Imagen cargada!</h3>
            <img src="${imageUrl}" style="max-width: 150px; border-radius: 12px; margin: 15px 0;">
            <p>Listo para analizar</p>
            <button class="btn-secondary" id="changeImageBtn">
                <i class="fas fa-sync-alt"></i> Cambiar imagen
            </button>
        </div>
    `;
    
    const changeBtn = document.getElementById('changeImageBtn');
    if (changeBtn) {
        changeBtn.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
    }
}

// Inicializar canvas de dibujo
function initializeCanvas() {
    drawCanvas = document.getElementById('drawCanvas');
    if (!drawCanvas) return;
    
    drawCtx = drawCanvas.getContext('2d');
    
    // ✅ CAMBIADO: Fondo BLANCO (como MNIST original)
    drawCtx.fillStyle = '#FFFFFF';
    drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    
    // ✅ CAMBIADO: Trazo NEGRO (como MNIST original)
    drawCtx.strokeStyle = '#000000';
    drawCtx.lineWidth = 20;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    
    // Eventos (igual)
    drawCanvas.addEventListener('mousedown', startDrawing);
    drawCanvas.addEventListener('mousemove', draw);
    drawCanvas.addEventListener('mouseup', stopDrawing);
    drawCanvas.addEventListener('mouseleave', stopDrawing);
    
    drawCanvas.addEventListener('touchstart', startDrawingTouch);
    drawCanvas.addEventListener('touchmove', drawTouch);
    drawCanvas.addEventListener('touchend', stopDrawing);
    
    // Controles del pincel
    const brushSize = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    const brushColor = document.getElementById('brushColor');
    
    if (brushSize) {
        brushSize.addEventListener('input', (e) => {
            if (brushSizeValue) brushSizeValue.textContent = e.target.value;
            drawCtx.lineWidth = parseInt(e.target.value);
        });
        drawCtx.lineWidth = parseInt(brushSize.value);
    }
    
    if (brushColor) {
        brushColor.addEventListener('input', (e) => {
            drawCtx.strokeStyle = e.target.value;
        });
        // ✅ CAMBIADO: Color negro por defecto
        brushColor.value = '#000000';
    }
    
    // Botón limpiar
    const clearBtn = document.getElementById('clearCanvasBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            // ✅ CAMBIADO: Fondo BLANCO al limpiar
            drawCtx.fillStyle = '#FFFFFF';
            drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
            drawCtx.strokeStyle = brushColor ? brushColor.value : '#000000';
            currentImageData = null;
            document.getElementById('predictBtn').disabled = true;
            resetPrediction();
        });
    }
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getMousePos(e);
    drawCtx.beginPath();
    drawCtx.moveTo(pos.x, pos.y);
    drawCtx.lineTo(pos.x, pos.y);
    drawCtx.stroke();
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    drawCtx.lineWidth = document.getElementById('brushSize').value;
    drawCtx.lineTo(pos.x, pos.y);
    drawCtx.stroke();
    drawCtx.beginPath();
    drawCtx.moveTo(pos.x, pos.y);
}

function startDrawingTouch(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getTouchPos(e);
    drawCtx.beginPath();
    drawCtx.moveTo(pos.x, pos.y);
    drawCtx.lineTo(pos.x, pos.y);
    drawCtx.stroke();
}

function drawTouch(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getTouchPos(e);
    drawCtx.lineWidth = document.getElementById('brushSize').value;
    drawCtx.lineTo(pos.x, pos.y);
    drawCtx.stroke();
    drawCtx.beginPath();
    drawCtx.moveTo(pos.x, pos.y);
}

function stopDrawing() {
    isDrawing = false;
    if (currentInputMode === 'draw') {
        processDrawing();
    }
}

function getMousePos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function getTouchPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
    };
}

function clearCanvas() {
    // ✅ CAMBIADO: Fondo BLANCO
    drawCtx.fillStyle = '#FFFFFF';
    drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawCtx.strokeStyle = document.getElementById('brushColor').value;
}

function processDrawing() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 28;
    tempCanvas.height = 28;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(drawCanvas, 0, 0, 28, 28);
    
    const imageData = tempCtx.getImageData(0, 0, 28, 28);
    currentImageData = { data: imageData.data };
    
    document.getElementById('predictBtn').disabled = false;
}

// Inicializar botones
function initializeButtons() {
    const predictBtn = document.getElementById('predictBtn');
    const newPredictionBtn = document.getElementById('newPredictionBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');
    const closeResultsBtn = document.getElementById('closeResultsBtn');
    
    if (predictBtn) predictBtn.addEventListener('click', makePrediction);
    if (newPredictionBtn) newPredictionBtn.addEventListener('click', resetPrediction);
    if (exportResultsBtn) exportResultsBtn.addEventListener('click', exportResults);
    if (closeResultsBtn) closeResultsBtn.addEventListener('click', () => {
        document.getElementById('resultsPanel').style.display = 'none';
    });
}

// Hacer predicción - VERSIÓN CORREGIDA
async function makePrediction() {
    console.log('🔮 Iniciando predicción...');
    
    if (!currentImageData) {
        alert('Por favor, carga una imagen o dibuja un dígito primero');
        return;
    }
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    const predictBtn = document.getElementById('predictBtn');
    
    loadingOverlay.style.display = 'flex';
    predictBtn.disabled = true;
    
    const formData = new FormData();
    
    try {
        let fileToSend = null;
        
        if (currentInputMode === 'upload' && currentImageData.file) {
            fileToSend = currentImageData.file;
            console.log('📁 Usando archivo:', fileToSend.name);
        } else {
            const canvas = document.getElementById('drawCanvas');
            fileToSend = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });
            console.log('✏️ Usando dibujo desde canvas');
        }
        
        formData.append('file', fileToSend);
        
        console.log('📡 Enviando a:', API_URL);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        console.log('📥 Respuesta status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('✅ Respuesta recibida:', result);
        
        if (!result.clase || result.probabilidad === undefined) {
            throw new Error('Respuesta inválida de la API');
        }
        
        displayResults(result);
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert(`Error: ${error.message}\n\nVerifica que la API esté corriendo en http://127.0.0.1:8000`);
    } finally {
        loadingOverlay.style.display = 'none';
        predictBtn.disabled = false;
    }
}

// Mostrar resultados
function displayResults(result) {
    console.log('📊 Mostrando resultados:', result);
    
    const { clase, probabilidad, todas_probabilidades } = result;
    const probabilityPercent = (probabilidad * 100).toFixed(1);
    
    const predictedDigit = document.getElementById('predictedDigit');
    const confidencePercent = document.getElementById('confidencePercent');
    const confidenceRing = document.getElementById('confidenceRing');
    const confidenceStatus = document.getElementById('confidenceStatus');
    
    if (predictedDigit) predictedDigit.textContent = clase;
    if (confidencePercent) confidencePercent.textContent = `${probabilityPercent}%`;
    
    const confidenceBadge = document.querySelector('.confidence-value');
    if (confidenceBadge) confidenceBadge.textContent = `${probabilityPercent}%`;
    
    if (confidenceRing) {
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (probabilidad * circumference);
        confidenceRing.style.strokeDashoffset = offset;
    }
    
    if (confidenceStatus) {
        if (probabilidad > 0.8) {
            confidenceStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>Alta confianza en la predicción</span>';
            confidenceStatus.style.color = '#48bb78';
        } else if (probabilidad > 0.6) {
            confidenceStatus.innerHTML = '<i class="fas fa-chart-line"></i><span>Confianza moderada</span>';
            confidenceStatus.style.color = '#ed8936';
        } else {
            confidenceStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Baja confianza - revisa el dibujo</span>';
            confidenceStatus.style.color = '#f56565';
        }
    }
    
    let probabilities;
    if (todas_probabilidades && todas_probabilidades.length === 10) {
        probabilities = todas_probabilidades;
    } else {
        probabilities = [];
        for (let i = 0; i < 10; i++) {
            if (i.toString() === clase) {
                probabilities.push(probabilidad);
            } else {
                probabilities.push((1 - probabilidad) / 9);
            }
        }
    }
    
    updateChart(probabilities);
    updateTop3(probabilities, clase);
    
    const resultsPanel = document.getElementById('resultsPanel');
    if (resultsPanel) {
        resultsPanel.style.display = 'block';
        resultsPanel.scrollIntoView({ behavior: 'smooth' });
    }
}

function updateChart(probabilities) {
    const ctx = document.getElementById('probabilitiesChart');
    if (!ctx) return;
    
    const canvasCtx = ctx.getContext('2d');
    
    if (chart) {
        chart.destroy();
    }
    
    chart = new Chart(canvasCtx, {
        type: 'bar',
        data: {
            labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
            datasets: [{
                label: 'Probabilidad (%)',
                data: probabilities.map(p => p * 100),
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.raw.toFixed(1)}%`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probabilidad (%)' } },
                x: { title: { display: true, text: 'Dígito' } }
            }
        }
    });
}

function updateTop3(probabilities, predictedClass) {
    const top3 = probabilities
        .map((prob, idx) => ({ digit: idx, probability: prob }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3);
    
    const top3List = document.getElementById('top3List');
    if (!top3List) return;
    
    top3List.innerHTML = '';
    const rankIcons = ['🥇', '🥈', '🥉'];
    
    top3.forEach((item, index) => {
        const percent = (item.probability * 100).toFixed(1);
        const isWinner = item.digit.toString() === predictedClass;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'top3-item';
        if (isWinner) itemDiv.style.background = 'linear-gradient(135deg, #667eea15, #764ba215)';
        
        itemDiv.innerHTML = `
            <div class="top3-rank">${rankIcons[index]}</div>
            <div class="top3-digit">${item.digit}</div>
            <div class="top3-bar">
                <div class="top3-bar-fill" style="width: ${percent}%">${percent}%</div>
            </div>
        `;
        
        top3List.appendChild(itemDiv);
    });
}

function resetPrediction() {
    const resultsPanel = document.getElementById('resultsPanel');
    if (resultsPanel) resultsPanel.style.display = 'none';
    
    if (currentInputMode === 'upload') {
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-content">
                    <i class="fas fa-cloud-upload-alt upload-icon"></i>
                    <h3>Arrastra o selecciona una imagen</h3>
                    <p>Soporta JPG, PNG, WEBP (máx. 5MB)</p>
                    <button class="btn-secondary" id="selectFileBtn">
                        <i class="fas fa-folder-open"></i> Seleccionar archivo
                    </button>
                    <input type="file" id="fileInput" accept="image/*" hidden>
                </div>
            `;
            
            const selectFileBtn = document.getElementById('selectFileBtn');
            const fileInput = document.getElementById('fileInput');
            if (selectFileBtn) selectFileBtn.addEventListener('click', () => fileInput.click());
            if (fileInput) fileInput.addEventListener('change', handleFileSelect);
        }
        currentImageData = null;
    } else if (currentInputMode === 'draw') {
        clearCanvas();
        currentImageData = null;
    }
    
    const predictBtn = document.getElementById('predictBtn');
    if (predictBtn) predictBtn.disabled = true;
}

function exportResults() {
    const predictedDigit = document.getElementById('predictedDigit');
    const confidencePercent = document.getElementById('confidencePercent');
    
    const report = `=== REPORTE MNIST PRO ===
Fecha: ${new Date().toLocaleString()}
Modo: ${currentInputMode === 'upload' ? 'Carga' : 'Dibujo'}
Dígito: ${predictedDigit ? predictedDigit.textContent : '?'}
Confianza: ${confidencePercent ? confidencePercent.textContent : '?'}
=========================`;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mnist_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

console.log('🎨 Frontend profesional cargado correctamente');