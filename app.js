// Estado de la aplicación
const state = {
  images: [],
  selectedLayerIndex: null,
  globalZoom: 100,
  isDragging: false,
  dragStart: { x: 0, y: 0 }
};

// Referencias a elementos del DOM
const elements = {
  imageInput: document.getElementById('imageInput'),
  clearPatient: document.getElementById('clearPatient'),
  imageCount: document.getElementById('imageCount'),
  layersList: document.getElementById('layersList'),
  layersContainer: document.getElementById('layersContainer'),
  zoomControl: document.getElementById('zoomControl'),
  zoomValue: document.getElementById('zoomValue'),
  brightnessControl: document.getElementById('brightnessControl'),
  brightnessValue: document.getElementById('brightnessValue'),
  scaleControl: document.getElementById('scaleControl'),
  scaleValue: document.getElementById('scaleValue'),
  resetPosition: document.getElementById('resetPosition'),
  arrowButtons: document.querySelectorAll('.btn-arrow'),
  autoAdjustBrightness: document.getElementById('autoAdjustBrightness')
};

// Inicialización
function init() {
  setupEventListeners();
}

// Configurar event listeners
function setupEventListeners() {
  elements.imageInput.addEventListener('change', handleImageUpload);
  elements.clearPatient.addEventListener('click', clearPatient);

  elements.zoomControl.addEventListener('input', handleGlobalZoom);
  elements.brightnessControl.addEventListener('input', handleBrightnessControl);
  elements.scaleControl.addEventListener('input', handleScaleControl);
  elements.resetPosition.addEventListener('click', resetSelectedLayerPosition);
  elements.autoAdjustBrightness.addEventListener('click', autoAdjustBrightness);

  elements.arrowButtons.forEach(btn => {
    btn.addEventListener('click', () => handleArrowKey(btn.dataset.direction));
  });

  // Teclado para alineación
  document.addEventListener('keydown', handleKeyboard);
}

// Manejo de carga de imágenes
function handleImageUpload(e) {
  const files = Array.from(e.target.files);

  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      addImageLayer(event.target.result, file.name);
    };
    reader.readAsDataURL(file);
  });

  // Reset input para permitir cargar el mismo archivo
  e.target.value = '';
}

// Agregar nueva capa de imagen
function addImageLayer(src, name) {
  const imageData = {
    id: Date.now() + Math.random(),
    src: src,
    name: name,
    opacity: 50,
    offsetX: 0,
    offsetY: 0,
    brightness: 100,
    scale: 100,
    visible: true
  };

  state.images.push(imageData);
  updateImageCount();
  renderLayers();
  renderLayersList();

  // Seleccionar automáticamente la nueva capa
  selectLayer(state.images.length - 1);
}

// Renderizar capas en el canvas
function renderLayers() {
  elements.layersContainer.innerHTML = '';

  state.images.forEach((imageData, index) => {
    if (!imageData.visible) return;

    const layerDiv = document.createElement('div');
    layerDiv.className = 'image-layer';
    layerDiv.dataset.index = index;

    const img = document.createElement('img');
    img.src = imageData.src;
    img.style.opacity = imageData.opacity / 100;

    // Aplicar filtro de brillo de capa
    const layerBrightness = imageData.brightness || 100;
    img.style.filter = `brightness(${layerBrightness}%)`;

    // Aplicar zoom global y escala individual
    const zoom = state.globalZoom / 100;
    const layerScale = (imageData.scale || 100) / 100;
    const finalScale = zoom * layerScale;
    layerDiv.style.transform = `translate(calc(-50% + ${imageData.offsetX}px), calc(-50% + ${imageData.offsetY}px)) scale(${finalScale})`;

    layerDiv.appendChild(img);

    // Event listeners para drag
    layerDiv.addEventListener('mousedown', (e) => startDrag(e, index));
    layerDiv.addEventListener('click', () => selectLayer(index));

    elements.layersContainer.appendChild(layerDiv);
  });
}

