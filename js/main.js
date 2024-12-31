document.addEventListener('DOMContentLoaded', function() {
    var map = L.map('map').setView([4.664628, -74.064095], 18);

    // Agregar capa base de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 21,
        keepBuffer: 6 // Mantener en caché 2 tiles adyacentes
    }).addTo(map);

    // Configuración de las capas WMS
    var wmsLayers = [
        { url: 'https://geoserver.scrd.gov.co/geoserver/Arcgis_online_DOGCC/wms', layerName: 'Arcgis_online_DOGCC:Barrios por prioridad', displayName: 'Barrios por prioridad' },
        { url: 'https://geoserver.scrd.gov.co/geoserver/Arcgis_online_DOGCC/wms', layerName: 'Arcgis_online_DOGCC:Barrios por tipo de programa', displayName: 'Barrios por tipo de programa' },
        { url: 'https://geoserver.scrd.gov.co/geoserver/Arcgis_online_DOGCC/wms', layerName: 'Arcgis_online_DOGCC:Barrios total', displayName: 'Barrios total' },
        { url: 'https://geoserver.scrd.gov.co/geoserver/Arcgis_online_DOGCC/wms', layerName: 'Arcgis_online_DOGCC:Localidades de Bogotá - Urbano', displayName: 'Localidades de Bogotá - Urbano' }
    ];

    var overlays = {}, activeLayers = [];

    // Inicializar capas WMS y el control de capas
    function setupWMSLayers() {
        wmsLayers.forEach(function(wmsLayer) {
            var layer = L.tileLayer.wms(wmsLayer.url, {
                layers: wmsLayer.layerName,
                format: 'image/png',
                transparent: true,
                maxZoom: 21
            });
            overlays[wmsLayer.displayName] = layer;
            layer.addTo(map);
            addLegendItem(wmsLayer.url, wmsLayer.layerName, wmsLayer.displayName);

            map.on('overlayadd', updateActiveLayers);
            map.on('overlayremove', updateActiveLayers);
        });
        L.control.layers(null, overlays, { collapsed: false }).addTo(map);
    }

    // Función para agregar elementos a la leyenda
    function addLegendItem(wmsUrl, layerName, displayName) {
        var legendUrl = `${wmsUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=${layerName}`;
        var legendContainer = document.getElementById('legend-content');

        var legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `<div class="legend-title">${displayName}</div><img src="${legendUrl}" alt="Leyenda de ${displayName}">`;
        legendContainer.appendChild(legendItem);
    }

    // Función para actualizar la leyenda según las capas activas
    function updateLegend() {
        var legendContainer = document.getElementById('legend-content');
        legendContainer.innerHTML = ''; // Limpiar contenido actual

        activeLayers.forEach(layer => {
            const wmsLayer = wmsLayers.find(w => w.layerName === layer.options.layers);
            if (wmsLayer) addLegendItem(wmsLayer.url, wmsLayer.layerName, wmsLayer.displayName);
        });
    }

    // Función para actualizar lista de capas activas y el panel de atributos
    function updateActiveLayers() {
        activeLayers = Object.values(overlays).filter(layer => map.hasLayer(layer));
        updateLegend();
        updateAttributesPanel();
    }

    // Función para actualizar el panel de atributos con pestañas por capa activa
    function updateAttributesPanel() {
        var attributesContent = document.getElementById('attributes-content');
        attributesContent.innerHTML = ''; // Limpiar el contenido anterior

        if (activeLayers.length > 0) {
            var tabContainer = document.createElement('div');
            tabContainer.className = 'tab-container';

            activeLayers.forEach(layer => {
                var tabButton = document.createElement('button');
                tabButton.className = 'tab-button';
                tabButton.innerText = wmsLayers.find(w => w.layerName === layer.options.layers).displayName;
                tabButton.onclick = () => switchToTab(layer); // Cambia a la tabla de atributos de la capa seleccionada
                tabContainer.appendChild(tabButton);
            });
            attributesContent.appendChild(tabContainer);

            // Mostrar la tabla de la primera capa activa por defecto
            switchToTab(activeLayers[0]);
        } else {
            attributesContent.innerHTML = '<p>No hay capas activas para mostrar atributos.</p>';
        }
    }

    // Función para cambiar entre tablas de atributos en función de la pestaña seleccionada
    function switchToTab(layer) {
        // Limpiar contenido previo de atributos
        var attributesContent = document.getElementById('attributes-content');
        var existingTable = document.getElementById('attributes-table');
        if (existingTable) existingTable.remove(); // Elimina la tabla previa antes de cargar la nueva

        var tableContainer = document.createElement('div');
        tableContainer.id = 'attributes-table'; // Identificador único para manejar la visibilidad de la tabla

        showAttributes(layer, tableContainer);
        attributesContent.appendChild(tableContainer);
    }

    // Función para mostrar los atributos completos de una capa específica
    async function showAttributes(layer, container) {
        container.innerHTML = ''; // Limpiar contenido del contenedor

        var displayName = wmsLayers.find(w => w.layerName === layer.options.layers).displayName;
        container.innerHTML = `<p><strong>Atributos de la capa:</strong> ${displayName}</p>`;

        var url = `${layer._url}?service=WFS&version=1.1.0&request=GetFeature&typeName=${layer.options.layers}&outputFormat=application/json`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                var table = document.createElement('table');
                table.className = 'attributes-table';

                var headerRow = document.createElement('tr');
                Object.keys(data.features[0].properties).forEach(key => {
                    var headerCell = document.createElement('th');
                    headerCell.innerText = key;
                    headerRow.appendChild(headerCell);
                });
                table.appendChild(headerRow);

                data.features.forEach(feature => {
                    var row = document.createElement('tr');
                    Object.values(feature.properties).forEach(value => {
                        var cell = document.createElement('td');
                        cell.innerText = value;
                        row.appendChild(cell);
                    });
                    table.appendChild(row);
                });

                container.appendChild(table);
            } else {
                container.innerHTML += '<p>No hay datos disponibles para esta capa.</p>';
            }
        } catch (error) {
            console.error('Error al obtener atributos:', error);
            container.innerHTML = '<p>Error al obtener los datos de la capa.</p>';
        }
    }

    // Función para manejar clics en el mapa y mostrar popup con GetFeatureInfo
    map.on('click', function(e) {
        var wmsUrl = 'https://geoserver.scrd.gov.co/geoserver/Arcgis_online_DOGCC/wms';
        var excludedLayer = 'Arcgis_online_DOGCC:Localidades'; // Nombre de la capa a excluir
    
        // Generar URL de GetFeatureInfo para todas las capas activas excepto la capa excluida
        var queryLayers = wmsLayers
            .filter(layer => layer.layerName !== excludedLayer)
            .map(layer => layer.layerName)
            .join(',');
    
        if (!queryLayers) return; // Si no hay capas para consultar, salir de la función
    
        var url = wmsUrl + L.Util.getParamString({
            request: 'GetFeatureInfo',
            service: 'WMS',
            srs: 'EPSG:4326',
            styles: '',
            version: '1.1.1',
            format: 'image/png',
            transparent: true,
            bbox: map.getBounds().toBBoxString(),
            height: map.getSize().y,
            width: map.getSize().x,
            layers: queryLayers,
            query_layers: queryLayers,
            info_format: 'application/json',
            x: Math.floor(e.containerPoint.x),
            y: Math.floor(e.containerPoint.y)
        });
    
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.features && data.features.length > 0) {
                    var props = data.features[0].properties;
                    var content = Object.entries(props).map(([key, value]) => `<b>${key}</b>: ${value}`).join('<br>');
                    L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
                } else {
                    L.popup().setLatLng(e.latlng).setContent('No hay información disponible en este punto.').openOn(map);
                }
            })
            .catch(error => console.error('Error al obtener los atributos:', error));
    });

    // Función para minimizar/desplegar la leyenda
    document.getElementById('toggle-legend').addEventListener('click', function() {
        var legend = document.getElementById('legend');
        legend.classList.toggle('minimized');
        this.textContent = legend.classList.contains('minimized') ? 'Desplegar' : 'Minimizar';
    });

    // Función para minimizar/desplegar el panel de atributos
    document.getElementById('toggle-attributes').addEventListener('click', function() {
        var attributesPanel = document.getElementById('attributes-panel');
        attributesPanel.classList.toggle('minimized');
        this.textContent = attributesPanel.classList.contains('minimized') ? 'Despliegue de atributos' : 'Minimizar';
    });

    // Inicializar capas y eventos
    setupWMSLayers();
    updateActiveLayers();

    

    var selectedFeatureLayer; // Variable para almacenar el objeto espacial seleccionado

    // Manejar doble clic en el mapa para seleccionar el objeto y resaltar su fila en la tabla de atributos
    // Crear un grupo de capas específico para el resaltado
