// Estado de la aplicación
const state = {
  images: [],
  selectedLayerIndex: null,
  globalZoom: 100,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  isMarkingReference: false,
  isPanning: false,
  panOffset: { x: 0, y: 0 },
  showReferencePoints: true // Mostrar u ocultar puntos de referencia
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
  contrastControl: document.getElementById('contrastControl'),
  contrastValue: document.getElementById('contrastValue'),
  saturationControl: document.getElementById('saturationControl'),
  saturationValue: document.getElementById('saturationValue'),
  scaleControl: document.getElementById('scaleControl'),
  scaleValue: document.getElementById('scaleValue'),
  rotationControl: document.getElementById('rotationControl'),
  rotationValue: document.getElementById('rotationValue'),
  resetPosition: document.getElementById('resetPosition'),
  arrowButtons: document.querySelectorAll('.btn-arrow'),
  autoAdjustBrightness: document.getElementById('autoAdjustBrightness'),
  markReferenceBtn: document.getElementById('markReferenceBtn'),
  alignByReferenceBtn: document.getElementById('alignByReferenceBtn'),
  showReferencePointsCheckbox: document.getElementById('showReferencePoints')
};

// Inicialización
function init() {
  setupEventListeners();
  updateControlsState();
}

// Configurar event listeners
function setupEventListeners() {
  elements.imageInput.addEventListener('change', handleImageUpload);
  elements.clearPatient.addEventListener('click', clearPatient);

  elements.zoomControl.addEventListener('input', handleGlobalZoom);
  elements.brightnessControl.addEventListener('input', handleBrightnessControl);
  elements.contrastControl.addEventListener('input', handleContrastControl);
  elements.saturationControl.addEventListener('input', handleSaturationControl);
  elements.scaleControl.addEventListener('input', handleScaleControl);
  elements.rotationControl.addEventListener('input', handleRotationControl);
  elements.resetPosition.addEventListener('click', resetSelectedLayerPosition);
  elements.autoAdjustBrightness.addEventListener('click', autoAdjustBrightness);
  elements.markReferenceBtn.addEventListener('click', toggleMarkReferenceMode);
  elements.alignByReferenceBtn.addEventListener('click', alignByReferences);
  elements.showReferencePointsCheckbox.addEventListener('change', (e) => {
    state.showReferencePoints = e.target.checked;
    renderLayers();
  });

  elements.arrowButtons.forEach(btn => {
    btn.addEventListener('click', () => handleArrowKey(btn.dataset.direction));
  });

  // Teclado para alineación
  document.addEventListener('keydown', handleKeyboard);

  // Zoom con rueda del ratón
  elements.layersContainer.addEventListener('wheel', handleWheelZoom, { passive: false });

  // Panning con Shift + arrastrar
  elements.layersContainer.addEventListener('mousedown', handlePanStart);

  // Botones de panning
  document.getElementById('panUp').addEventListener('click', () => handlePanButton('up'));
  document.getElementById('panDown').addEventListener('click', () => handlePanButton('down'));
  document.getElementById('panLeft').addEventListener('click', () => handlePanButton('left'));
  document.getElementById('panRight').addEventListener('click', () => handlePanButton('right'));
  document.getElementById('panCenter').addEventListener('click', resetPan);

  // Cambiar cursor cuando se presiona/suelta Shift
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift' && !state.isPanning && !state.isMarkingReference) {
      elements.layersContainer.style.cursor = 'grab';
      document.querySelectorAll('.image-layer').forEach(layer => {
        layer.style.cursor = 'grab';
      });
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' && !state.isPanning) {
      elements.layersContainer.style.cursor = '';
      document.querySelectorAll('.image-layer').forEach(layer => {
        layer.style.cursor = '';
      });
    }
  });
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
    opacity: 100,
    offsetX: 0,
    offsetY: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    scale: 100,
    locked: false,
    visible: true,
    referencePoints: [] // Array de hasta 2 puntos {x, y}
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

    // Marcar visualmente la capa seleccionada
    if (index === state.selectedLayerIndex) {
      layerDiv.classList.add('selected-layer');
    }

    const img = document.createElement('img');
    img.src = imageData.src;
    img.style.opacity = imageData.opacity / 100;

    // Aplicar filtros de imagen
    const layerBrightness = imageData.brightness !== undefined ? imageData.brightness : 100;
    const layerContrast = imageData.contrast !== undefined ? imageData.contrast : 100;
    const layerSaturation = imageData.saturation !== undefined ? imageData.saturation : 100;
    img.style.filter = `brightness(${layerBrightness}%) contrast(${layerContrast}%) saturate(${layerSaturation}%)`;

    // Aplicar escala individual de la capa
    const layerScale = (imageData.scale || 100) / 100;
    const layerRotation = imageData.rotation || 0;
    layerDiv.style.transform = `translate(calc(-50% + ${imageData.offsetX}px), calc(-50% + ${imageData.offsetY}px)) scale(${layerScale}) rotate(${layerRotation}deg)`;

    layerDiv.appendChild(img);

    // Mostrar puntos de referencia si existen y están habilitados
    if (state.showReferencePoints && imageData.referencePoints && imageData.referencePoints.length > 0) {
      imageData.referencePoints.forEach((refPoint, refIndex) => {
        const refMarker = document.createElement('div');
        refMarker.className = refIndex === 0 ? 'reference-marker' : 'reference-marker reference-marker-2';
        // El punto está en píxeles desde el centro de la imagen original
        // Como el layerDiv ya tiene scale aplicado, el marcador se escalará automáticamente
        refMarker.style.left = `calc(50% + ${refPoint.x}px)`;
        refMarker.style.top = `calc(50% + ${refPoint.y}px)`;
        layerDiv.appendChild(refMarker);
      });
    }

    // Event listeners para drag
    layerDiv.addEventListener('mousedown', (e) => {
      // Si Shift está presionado, mover la capa
      if (e.shiftKey && !state.isMarkingReference) {
        startDrag(e, index);
        return;
      }

      if (state.isMarkingReference) {
        // En modo de marcado de referencia, solo marcar puntos, no arrastrar
        if (index === state.selectedLayerIndex) {
          setReferencePoint(e, index, layerDiv);
        }
      }
      // Sin Shift, el pan se maneja en handlePanStart
    });
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
    if (imageData.locked) {
      layerItem.classList.add('locked');
    }
    if (!imageData.visible) {
      layerItem.classList.add('hidden');
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
                    <label style="margin-left: 10px;">
                        <input type="checkbox" ${imageData.locked ? 'checked' : ''} 
                               data-index="${index}" data-control="locked">
                        Bloqueada
                    </label>
                </div>
            </div>
        `;

    // NO hacer el item completo arrastrable
    layerItem.dataset.index = index;

    // Solo hacer arrastrable el header (nombre de la capa)
    const layerHeader = layerItem.querySelector('.layer-header');
    layerHeader.draggable = true;

    // Event listeners
    layerItem.addEventListener('click', (e) => {
      if (!e.target.closest('button') && !e.target.closest('input')) {
        selectLayer(index);
      }
    });

    // Drag and drop para reordenar - solo en el header
    layerHeader.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index);
      layerItem.classList.add('dragging');
    });

    layerHeader.addEventListener('dragend', (e) => {
      layerItem.classList.remove('dragging');
      // Limpiar todos los indicadores de drop
      document.querySelectorAll('.layer-item').forEach(item => {
        item.classList.remove('drag-over');
      });
    });

    layerItem.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      layerItem.classList.add('drag-over');
    });

    layerItem.addEventListener('dragleave', (e) => {
      layerItem.classList.remove('drag-over');
    });

    layerItem.addEventListener('drop', (e) => {
      e.preventDefault();
      layerItem.classList.remove('drag-over');

      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = index;

      if (fromIndex !== toIndex) {
        reorderLayers(fromIndex, toIndex);
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

    const lockedCheckbox = layerItem.querySelector('[data-control="locked"]');
    lockedCheckbox.addEventListener('change', (e) => {
      toggleLayerLocked(index, e.target.checked);
    });

    elements.layersList.appendChild(layerItem);
  });
}

// Seleccionar capa
function selectLayer(index) {
  state.selectedLayerIndex = index;
  const isLocked = state.images[index].locked;

  // Actualizar controles con los valores de la capa seleccionada
  const brightness = state.images[index].brightness || 100;
  elements.brightnessControl.value = brightness;
  elements.brightnessValue.textContent = Math.round(brightness) + '%';
  elements.brightnessControl.disabled = isLocked;

  const contrast = state.images[index].contrast || 100;
  elements.contrastControl.value = contrast;
  elements.contrastValue.textContent = Math.round(contrast) + '%';
  elements.contrastControl.disabled = isLocked;

  const saturation = state.images[index].saturation || 100;
  elements.saturationControl.value = saturation;
  elements.saturationValue.textContent = Math.round(saturation) + '%';
  elements.saturationControl.disabled = isLocked;

  const scale = state.images[index].scale || 100;
  elements.scaleControl.value = scale;
  elements.scaleValue.textContent = Math.round(scale) + '%';
  elements.scaleControl.disabled = isLocked;

  const rotation = state.images[index].rotation || 0;
  elements.rotationControl.value = rotation;
  elements.rotationValue.textContent = Math.round(rotation) + '°';
  elements.rotationControl.disabled = isLocked;

  renderLayers();
  renderLayersList();
}

// Actualizar opacidad de capa
function updateLayerOpacity(index, value) {
  // Permitir cambiar opacidad incluso si está bloqueada
  state.images[index].opacity = parseFloat(value);
  renderLayers();
}

// Actualizar brillo de capa
function updateLayerBrightness(index, value) {
  if (state.images[index].locked) return;
  state.images[index].brightness = parseFloat(value);
  renderLayers();
}

// Actualizar escala de capa
function updateLayerScale(index, value) {
  if (state.images[index].locked) return;
  state.images[index].scale = parseFloat(value);
  renderLayers();
}

// Toggle visibilidad de capa
function toggleLayerVisibility(index, visible) {
  state.images[index].visible = visible;
  renderLayers();
  renderLayersList();
}

// Toggle bloqueo de capa
function toggleLayerLocked(index, locked) {
  state.images[index].locked = locked;
  // Si es la capa seleccionada, actualizar controles
  if (index === state.selectedLayerIndex) {
    elements.brightnessControl.disabled = locked;
    elements.contrastControl.disabled = locked;
    elements.saturationControl.disabled = locked;
    elements.scaleControl.disabled = locked;
    elements.rotationControl.disabled = locked;
  }
  renderLayersList();
}

// Reordenar capas
function reorderLayers(fromIndex, toIndex) {
  // Mover elemento en el array
  const [movedItem] = state.images.splice(fromIndex, 1);
  state.images.splice(toIndex, 0, movedItem);

  // Actualizar selectedLayerIndex si es necesario
  if (state.selectedLayerIndex === fromIndex) {
    state.selectedLayerIndex = toIndex;
  } else if (fromIndex < state.selectedLayerIndex && toIndex >= state.selectedLayerIndex) {
    state.selectedLayerIndex--;
  } else if (fromIndex > state.selectedLayerIndex && toIndex <= state.selectedLayerIndex) {
    state.selectedLayerIndex++;
  }

  renderLayers();
  renderLayersList();
}

// Eliminar capa
function removeLayer(index) {
  state.images.splice(index, 1);

  // Ajustar la selección
  if (state.images.length === 0) {
    // No quedan capas
    state.selectedLayerIndex = null;
  } else if (state.selectedLayerIndex === index) {
    // Se eliminó la capa seleccionada, seleccionar otra
    if (index >= state.images.length) {
      // Era la última, seleccionar la nueva última
      state.selectedLayerIndex = state.images.length - 1;
    } else {
      // Seleccionar la que ahora está en la misma posición
      state.selectedLayerIndex = index;
    }
  } else if (state.selectedLayerIndex > index) {
    // Ajustar índice si era posterior a la eliminada
    state.selectedLayerIndex--;
  }

  updateImageCount();
  renderLayers();
  renderLayersList();

  // Actualizar controles con la nueva capa seleccionada
  if (state.selectedLayerIndex !== null) {
    const selectedImage = state.images[state.selectedLayerIndex];
    const isLocked = selectedImage.locked;

    elements.brightnessControl.value = selectedImage.brightness || 100;
    elements.brightnessValue.textContent = Math.round(selectedImage.brightness || 100) + '%';
    elements.brightnessControl.disabled = isLocked;

    elements.contrastControl.value = selectedImage.contrast || 100;
    elements.contrastValue.textContent = Math.round(selectedImage.contrast || 100) + '%';
    elements.contrastControl.disabled = isLocked;

    elements.saturationControl.value = selectedImage.saturation || 100;
    elements.saturationValue.textContent = Math.round(selectedImage.saturation || 100) + '%';
    elements.saturationControl.disabled = isLocked;

    elements.scaleControl.value = selectedImage.scale || 100;
    elements.scaleValue.textContent = Math.round(selectedImage.scale || 100) + '%';
    elements.scaleControl.disabled = isLocked;

    elements.rotationControl.value = selectedImage.rotation || 0;
    elements.rotationValue.textContent = Math.round(selectedImage.rotation || 0) + '°';
    elements.rotationControl.disabled = isLocked;
  }
}

// Drag and drop para alineación
function startDrag(e, index) {
  if (e.button !== 0) return; // Solo botón izquierdo
  if (state.images[index].locked) return; // No arrastrar capas bloqueadas

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

// Panning de la vista (arrastrar sin Shift)
function handlePanStart(e) {
  // Pan solo cuando NO se presiona Shift
  if (!e.shiftKey && !state.isMarkingReference) {
    e.preventDefault();
    state.isPanning = true;
    state.dragStart = { x: e.clientX - state.panOffset.x, y: e.clientY - state.panOffset.y };

    document.addEventListener('mousemove', handlePanDrag);
    document.addEventListener('mouseup', stopPan);

    elements.layersContainer.style.cursor = 'grabbing';
    // Aplicar cursor también a las capas individuales
    document.querySelectorAll('.image-layer').forEach(layer => {
      layer.style.cursor = 'grabbing';
    });
  }
}

function handlePanDrag(e) {
  if (!state.isPanning) return;

  state.panOffset.x = e.clientX - state.dragStart.x;
  state.panOffset.y = e.clientY - state.dragStart.y;

  // Aplicar transform con pan y zoom
  const zoom = state.globalZoom / 100;
  elements.layersContainer.style.transform = `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${zoom})`;
}

function stopPan() {
  state.isPanning = false;
  document.removeEventListener('mousemove', handlePanDrag);
  document.removeEventListener('mouseup', stopPan);
  elements.layersContainer.style.cursor = '';
  // Restaurar cursor de las capas
  document.querySelectorAll('.image-layer').forEach(layer => {
    layer.style.cursor = '';
  });
}

// Panning con botones
function handlePanButton(direction) {
  const step = 50; // píxeles por movimiento

  switch (direction) {
    case 'up':
      state.panOffset.y += step;
      break;
    case 'down':
      state.panOffset.y -= step;
      break;
    case 'left':
      state.panOffset.x += step;
      break;
    case 'right':
      state.panOffset.x -= step;
      break;
  }

  // Aplicar transform con pan y zoom
  const zoom = state.globalZoom / 100;
  elements.layersContainer.style.transform = `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${zoom})`;
}

function resetPan() {
  state.panOffset = { x: 0, y: 0 };
  state.globalZoom = 100;
  elements.zoomControl.value = 100;
  elements.zoomValue.textContent = '100%';
  elements.layersContainer.style.transform = `translate(0px, 0px) scale(1)`;
}

// Controles globales
function handleWheelZoom(e) {
  e.preventDefault();

  // Incremento de zoom (positivo = zoom in, negativo = zoom out)
  const delta = e.deltaY > 0 ? -10 : 10;
  const newZoom = Math.min(900, Math.max(50, state.globalZoom + delta));

  state.globalZoom = newZoom;
  elements.zoomControl.value = newZoom;
  elements.zoomValue.textContent = newZoom + '%';

  // Aplicar zoom y pan al contenedor completo
  const zoom = newZoom / 100;
  elements.layersContainer.style.transform = `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${zoom})`;
}

function handleGlobalZoom(e) {
  state.globalZoom = parseFloat(e.target.value);
  elements.zoomValue.textContent = state.globalZoom + '%';

  // Aplicar zoom y pan al contenedor completo
  const zoom = state.globalZoom / 100;
  elements.layersContainer.style.transform = `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${zoom})`;
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

function handleContrastControl(e) {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    elements.contrastControl.value = 100;
    elements.contrastValue.textContent = '100%';
    return;
  }

  const contrast = parseFloat(e.target.value);
  state.images[state.selectedLayerIndex].contrast = contrast;
  elements.contrastValue.textContent = Math.round(contrast) + '%';
  renderLayers();
}

function handleSaturationControl(e) {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    elements.saturationControl.value = 100;
    elements.saturationValue.textContent = '100%';
    return;
  }

  const saturation = parseFloat(e.target.value);
  state.images[state.selectedLayerIndex].saturation = saturation;
  elements.saturationValue.textContent = Math.round(saturation) + '%';
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

function handleRotationControl(e) {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    elements.rotationControl.value = 0;
    elements.rotationValue.textContent = '0°';
    return;
  }

  const rotation = parseFloat(e.target.value);
  state.images[state.selectedLayerIndex].rotation = rotation;
  elements.rotationValue.textContent = Math.round(rotation) + '°';
  renderLayers();
}

// Alineación con teclado/botones
function handleKeyboard(e) {
  const key = e.key.toLowerCase();

  // Toggle mostrar puntos de referencia con tecla 'R'
  if (key === 'r') {
    e.preventDefault();
    state.showReferencePoints = !state.showReferencePoints;
    elements.showReferencePointsCheckbox.checked = state.showReferencePoints;
    renderLayers();
    return;
  }

  // Cambiar capa activa con Tab
  if (e.key === 'Tab') {
    e.preventDefault();
    if (state.images.length === 0) return;

    if (e.shiftKey) {
      // Shift+Tab: capa anterior
      const newIndex = state.selectedLayerIndex === null || state.selectedLayerIndex === 0
        ? state.images.length - 1
        : state.selectedLayerIndex - 1;
      selectLayer(newIndex);
    } else {
      // Tab: siguiente capa
      const newIndex = state.selectedLayerIndex === null || state.selectedLayerIndex === state.images.length - 1
        ? 0
        : state.selectedLayerIndex + 1;
      selectLayer(newIndex);
    }
    return;
  }

  // Alinear por referencias con tecla 'A'
  if (key === 'a') {
    e.preventDefault();
    alignByReferences();
    return;
  }

  // Marcar puntos de referencia con tecla 'M'
  if (key === 'm') {
    e.preventDefault();
    toggleMarkReferenceMode();
    return;
  }

  // Igualar tonos con tecla 'T'
  if (key === 't') {
    e.preventDefault();
    autoAdjustBrightness();
    return;
  }

  if (state.selectedLayerIndex === null) return;

  const index = state.selectedLayerIndex;

  // Toggle visibilidad de capa con tecla 'V'
  if (key === 'v') {
    e.preventDefault();
    const newVisibleState = !state.images[index].visible;
    toggleLayerVisibility(index, newVisibleState);
    return;
  }

  // Toggle bloqueo de capa con tecla 'B'
  if (key === 'b') {
    e.preventDefault();
    const newLockedState = !state.images[index].locked;
    toggleLayerLocked(index, newLockedState);
    return;
  }

  // Verificar si la capa está bloqueada para operaciones de transformación
  if (state.images[index].locked && (key === '+' || key === '-' || key === ',' || key === '.')) {
    alert('Esta capa está bloqueada');
    return;
  }

  // Escalar con + y -
  if (key === '+' || key === '=') {
    e.preventDefault();
    const currentScale = state.images[index].scale || 100;
    const newScale = Math.min(200, currentScale + 5);
    state.images[index].scale = newScale;
    elements.scaleControl.value = newScale;
    elements.scaleValue.textContent = Math.round(newScale) + '%';
    renderLayers();
    return;
  }

  if (key === '-' || key === '_') {
    e.preventDefault();
    const currentScale = state.images[index].scale || 100;
    const newScale = Math.max(50, currentScale - 5);
    state.images[index].scale = newScale;
    elements.scaleControl.value = newScale;
    elements.scaleValue.textContent = Math.round(newScale) + '%';
    renderLayers();
    return;
  }

  // Rotar con , y .
  if (key === ',') {
    e.preventDefault();
    const currentRotation = state.images[index].rotation || 0;
    const newRotation = Math.max(-180, currentRotation - 5);
    state.images[index].rotation = newRotation;
    elements.rotationControl.value = newRotation;
    elements.rotationValue.textContent = Math.round(newRotation) + '°';
    renderLayers();
    return;
  }

  if (key === '.') {
    e.preventDefault();
    const currentRotation = state.images[index].rotation || 0;
    const newRotation = Math.min(180, currentRotation + 5);
    state.images[index].rotation = newRotation;
    elements.rotationControl.value = newRotation;
    elements.rotationValue.textContent = Math.round(newRotation) + '°';
    renderLayers();
    return;
  }

  // Mover con flechas
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();

    const direction = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right'
    }[e.key];

    handleArrowKey(direction);
  }
}

function handleArrowKey(direction) {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    return;
  }

  const index = state.selectedLayerIndex;

  if (state.images[index].locked) {
    alert('Esta capa está bloqueada');
    return;
  }

  const step = 5; // píxeles por movimiento

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

  if (state.images[state.selectedLayerIndex].locked) {
    alert('Esta capa está bloqueada');
    return;
  }

  state.images[state.selectedLayerIndex].offsetX = 0;
  state.images[state.selectedLayerIndex].offsetY = 0;
  state.images[state.selectedLayerIndex].scale = 100;
  state.images[state.selectedLayerIndex].rotation = 0;

  // Actualizar controles
  elements.scaleControl.value = 100;
  elements.scaleValue.textContent = '100%';
  elements.rotationControl.value = 0;
  elements.rotationValue.textContent = '0°';

  renderLayers();
}

// Limpiar paciente
function clearPatient() {
  if (state.images.length === 0) return;

  if (confirm('¿Estás seguro de que quieres cerrar este paciente y comenzar con otro?')) {
    state.images = [];
    state.selectedLayerIndex = null;
    state.globalZoom = 100;
    state.panOffset = { x: 0, y: 0 };
    elements.zoomControl.value = 100;
    elements.zoomValue.textContent = '100%';
    elements.layersContainer.style.transform = 'translate(0px, 0px) scale(1)';
    updateImageCount();
    renderLayers();
    renderLayersList();
    resetGlobalControls();
  }
}

// Actualizar contador de imágenes
function updateImageCount() {
  elements.imageCount.textContent = state.images.length;
  updateControlsState();
}

// Habilitar/deshabilitar controles según si hay capas
function updateControlsState() {
  const hasImages = state.images.length > 0;

  // Controles de visualización
  elements.zoomControl.disabled = !hasImages;
  elements.autoAdjustBrightness.disabled = !hasImages;

  // Controles de alineación
  elements.markReferenceBtn.disabled = !hasImages;
  elements.alignByReferenceBtn.disabled = !hasImages;
  elements.brightnessControl.disabled = !hasImages;
  elements.contrastControl.disabled = !hasImages;
  elements.saturationControl.disabled = !hasImages;
  elements.scaleControl.disabled = !hasImages;
  elements.rotationControl.disabled = !hasImages;
  elements.resetPosition.disabled = !hasImages;

  // Botones de flechas
  elements.arrowButtons.forEach(btn => {
    btn.disabled = !hasImages;
  });
}

// Toggle modo de marcado de referencia
function toggleMarkReferenceMode() {
  if (state.selectedLayerIndex === null) {
    alert('Selecciona una capa primero');
    return;
  }

  state.isMarkingReference = !state.isMarkingReference;

  if (state.isMarkingReference) {
    elements.markReferenceBtn.textContent = 'Cancelar Marcado';
    elements.markReferenceBtn.style.background = '#e74c3c';
    elements.layersContainer.style.cursor = 'crosshair';

    const currentPoints = state.images[state.selectedLayerIndex].referencePoints || [];
    if (currentPoints.length === 0) {
      alert('Marca el primer punto de referencia (para posición)');
    } else if (currentPoints.length === 1) {
      alert('Marca el segundo punto de referencia (para escala)');
    }
  } else {
    elements.markReferenceBtn.textContent = 'Marcar Puntos de Referencia';
    elements.markReferenceBtn.style.background = '';
    elements.layersContainer.style.cursor = '';
  }
}

// Establecer punto de referencia en una capa
function setReferencePoint(e, index, layerDiv) {
  e.preventDefault();
  e.stopPropagation();

  const imageData = state.images[index];
  const img = layerDiv.querySelector('img');
  const rect = img.getBoundingClientRect();

  // Guardar la posición del clic como píxeles absolutos en el viewport
  const screenX = e.clientX;
  const screenY = e.clientY;

  // Guardar también el zoom/escala actual para poder recalcular
  const zoom = state.globalZoom / 100;
  const layerScale = (imageData.scale || 100) / 100;
  const totalScale = zoom * layerScale;

  // Calcular posición relativa al centro de la imagen (en píxeles de imagen original)
  const imgCenterX = rect.left + rect.width / 2;
  const imgCenterY = rect.top + rect.height / 2;
  const relX = (screenX - imgCenterX) / totalScale;
  const relY = (screenY - imgCenterY) / totalScale;

  // Inicializar array si no existe
  if (!state.images[index].referencePoints) {
    state.images[index].referencePoints = [];
  }

  // Agregar punto (máximo 2)
  if (state.images[index].referencePoints.length < 2) {
    state.images[index].referencePoints.push({ x: relX, y: relY });
  } else {
    // Si ya hay 2, reemplazar el primero y empezar de nuevo
    state.images[index].referencePoints = [{ x: relX, y: relY }];
  }

  // Si ya tenemos 2 puntos, desactivar modo de marcado
  if (state.images[index].referencePoints.length === 2) {
    state.isMarkingReference = false;
    elements.markReferenceBtn.textContent = 'Marcar Puntos de Referencia';
    elements.markReferenceBtn.style.background = '';
    elements.layersContainer.style.cursor = '';
  }

  renderLayers();
  renderLayersList();
}

// Alinear todas las capas por sus puntos de referencia
function alignByReferences() {
  const layersWithRef = state.images.filter(img => img.referencePoints && img.referencePoints.length > 0);

  if (layersWithRef.length < 2) {
    alert('Necesitas marcar puntos de referencia en al menos 2 capas');
    return;
  }

  // Usar la primera capa con referencias como base
  const baseLayer = layersWithRef[0];
  const baseIndex = state.images.indexOf(baseLayer);
  const basePoints = baseLayer.referencePoints;

  // Si la base tiene 2 puntos, calcular distancia y ángulo base
  let baseDistance = null;
  let baseAngle = null;
  if (basePoints.length === 2) {
    const dx = basePoints[1].x - basePoints[0].x;
    const dy = basePoints[1].y - basePoints[0].y;
    baseDistance = Math.sqrt(dx * dx + dy * dy);
    baseAngle = Math.atan2(dy, dx) * (180 / Math.PI); // Convertir a grados
  }

  const baseScale = (baseLayer.scale || 100) / 100;
  const baseRotation = baseLayer.rotation || 0;
  const basePoint1 = basePoints[0];
  const baseAbsX = basePoint1.x * baseScale + baseLayer.offsetX;
  const baseAbsY = basePoint1.y * baseScale + baseLayer.offsetY;

  // Alinear todas las demás capas
  state.images.forEach((imageData, index) => {
    if (index === baseIndex || !imageData.referencePoints || imageData.referencePoints.length === 0 || imageData.locked) {
      return;
    }

    const points = imageData.referencePoints;
    const point1 = points[0];

    // Si ambas capas tienen 2 puntos, calcular y ajustar escala y rotación
    if (baseDistance && baseAngle !== null && points.length === 2) {
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Calcular la escala necesaria para que las distancias coincidan
      const scaleRatio = baseDistance / currentDistance;
      imageData.scale = Math.min(200, Math.max(50, scaleRatio * 100));

      // Calcular la rotación necesaria para que los ángulos coincidan
      imageData.rotation = baseAngle - currentAngle + baseRotation;
    }

    // Aplicar el nuevo scale para calcular la posición
    const newScale = (imageData.scale || 100) / 100;

    // Calcular el offset necesario para que el primer punto coincida con el base
    imageData.offsetX = baseAbsX - (point1.x * newScale);
    imageData.offsetY = baseAbsY - (point1.y * newScale);
  });

  renderLayers();
  renderLayersList();

  // Actualizar controles si hay capa seleccionada
  if (state.selectedLayerIndex !== null) {
    const selected = state.images[state.selectedLayerIndex];
    elements.scaleControl.value = selected.scale;
    elements.scaleValue.textContent = Math.round(selected.scale) + '%';
    elements.rotationControl.value = selected.rotation || 0;
    elements.rotationValue.textContent = Math.round(selected.rotation || 0) + '°';
  }

  const withTwoPoints = layersWithRef.filter(l => l.referencePoints.length === 2).length;
  if (withTwoPoints > 1) {
    alert(`Alineadas ${layersWithRef.length} capas (${withTwoPoints} con ajuste de escala y rotación)`);
  } else {
    alert(`Alineadas ${layersWithRef.length} capas por posición`);
  }
}

// Ajuste automático de iluminación basado en tono de piel
function autoAdjustBrightness() {
  if (state.images.length === 0) {
    alert('Carga algunas fotos primero');
    return;
  }

  // Analizar las propiedades de cada imagen
  const analysisPromises = state.images.map((imageData, index) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const analysis = analyzeImageProperties(img);
        resolve({ index, ...analysis });
      };
      img.src = imageData.src;
    });
  });

  Promise.all(analysisPromises).then(results => {
    // Calcular promedios de todas las imágenes
    const avgBrightness = results.reduce((sum, r) => sum + r.brightness, 0) / results.length;
    const avgContrast = results.reduce((sum, r) => sum + r.contrast, 0) / results.length;
    const avgSaturation = results.reduce((sum, r) => sum + r.saturation, 0) / results.length;

    // Ajustar cada imagen para que coincida con los promedios
    results.forEach(({ index, brightness, contrast, saturation }) => {
      // Ajustar brillo
      const brightnessAdjust = avgBrightness / brightness;
      state.images[index].brightness = Math.min(200, Math.max(50, brightnessAdjust * 100));

      // Ajustar contraste
      const contrastAdjust = avgContrast / contrast;
      state.images[index].contrast = Math.min(200, Math.max(50, contrastAdjust * 100));

      // Ajustar saturación
      const saturationAdjust = avgSaturation / saturation;
      state.images[index].saturation = Math.min(200, Math.max(0, saturationAdjust * 100));
    });

    renderLayers();
    renderLayersList();

    // Actualizar controles si hay una capa seleccionada
    if (state.selectedLayerIndex !== null) {
      const selected = state.images[state.selectedLayerIndex];
      elements.brightnessControl.value = selected.brightness;
      elements.brightnessValue.textContent = Math.round(selected.brightness) + '%';
      elements.contrastControl.value = selected.contrast;
      elements.contrastValue.textContent = Math.round(selected.contrast) + '%';
      elements.saturationControl.value = selected.saturation;
      elements.saturationValue.textContent = Math.round(selected.saturation) + '%';
    }

    alert('Tonos ajustados automáticamente (brillo, contraste y saturación)');
  });
}

// Analizar propiedades de una imagen
function analyzeImageProperties(img) {
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
    let totalSaturation = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    let pixelCount = 0;

    // Muestrear cada 4 píxeles para mayor velocidad
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calcular luminancia percibida
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);

      // Calcular saturación aproximada
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      totalSaturation += saturation;

      pixelCount++;
    }

    const avgBrightness = totalBrightness / pixelCount;
    const avgSaturation = totalSaturation / pixelCount;
    // Contraste como el rango entre valores más claros y oscuros
    const contrast = maxBrightness - minBrightness;

    return {
      brightness: avgBrightness,
      contrast: contrast,
      saturation: avgSaturation * 255 // Normalizar a 0-255
    };
  } catch (e) {
    console.error('Error analizando imagen:', e);
    return { brightness: 128, contrast: 128, saturation: 128 };
  }
}

// Iniciar aplicación
init();