// Renderizar lista de capas en el panel de control
function renderLayersList() {
  elements.layersList.innerHTML = '';

  state.images.forEach((imageData, index) => {
    const layerItem = document.createElement('div');
    layerItem.className = 'layer-item';
    if (index === state.selectedLayerIndex) {
      layerItem.classList.add('selected');
    }

    layerItem.innerHTML = `
            <div class="layer-header">
                <span class="layer-name">${imageData.name}</span>
                <button class="btn-remove" data-index="${index}">✕</button>
            </div>
            <div class="layer-controls">
                <div class="layer-control-group">
                    <label>Opacidad</label>
                    <input type="range" min="0" max="100" value="${imageData.opacity}" 
                           data-index="${index}" data-control="opacity">
                    <span>${imageData.opacity}%</span>
                </div>
                <div class="layer-control-group">
                    <label>
                        <input type="checkbox" ${imageData.visible ? 'checked' : ''} 
                               data-index="${index}" data-control="visibility">
                        Visible
                    </label>
                </div>
            </div>
        `;

    // Event listeners
    layerItem.addEventListener('click', (e) => {
      if (!e.target.closest('button') && !e.target.closest('input')) {
        selectLayer(index);
      }
    });

    const removeBtn = layerItem.querySelector('.btn-remove');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeLayer(index);
    });

    const opacityInput = layerItem.querySelector('[data-control="opacity"]');
    opacityInput.addEventListener('input', (e) => {
      updateLayerOpacity(index, e.target.value);
      e.target.nextElementSibling.textContent = e.target.value + '%';
    });

    const visibilityCheckbox = layerItem.querySelector('[data-control="visibility"]');
    visibilityCheckbox.addEventListener('change', (e) => {
      toggleLayerVisibility(index, e.target.checked);
    });

    elements.layersList.appendChild(layerItem);
  });
}

// Seleccionar capa
function selectLayer(index) {
  state.selectedLayerIndex = index;
  // Actualizar controles con los valores de la capa seleccionada
  const brightness = state.images[index].brightness || 100;
  elements.brightnessControl.value = brightness;
  elements.brightnessValue.textContent = Math.round(brightness) + '%';

  const scale = state.images[index].scale || 100;
  elements.scaleControl.value = scale;
  elements.scaleValue.textContent = Math.round(scale) + '%';

  renderLayersList();
}

// Actualizar opacidad de capa
function updateLayerOpacity(index, value) {
  state.images[index].opacity = parseFloat(value);
  renderLayers();
}

// Actualizar brillo de capa
function updateLayerBrightness(index, value) {
  state.images[index].brightness = parseFloat(value);
  renderLayers();
}

// Actualizar escala de capa
function updateLayerScale(index, value) {
  state.images[index].scale = parseFloat(value);
  renderLayers();
}

// Toggle visibilidad de capa
function toggleLayerVisibility(index, visible) {
  state.images[index].visible = visible;
  renderLayers();
}

// Eliminar capa
function removeLayer(index) {
  state.images.splice(index, 1);
  if (state.selectedLayerIndex === index) {
    state.selectedLayerIndex = null;
  } else if (state.selectedLayerIndex > index) {
    state.selectedLayerIndex--;
  }
  updateImageCount();
  renderLayers();
  renderLayersList();
}

// Drag and drop para alineación
function startDrag(e, index) {
  if (e.button !== 0) return; // Solo botón izquierdo

  state.isDragging = true;
  state.selectedLayerIndex = index;
  state.dragStart = {
    x: e.clientX - state.images[index].offsetX,
    y: e.clientY - state.images[index].offsetY
  };

  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);

  e.preventDefault();
  renderLayersList();
}

function handleDrag(e) {
  if (!state.isDragging || state.selectedLayerIndex === null) return;

  const index = state.selectedLayerIndex;
  state.images[index].offsetX = e.clientX - state.dragStart.x;
  state.images[index].offsetY = e.clientY - state.dragStart.y;

  renderLayers();
}

