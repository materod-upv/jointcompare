// Estado de la aplicación
const state = {
  images: [],
  selectedLayerIndex: null,
  globalZoom: 100,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  isMarkingReference: false
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
  autoAdjustBrightness: document.getElementById('autoAdjustBrightness'),
  markReferenceBtn: document.getElementById('markReferenceBtn'),
  alignByReferenceBtn: document.getElementById('alignByReferenceBtn')
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
  elements.scaleControl.addEventListener('input', handleScaleControl);
  elements.resetPosition.addEventListener('click', resetSelectedLayerPosition);
  elements.autoAdjustBrightness.addEventListener('click', autoAdjustBrightness);
  elements.markReferenceBtn.addEventListener('click', toggleMarkReferenceMode);
  elements.alignByReferenceBtn.addEventListener('click', alignByReferences);

  elements.arrowButtons.forEach(btn => {
    btn.addEventListener('click', () => handleArrowKey(btn.dataset.direction));
  });

  // Teclado para alineación
  document.addEventListener('keydown', handleKeyboard);

  // Zoom con rueda del ratón
  elements.layersContainer.addEventListener('wheel', handleWheelZoom, { passive: false });
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
    scale: 100,
    locked: false,
    visible: true,
    referencePoint: null
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

    // Marcar visualmente la capa seleccionada
    if (index === state.selectedLayerIndex) {
      img.classList.add('selected-layer');
    }

    // Aplicar filtro de brillo de capa
    const layerBrightness = imageData.brightness || 100;
    img.style.filter = `brightness(${layerBrightness}%)`;

    // Aplicar zoom global y escala individual
    const zoom = state.globalZoom / 100;
    const layerScale = (imageData.scale || 100) / 100;
    const finalScale = zoom * layerScale;
    layerDiv.style.transform = `translate(calc(-50% + ${imageData.offsetX}px), calc(-50% + ${imageData.offsetY}px)) scale(${finalScale})`;

    layerDiv.appendChild(img);

    // Mostrar punto de referencia si existe
    if (imageData.referencePoint) {
      const refMarker = document.createElement('div');
      refMarker.className = 'reference-marker';
      // El punto está en píxeles desde el centro de la imagen original
      // Como el layerDiv ya tiene scale aplicado, el marcador se escalará automáticamente
      refMarker.style.left = `calc(50% + ${imageData.referencePoint.x}px)`;
      refMarker.style.top = `calc(50% + ${imageData.referencePoint.y}px)`;
      layerDiv.appendChild(refMarker);
    }

    // Event listeners para drag
    layerDiv.addEventListener('mousedown', (e) => {
      if (state.isMarkingReference) {
        // En modo de marcado de referencia, solo marcar puntos, no arrastrar
        if (index === state.selectedLayerIndex) {
          setReferencePoint(e, index, layerDiv);
        }
      } else {
        startDrag(e, index);
      }
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

  const scale = state.images[index].scale || 100;
  elements.scaleControl.value = scale;
  elements.scaleValue.textContent = Math.round(scale) + '%';
  elements.scaleControl.disabled = isLocked;

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
    elements.scaleControl.disabled = locked;
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

    elements.scaleControl.value = selectedImage.scale || 100;
    elements.scaleValue.textContent = Math.round(selectedImage.scale || 100) + '%';
    elements.scaleControl.disabled = isLocked;
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

// Controles globales
function handleWheelZoom(e) {
  e.preventDefault();

  // Incremento de zoom (positivo = zoom in, negativo = zoom out)
  const delta = e.deltaY > 0 ? -10 : 10;
  const newZoom = Math.min(900, Math.max(50, state.globalZoom + delta));

  state.globalZoom = newZoom;
  elements.zoomControl.value = newZoom;
  elements.zoomValue.textContent = newZoom + '%';
  renderLayers();
}

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
  renderLayers();
}

// Limpiar paciente
function clearPatient() {
  if (state.images.length === 0) return;

  if (confirm('¿Estás seguro de que quieres cerrar este paciente y comenzar con otro?')) {
    state.images = [];
    state.selectedLayerIndex = null;
    state.globalZoom = 100;
    elements.zoomControl.value = 100;
    elements.zoomValue.textContent = '100%';
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
  elements.scaleControl.disabled = !hasImages;
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
    alert('Haz clic en la imagen para marcar el punto de referencia');
  } else {
    elements.markReferenceBtn.textContent = 'Marcar Punto de Referencia';
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
  // Esto hace que sea independiente del zoom y más fácil de alinear
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

  state.images[index].referencePoint = {
    x: relX,  // píxeles desde el centro de la imagen original
    y: relY
  };

  // Desactivar modo de marcado
  state.isMarkingReference = false;
  elements.markReferenceBtn.textContent = 'Marcar Punto de Referencia';
  elements.markReferenceBtn.style.background = '';
  elements.layersContainer.style.cursor = '';

  renderLayers();
  renderLayersList();
}

// Alinear todas las capas por sus puntos de referencia
function alignByReferences() {
  const layersWithRef = state.images.filter(img => img.referencePoint !== null);

  if (layersWithRef.length < 2) {
    alert('Necesitas marcar puntos de referencia en al menos 2 capas');
    return;
  }

  // Usar la primera capa con referencia como base
  const baseLayer = layersWithRef[0];
  const baseIndex = state.images.indexOf(baseLayer);

  // Los puntos de referencia están en píxeles desde el centro de cada imagen original
  // Para alinearlos, necesitamos que todos apunten a la misma posición en pantalla

  // Posición absoluta del punto base teniendo en cuenta su escala
  const baseScale = (baseLayer.scale || 100) / 100;
  const baseAbsX = baseLayer.referencePoint.x * baseScale + baseLayer.offsetX;
  const baseAbsY = baseLayer.referencePoint.y * baseScale + baseLayer.offsetY;

  // Alinear todas las demás capas
  state.images.forEach((imageData, index) => {
    if (index !== baseIndex && imageData.referencePoint) {
      const scale = (imageData.scale || 100) / 100;

      // Calcular el offset necesario para que este punto coincida con el base
      imageData.offsetX = baseAbsX - (imageData.referencePoint.x * scale);
      imageData.offsetY = baseAbsY - (imageData.referencePoint.y * scale);
    }
  });

  renderLayers();
  alert(`Alineadas ${layersWithRef.length} capas por sus puntos de referencia`);
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

    // Actualizar controles si hay una capa seleccionada
    if (state.selectedLayerIndex !== null) {
      const selectedBrightness = state.images[state.selectedLayerIndex].brightness || 100;
      elements.brightnessControl.value = selectedBrightness;
      elements.brightnessValue.textContent = Math.round(selectedBrightness) + '%';
    }

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
