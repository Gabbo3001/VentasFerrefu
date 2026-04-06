// ---------- State Management ----------
let productos = JSON.parse(localStorage.getItem("productos")) || [];
let ingresos = parseFloat(localStorage.getItem("ingresos")) || 0;
let historial = JSON.parse(localStorage.getItem("historial")) || [];
let editingIndex = -1;
const API_URL = "https://script.google.com/macros/s/AKfycbxrOTjgR3jGB63fp2F5bjwZg4VIOC79LxUVoxXWbHtc1_NWFjsY8fCY8XosHBeSGeNdTg/exec";

// ---------- Auth ----------
// El hash de "ferrefu2026" generado con SHA-256
const PASS_HASH = "48a22b1a2a611d5273db4d79df354bc025ac405e808c54eefd0cfc1a6ecef223";
const AUTH_SECRET = "ferrefu_secret_55"; // Token para que Google Script acepte cambios
let isAuthenticated = sessionStorage.getItem("ferreAuth") === "1";

// ---------- Persistence ----------
function guardar() {
    localStorage.setItem("productos", JSON.stringify(productos));
    localStorage.setItem("ingresos", ingresos);
    localStorage.setItem("historial", JSON.stringify(historial));
    const inventoryCard = document.getElementById("inventoryCard");
    if (inventoryCard) {
        localStorage.setItem("inventoryVisible", inventoryCard.classList.contains("collapsed") ? "false" : "true");
    }

    // Auto-sync with cloud whenever a change is made locally
    sincronizarConNube();
}

async function sincronizarConNube() {
    try {
        const body = {
            auth: AUTH_SECRET,
            data: productos
        };

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(body)
        });
        console.log("Sync response status:", response.status);
    } catch (error) {
        console.error("Error en sincronización:", error);
    }
}

// ---------- Formatting ----------
const currency = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
});

// ---------- Rendering ----------
function render() {
    const searchTerm = document.getElementById("busqueda").value.toLowerCase();
    renderProductos(searchTerm);
    renderSelect();
    renderHistorial();
    renderStats();
}

function renderProductos(filter = "") {
    const tabla = document.getElementById("tablaProductos");
    tabla.innerHTML = "";
    const indexedProducts = productos.map((p, i) => ({ ...p, originalIndex: i }));
    indexedProducts.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));
    const filtrados = indexedProducts.filter(p => p.nombre.toLowerCase().includes(filter.toLowerCase()));

    filtrados.forEach((p) => {
        const isEditing = p.originalIndex === editingIndex;
        const tr = document.createElement("tr");
        if (isEditing) tr.classList.add("editing-row");

        tr.innerHTML = `
            <td>
                <input type="text" 
                       id="name-input-${p.originalIndex}" 
                       class="table-input wide" 
                       value="${p.nombre}" 
                       ${isEditing ? '' : 'readonly'}
                       title="${p.nombre}">
            </td>
            <td>
                <input type="number" 
                       id="price-input-${p.originalIndex}" 
                       class="table-input no-spinners" 
                       value="${p.precio}" 
                       step="0.01"
                       ${isEditing ? '' : 'readonly'}>
            </td>
            <td>
                <input type="number" 
                       id="stock-input-${p.originalIndex}" 
                       class="table-input" 
                       value="${p.stock}" 
                       ${isEditing ? '' : 'readonly'}>
            </td>
        `;

        // Status chip
        const statusTd = document.createElement("td");
        const statusSpan = document.createElement("span");
        if (p.stock > 2) {
            statusSpan.textContent = "YES";
            statusSpan.style.color = "#00ffab";
        } else if (p.stock >= 1) {
            statusSpan.textContent = "LOW";
            statusSpan.style.color = "var(--warning)";
        } else {
            statusSpan.textContent = "NOT";
            statusSpan.style.color = "var(--danger)";
        }
        statusTd.appendChild(statusSpan);
        tr.appendChild(statusTd);

        // Actions cell
        if (isAuthenticated) {
            const actionsTd = document.createElement("td");
            actionsTd.style.textAlign = "right";

            if (isEditing) {
                actionsTd.innerHTML = `
                    <div class="actions" style="justify-content: flex-end;">
                        <button class="btn-icon" onclick="guardarFila(${p.originalIndex})" title="Guardar" style="color: var(--success)">✅</button>
                    </div>
                `;
            } else {
                actionsTd.innerHTML = `
                    <div class="actions">
                        <button class="btn-icon" onclick="iniciarEdicion(${p.originalIndex})" title="Editar"><i class='far fa-edit' style='font-size:15px;color:yellow'></i></button>
                        <button class="btn-icon" onclick="eliminarProducto(${p.originalIndex})" title="Eliminar"><i class='fas fa-trash' style='font-size:16px;color: #ed6d6d'></i></button>
                    </div>
                `;
            }
            tr.appendChild(actionsTd);
        }

        tabla.appendChild(tr);
    });
}