function stopDrag() {
  state.isDragging = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// Controles globales
function handleGlobalZoom(e) {
  state.globalZoom = parseFloat(e.target.value);
  elements.zoomValue.textContent = state.globalZoom + '%';
  renderLayers();
}

function handleBrightnessControl(e) {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    elements.brightnessControl.value = 100;
    elements.brightnessValue.textContent = '100%';
    return;
  }

  const brightness = parseFloat(e.target.value);
  state.images[state.selectedLayerIndex].brightness = brightness;
  elements.brightnessValue.textContent = Math.round(brightness) + '%';
  renderLayers();
}

function handleScaleControl(e) {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    elements.scaleControl.value = 100;
    elements.scaleValue.textContent = '100%';
    return;
  }

  const scale = parseFloat(e.target.value);
  state.images[state.selectedLayerIndex].scale = scale;
  elements.scaleValue.textContent = Math.round(scale) + '%';
  renderLayers();
}

// Alineación con teclado/botones
function handleKeyboard(e) {
  if (state.selectedLayerIndex === null) return;

  const key = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
    e.preventDefault();

    const direction = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right'
    }[key];

    handleArrowKey(direction);
  }
}

function handleArrowKey(direction) {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    return;
  }

  const step = 5; // píxeles por movimiento
  const index = state.selectedLayerIndex;

  switch (direction) {
    case 'up':
      state.images[index].offsetY -= step;
      break;
    case 'down':
      state.images[index].offsetY += step;
      break;
    case 'left':
      state.images[index].offsetX -= step;
      break;
    case 'right':
      state.images[index].offsetX += step;
      break;
  }

  renderLayers();
}

function resetSelectedLayerPosition() {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    return;
  }

  state.images[state.selectedLayerIndex].offsetX = 0;
  state.images[state.selectedLayerIndex].offsetY = 0;
  renderLayers();
}

// Limpiar paciente
function clearPatient() {
  if (state.images.length === 0) return;

  if (confirm('¿Estás seguro de que quieres cerrar este paciente y comenzar con otro?')) {
    state.images = [];
    state.selectedLayerIndex = null;
    updateImageCount();
    renderLayers();
    renderLayersList();
    resetGlobalControls();
  }
}

// Actualizar contador de imágenes
function updateImageCount() {
  elements.imageCount.textContent = state.images.length;
}

// Ajuste automático de iluminación basado en tono de piel
function autoAdjustBrightness() {
  if (state.images.length === 0) {
    alert('Carga algunas fotos primero');
    return;
  }

  // Analizar el brillo promedio de cada imagen
  const brightnessPromises = state.images.map((imageData, index) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const brightness = analyzeImageBrightness(img);
        resolve({ index, brightness });
      };
      img.src = imageData.src;
    });
  });

  Promise.all(brightnessPromises).then(results => {
    // Calcular brillo promedio de todas las imágenes
    const avgBrightness = results.reduce((sum, r) => sum + r.brightness, 0) / results.length;

    // Ajustar cada imagen para que coincida con el promedio
    results.forEach(({ index, brightness }) => {
      // Calcular factor de ajuste (cuánto más claro/oscuro está vs el promedio)
      const adjustmentFactor = avgBrightness / brightness;
      // Convertir a porcentaje (100 = sin cambio)
      state.images[index].brightness = Math.min(200, Math.max(50, adjustmentFactor * 100));
    });

    renderLayers();
    renderLayersList();
    alert('Iluminación ajustada automáticamente para igualar tonos');
  });
}

// Analizar brillo promedio de una imagen
function analyzeImageBrightness(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Usar una versión reducida para análisis rápido
  const maxSize = 200;
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let totalBrightness = 0;
    let pixelCount = 0;

    // Muestrear cada 4 píxeles para mayor velocidad
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calcular luminancia percibida
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      pixelCount++;
    }

    return totalBrightness / pixelCount;
  } catch (e) {
    console.error('Error analizando imagen:', e);
    return 128; // Valor medio por defecto
  }
}

// Iniciar aplicación
init();