var highlightLayerGroup = L.layerGroup().addTo(map); // Grupo para almacenar los resaltados

    // Manejar doble clic en el mapa para seleccionar el objeto y resaltar su fila en la tabla de atributos
    map.on('dblclick', function(e) {
        var wmsUrl = 'https://geoserver.scrd.gov.co/geoserver/Arcgis_online_DOGCC/wms';
        var excludedLayer = 'Arcgis_online_DOGCC:Localidades'; // Nombre de la capa a excluir

        // Generar URL de GetFeatureInfo para todas las capas activas excepto la capa excluida
        var queryLayers = wmsLayers
            .filter(layer => layer.layerName !== excludedLayer) // Excluir capa
            .map(layer => layer.layerName)
            .join(',');

        if (!queryLayers) return; // Si no hay capas para consultar, salir de la función

        var url = wmsUrl + L.Util.getParamString({
            request: 'GetFeatureInfo',
            service: 'WMS',
            srs: 'EPSG:4326',
            styles: '',
            version: '1.1.1',
            format: 'application/json',
            transparent: true,
            bbox: map.getBounds().toBBoxString(),
            height: map.getSize().y,
            width: map.getSize().x,
            layers: queryLayers, // Capas activas menos la excluida
            query_layers: queryLayers,
            info_format: 'application/json',
            x: Math.floor(e.containerPoint.x),
            y: Math.floor(e.containerPoint.y)
        });

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.features && data.features.length > 0) {
                    // Obtener los atributos del objeto seleccionado
                    var selectedProps = data.features[0].properties;

                    // Resaltar el objeto en el mapa
                    highlightMapFeature(data.features[0]);

                    // Resaltar la fila correspondiente en la tabla de atributos
                    highlightTableRow(selectedProps);
                }
            })
            .catch(error => console.error('Error al obtener los atributos:', error));
    });

    // Función para resaltar el objeto en el mapa
    function highlightMapFeature(feature) {
        // Limpia cualquier resaltado previo
        highlightLayerGroup.clearLayers();
    
        // Crear una capa para el objeto seleccionado con el marcador personalizado
        var highlightedLayer = L.geoJSON(feature, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, {
                    icon: L.icon({
                        iconUrl: './assets/images/localizador.png', // Verifica que esta ruta sea correcta y accesible
                        iconSize: [32, 32], // Tamaño del icono
                        iconAnchor: [16, 32] // Punto de anclaje del icono
                    })
                });
            },
            style: {
                color: '#00FFFF', // Color de borde para elementos no puntuales
                weight: 3,
                fillOpacity: 0.1
            }
        });
    
        // Añade el objeto resaltado al grupo de capas de resaltado
        highlightLayerGroup.addLayer(highlightedLayer);
    
        // Centra el mapa en el objeto resaltado
        map.fitBounds(highlightedLayer.getBounds());
    }

    // Función para resaltar la fila correspondiente en la tabla de atributos
    function highlightTableRow(selectedProps) {
        var table = document.querySelector('.attributes-table');
        if (!table) return; // Si no hay tabla de atributos, salir de la función

        // Limpiar cualquier selección previa en la tabla
        Array.from(table.querySelectorAll('tr.selected')).forEach(row => row.classList.remove('selected'));

        // Buscar la fila que coincida con los atributos seleccionados
        var rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            var cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                var match = true;
                cells.forEach((cell, index) => {
                    var header = table.querySelectorAll('th')[index].innerText;
                    if (selectedProps[header] != null && cell.innerText !== selectedProps[header].toString()) {
                        match = false;
                    }
                });

                // Si se encuentra la fila coincidente, agregar clase de selección
                if (match) {
                    row.classList.add('selected');
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    // Centro y zoom iniciales
    const initialCenter = [4.664628, -74.064095];
    const initialZoom = 18;

    // Evento para reiniciar el mapa al hacer clic en el botón
    document.getElementById('resetButton').addEventListener('click', function() {
        // Restablecer el centro y el zoom del mapa
        map.setView(initialCenter, initialZoom);
    
        // Limpiar cualquier resaltado en el mapa (ya sea de un clic o doble clic)
        highlightLayerGroup.clearLayers();
    
        // Limpiar la selección en la tabla de atributos
        var selectedRows = document.querySelectorAll('.attributes-table tr.selected');
        selectedRows.forEach(row => row.classList.remove('selected'));
    
        // Minimizar el panel de atributos y cambiar el texto del botón
        var attributesPanel = document.getElementById('attributes-panel');
        attributesPanel.classList.add('minimized'); // Minimiza el panel
        document.getElementById('toggle-attributes').textContent = 'Despliegue de atributos';
    
        // Activar todas las capas de nuevo
        Object.values(overlays).forEach(layer => {
            if (!map.hasLayer(layer)) {
                map.addLayer(layer);
            }
        });
    
        // Actualizar el panel de atributos para mostrar todas las tablas de atributos activas
        updateActiveLayers();
    });

});