function eliminarProducto(index) {
    const nombre = productos[index]?.nombre || "este producto";
    mostrarConfirmacion(
        `¿Eliminar "${nombre}"?`,
        () => {
            productos.splice(index, 1);
            guardar();
            render();
            console.log(`Producto eliminado: "${nombre}"`);
        }
    );
}

function mostrarConfirmacion(mensaje, onAceptar) {
    const existing = document.getElementById("modalConfirm");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "modalConfirm";
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;
    overlay.innerHTML = `
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 1rem;
                    padding: 2rem; max-width: 360px; width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4);">
            <div style="font-size: 2rem; margin-bottom: 0.75rem;">🗑️</div>
            <p style="color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem;">${mensaje}</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button id="btnCancelarModal" class="secondary" style="flex: 1;">Cancelar</button>
                <button id="btnAceptarModal" class="primary" style="flex: 1; background: var(--danger);">Eliminar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("btnAceptarModal").onclick = () => {
        overlay.remove();
        onAceptar();
    };
    document.getElementById("btnCancelarModal").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

function renderSelect(filter = "") {
    const dropdown = document.getElementById("dropdownProductos");
    dropdown.innerHTML = "";

    const filtrados = productos
        .map((p, i) => ({ ...p, originalIndex: i }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }))
        .filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(filter.toLowerCase()));

    if (filtrados.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item">No se encontraron productos</div>';
        return;
    }

    filtrados.forEach((p) => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.innerHTML = `
            <span>${p.nombre}</span>
            <span class="stock-pill">${p.stock} disp.</span>
        `;
        item.onclick = () => seleccionarProducto(p.originalIndex, p.nombre);
        dropdown.appendChild(item);
    });
}

function abrirDropdown() {
    document.getElementById("dropdownProductos").classList.add("show");
    renderSelect(document.getElementById("searchProductoInput").value);
}

function filtrarDropdown(query) {
    renderSelect(query);
}

function seleccionarProducto(index, nombre) {
    document.getElementById("selectProducto").value = index;
    document.getElementById("searchProductoInput").value = nombre;
    document.getElementById("cantidadVenta").value = 1; // Auto-fill 1 upon selection
    cerrarDropdown();
}

function cerrarDropdown() {
    setTimeout(() => {
        document.getElementById("dropdownProductos").classList.remove("show");
    }, 200); // Small delay to allow click event to trigger
}

function renderHistorial() {
    const lista = document.getElementById("historial");
    lista.innerHTML = "";

    // Show last 5 sales
    historial.slice().reverse().forEach((h, index) => {
        if (index >= 5) return;
        const li = document.createElement("li");
        li.innerHTML = `
            <span>${h.date || 'Reciente'}</span>
            <strong>${h.nombre} x${h.cantidad}</strong>
            <span style="color: var(--success); font-weight: bold">${currency.format(h.total)}</span>
        `;
        lista.appendChild(li);
    });
}

function renderStats() {
    document.getElementById("totalVentas").textContent = currency.format(ingresos);

    // Low stock count
    const lowStockCount = productos.filter(p => p.stock <= 5).length;
    document.getElementById("stockAlertas").textContent = lowStockCount;

    // Top product (most sold based on history)
    const salesCount = {};
    historial.forEach(h => {
        salesCount[h.nombre] = (salesCount[h.nombre] || 0) + h.cantidad;
    });

    let topProduct = "-";
    let max = 0;
    for (const name in salesCount) {
        if (salesCount[name] > max) {
            max = salesCount[name];
            topProduct = name;
        }
    }
}

// ---------- Actions ----------
function agregarProducto() {
    if (!isAuthenticated) { pedirPassword(); return; }

    const inputNombre = document.getElementById("nombre");
    const inputPrecio = document.getElementById("precio");
    const inputStock = document.getElementById("stock");

    const nombre = inputNombre.value.trim();
    const precio = parseFloat(inputPrecio.value);
    const stock = parseInt(inputStock.value);

    if (!nombre || isNaN(precio) || precio <= 0 || isNaN(stock) || stock < 0) {
        showNotification("Datos inválidos", "error");
        return;
    }

    productos.push({ nombre, precio, stock });
    limpiarFormulario();
    guardar();
    render();
    showNotification("Producto agregado correctamente", "success");
}

function limpiarFormulario() {
    document.getElementById("nombre").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("stock").value = "";
}

function iniciarEdicion(index) {
    editingIndex = index;
    render();
    // Use timeout to allow element to render first
    setTimeout(() => {
        const input = document.getElementById(`name-input-${index}`);
        if (input) {
            input.focus();
            input.select();
        }
    }, 10);
}

function cancelarEdicion() {
    editingIndex = -1;
    render();
}

function guardarFila(index) {
    const nuevoNombre = document.getElementById(`name-input-${index}`).value.trim();
    const nuevoPrecio = parseFloat(document.getElementById(`price-input-${index}`).value);
    const nuevoStock = parseInt(document.getElementById(`stock-input-${index}`).value);

    if (!nuevoNombre || isNaN(nuevoPrecio) || nuevoPrecio <= 0 || isNaN(nuevoStock) || nuevoStock < 0) {
        showNotification("Valores inválidos para actualizar el producto", "error");
        return;
    }

    const original = productos[index];
    const huboCambio = original.nombre !== nuevoNombre ||
        original.precio !== nuevoPrecio ||
        original.stock !== nuevoStock;

    editingIndex = -1; // Exit edit mode always

    if (!huboCambio) {
        // Nothing changed, just close edit mode silently
        render();
        return;
    }

    productos[index] = { nombre: nuevoNombre, precio: nuevoPrecio, stock: nuevoStock };

    guardar();
    render();
    console.log(`Producto modificado: "${nuevoNombre}" | Precio: ${nuevoPrecio} | Stock: ${nuevoStock}`);
}

function venderProducto() {
    if (!isAuthenticated) { pedirPassword(() => venderProducto()); return; }
    const select = document.getElementById("selectProducto");
    const inputCantidad = document.getElementById("cantidadVenta");

    const index = select.value;
    const cantidad = parseInt(inputCantidad.value);

    if (index === "" || isNaN(cantidad) || cantidad <= 0) {
        showNotification("Seleccione un producto y cantidad válida", "error");
        return;
    }

    const producto = productos[index];

    if (producto.stock < cantidad) {
        showNotification("Stock insuficiente", "error");
        return;
    }

    producto.stock -= cantidad;
    const total = producto.precio * cantidad;
    ingresos += total;

    historial.push({
        nombre: producto.nombre,
        cantidad: cantidad,
        total: total,
        date: new Date().toLocaleTimeString()
    });

    inputCantidad.value = ""; // Reset to empty for the next selection
    document.getElementById("searchProductoInput").value = "";
    document.getElementById("selectProducto").value = "";
    guardar();
    render();
    showNotification(`Venta registrada: ${currency.format(total)}`, "success");
}

function vaciarInventario() {
    if (!isAuthenticated) { pedirPassword(); return; }
    if (confirm("⚠️ ¿Estás seguro de que quieres VACIAR TODO EL INVENTARIO? Esta acción no se puede deshacer.")) {
        productos = [];
        guardar();
        render();
        showNotification("Inventario vaciado", "success");
    }
}

// ---------- Auth System ----------
function pedirPassword(callback) {
    const existing = document.getElementById("modalAuth");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "modalAuth";
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
        backdrop-filter: blur(4px);
    `;
    overlay.innerHTML = `
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 1rem;
                    padding: 2rem; max-width: 340px; width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem">🔐</div>
            <h3 style="color: var(--text); margin-bottom: 0.5rem;">Acceso requerido</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">Ingresa la contraseña para editar el inventario.</p>
            <input id="authInput" type="password" placeholder="Contraseña"
                   style="width:100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border);
                          background: var(--background); color: var(--text); font-size: 1rem; margin-bottom: 1rem;"
                   onkeydown="if(event.key==='Enter') verificarPassword()">
            <div id="authError" style="color:var(--danger); font-size:0.8rem; min-height:1.2rem; margin-bottom:0.75rem;"></div>
            <div style="display:flex; gap:1rem;">
                <button onclick="document.getElementById('modalAuth').remove()" class="secondary" style="flex:1;">Cancelar</button>
                <button onclick="verificarPassword()" class="primary" style="flex:1;">Ingresar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById("authInput")?.focus(), 50);
    // Store callback for after auth
    overlay._onSuccess = callback;
}

async function verificarPassword() {
    const input = document.getElementById("authInput");
    const err = document.getElementById("authError");
    const rawValue = input.value;

    // Generar SHA-256 del input
    const msgUint8 = new TextEncoder().encode(rawValue);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex === PASS_HASH) {
        isAuthenticated = true;
        sessionStorage.setItem("ferreAuth", "1");
        const overlay = document.getElementById("modalAuth");
        const cb = overlay?._onSuccess;
        overlay?.remove();
        actualizarBotónCandado();
        render();
        if (cb) cb();
    } else {
        err.textContent = "Contraseña incorrecta";
        input.value = "";
        input.focus();
    }
}

function cerrarSesion() {
    isAuthenticated = false;
    sessionStorage.removeItem("ferreAuth");
    editingIndex = -1;
    actualizarBotónCandado();
    render();
}

function actualizarBotónCandado() {
    const btn = document.getElementById("btnCandado");
    const formCard = document.getElementById("formCard");

    if (formCard) {
        formCard.style.display = isAuthenticated ? "block" : "none";
    }

    if (!btn) return;
    if (isAuthenticated) {
        btn.innerHTML = "🔓 Cerrar sesión";
        btn.style.color = "mediumspringgreen";
        btn.onclick = cerrarSesion;
    } else {
        btn.innerHTML = "🔒 Iniciar Sesión";
        btn.style.color = "";
        btn.onclick = () => pedirPassword();
    }
}

async function sincronizar() {
    try {
        console.log("Iniciando sincronización automática...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();

        if (Array.isArray(data)) {
            productos = data.map(item => {
                const keys = Object.keys(item);
                const nombreKey = keys.find(k => k.toLowerCase().includes("nombre") || k.toLowerCase().includes("producto") || k.toLowerCase().includes("item")) || "";
                const precioKey = keys.find(k => k.toLowerCase().includes("precio") || k.toLowerCase().includes("price") || k.toLowerCase().includes("costo")) || "";
                const stockKey = keys.find(k => k.toLowerCase().includes("stock") || k.toLowerCase().includes("cantidad") || k.toLowerCase().includes("existencia")) || "";

                return {
                    nombre: item[nombreKey] || "Sin nombre",
                    precio: parseFloat(item[precioKey] || 0),
                    stock: parseInt(item[stockKey] || 0)
                };
            });

            guardarSincronizado();
            render();
            console.log("Sincronización automática completada exitosamente.");
        }
    } catch (error) {
        console.error("Error en sincronización automática:", error);
    }
}

// Special guardar function for SYNC to avoid infinite loops (GET -> guardar -> POST)
function guardarSincronizado() {
    localStorage.setItem("productos", JSON.stringify(productos));
    localStorage.setItem("ingresos", ingresos);
    localStorage.setItem("historial", JSON.stringify(historial));
}

// ---------- UI Helpers ----------
function showNotification(message, type) {
    console.log(`${type.toUpperCase()}: ${message}`);
    const emoji = type === "error" ? "⚠️ " : "✅ ";
    alert(emoji + message);
}

function toggleInventario() {
    const card = document.getElementById("inventoryCard");
    const text = document.getElementById("toggleText");
    const isCollapsed = card.classList.toggle("collapsed");

    text.textContent = isCollapsed ? "Mostrar" : "Ocultar";
    localStorage.setItem("inventoryVisible", !isCollapsed);
}

// ---------- Initial Render ----------
document.addEventListener("DOMContentLoaded", () => {
    // Basic search listener
    document.getElementById("busqueda").addEventListener("input", () => {
        render();
    });

    // Restore inventory visibility state
    const inventoryVisible = localStorage.getItem("inventoryVisible");
    if (inventoryVisible === "false") {
        const card = document.getElementById("inventoryCard");
        const text = document.getElementById("toggleText");
        if (card && text) {
            card.classList.add("collapsed");
            text.textContent = "Mostrar";
        }
    }

    // Close dropdown on click outside
    document.addEventListener("click", (e) => {
        const dropdown = document.getElementById("dropdownProductos");
        if (dropdown && !e.target.closest(".searchable-select")) {
            dropdown.classList.remove("show");
        }
    });

    render();
    sincronizar(); // Initial sync on startup
    actualizarBotónCandado(); // Initialize auth UI
});