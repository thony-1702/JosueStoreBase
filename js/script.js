// Clase principal de la tienda
class JosueStore {
    constructor() {
        this.productos = [];
        this.carrito = this.cargarCarrito();
        this.productosFiltrados = [];
        this.productoActual = null; // para detalle
        this.productoSeleccionado = null;
        this.tallaSeleccionadaDetalle = null;
        this.init();
    }

    async init() {
        await this.cargarProductos();
        this.renderizarProductos(this.productos);
        this.configurarEventos();
        this.configurarModalDetalle();
        this.actualizarContadorCarrito();
    }

    async cargarProductos() {
        try {
            const response = await fetch('data/productos.json');
            const data = await response.json();
            this.productos = data.productos;
            this.productosFiltrados = [...this.productos];
        } catch (error) {
            console.error('Error cargando productos:', error);
            this.mostrarNotificacion('Error al cargar los productos', 'error');
        }
    }

    renderizarProductos(productos) {
        const container = document.getElementById('productosContainer');
        if (!container) return;
        container.innerHTML = '';

        if (productos.length === 0) {
            container.innerHTML = '<p class="no-resultados">No se encontraron productos con los filtros seleccionados.</p>';
            return;
        }

        productos.forEach(producto => {
            const tarjeta = this.crearTarjetaProducto(producto);
            container.appendChild(tarjeta);
        });
    }

    crearTarjetaProducto(producto) {
        const div = document.createElement('div');
        div.className = 'producto-card';

        const stockTotal = Object.values(producto.stock).reduce((a, b) => a + b, 0);
        let stockClase = 'stock-alto';
        let stockTexto = 'Disponible';
        if (stockTotal === 0) {
            stockClase = 'stock-agotado';
            stockTexto = 'Agotado';
        } else if (stockTotal < 5) {
            stockClase = 'stock-bajo';
            stockTexto = `Últimas ${stockTotal} unidades`;
        } else {
            stockTexto = `${stockTotal} disponibles`;
        }

        div.innerHTML = `
        <div class="producto-imagen" data-id="${producto.id}">
            <img src="${producto.imagen}" alt="${producto.nombre}" loading="lazy">
        </div>
        <h3 data-id="${producto.id}">${producto.nombre}</h3>
        <p class="precio">$${producto.precio.toFixed(2)}</p>
        <span class="stock-indicador ${stockClase}">${stockTexto}</span>
        <div class="producto-botones">
            <button class="btn-detalle" data-id="${producto.id}">Ver detalles</button>
            <button class="btn-agregar" data-id="${producto.id}" ${stockTotal === 0 ? 'disabled' : ''}>
                ${stockTotal === 0 ? 'Agotado' : 'Agregar'}
            </button>
        </div>
    `;

        // No añadimos event listener aquí, lo haremos por delegación
        return div;
    }

    mostrarSelectorTalla(producto) {
        const tallasConStock = Object.entries(producto.stock)
            .filter(([talla, cantidad]) => cantidad > 0)
            .map(([talla]) => talla);

        if (tallasConStock.length === 0) {
            this.mostrarNotificacion('No hay tallas disponibles', 'error');
            return;
        }
        if (tallasConStock.length === 1) {
            this.agregarAlCarrito(producto.id, tallasConStock[0]);
            return;
        }

        // Guardar producto actual
        this.productoParaTalla = producto;

        const modal = document.getElementById('tallaModal');
        const opcionesDiv = document.getElementById('tallaOpciones');
        opcionesDiv.innerHTML = '';

        tallasConStock.forEach(talla => {
            const btn = document.createElement('button');
            btn.textContent = talla;
            btn.classList.add('size-btn');
            btn.dataset.talla = talla;
            btn.addEventListener('click', () => {
                document.querySelectorAll('#tallaOpciones .size-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.tallaSeleccionadaTemp = talla;
            });
            opcionesDiv.appendChild(btn);
        });

        // Confirmar
        const confirmarBtn = document.getElementById('confirmarTalla');
        const oldBtn = confirmarBtn.cloneNode(true);
        confirmarBtn.parentNode.replaceChild(oldBtn, confirmarBtn);
        oldBtn.addEventListener('click', () => {
            if (this.tallaSeleccionadaTemp) {
                this.agregarAlCarrito(this.productoParaTalla.id, this.tallaSeleccionadaTemp);
                modal.style.display = 'none';
                this.tallaSeleccionadaTemp = null;
            } else {
                this.mostrarNotificacion('Selecciona una talla', 'error');
            }
        });

        // Cerrar modal
        document.getElementById('closeTallaModal').onclick = () => modal.style.display = 'none';
        window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

        modal.style.display = 'block';
    }

    agregarAlCarrito(productoId, tallaSeleccionada) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) {
            console.error("Producto no encontrado:", productoId);
            return;
        }

        const cantidadDisponible = producto.stock[tallaSeleccionada];
        if (!cantidadDisponible || cantidadDisponible === 0) {
            this.mostrarNotificacion('Producto agotado en esta talla', 'error');
            return;
        }

        // Buscar si ya existe el mismo producto con la misma talla
        const itemExistente = this.carrito.find(item => item.id === productoId && item.talla === tallaSeleccionada);

        if (itemExistente) {
            // Verificar que no exceda el stock
            if (itemExistente.cantidad + 1 > cantidadDisponible) {
                this.mostrarNotificacion(`Solo hay ${cantidadDisponible} unidades disponibles en esta talla`, 'error');
                return;
            }
            itemExistente.cantidad++;
            console.log("Incrementando cantidad de producto existente:", itemExistente);
        } else {
            // Agregar nuevo producto
            const nuevoItem = {
                id: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                talla: tallaSeleccionada,
                imagen: producto.imagen,
                cantidad: 1
            };
            this.carrito.push(nuevoItem);
            console.log("Nuevo producto agregado al carrito:", nuevoItem);
        }

        this.guardarCarrito();
        this.actualizarContadorCarrito();
        this.mostrarNotificacion('Producto agregado al carrito', 'success');

        // Opcional: si el modal del carrito está abierto, actualizarlo
        const cartModal = document.getElementById('cartModal');
        if (cartModal && cartModal.style.display === 'block') {
            this.mostrarCarrito(); // refrescar la vista
        }
    }

    guardarCarrito() {
        localStorage.setItem('josueStoreCarrito', JSON.stringify(this.carrito));
        console.log("Carrito guardado:", this.carrito);
    }

    cargarCarrito() {
        const carritoGuardado = localStorage.getItem('josueStoreCarrito');
        if (carritoGuardado) {
            try {
                this.carrito = JSON.parse(carritoGuardado);
                console.log("Carrito cargado:", this.carrito);
            } catch (e) {
                console.error("Error al parsear carrito", e);
                this.carrito = [];
            }
        } else {
            this.carrito = [];
        }
        return this.carrito;
    }
    actualizarContadorCarrito() {
        const contador = document.getElementById('cartCount');
        if (contador) {
            const totalItems = this.carrito.reduce((total, item) => total + item.cantidad, 0);
            contador.textContent = totalItems;
        }
    }

    mostrarCarrito() {
        const modal = document.getElementById('cartModal');
        const cartItemsDiv = document.getElementById('cartItems');
        const totalSpan = document.getElementById('cartTotal');

        if (!cartItemsDiv) return;

        if (this.carrito.length === 0) {
            cartItemsDiv.innerHTML = '<p>Tu carrito está vacío.</p>';
            totalSpan.textContent = '0.00';
            modal.style.display = 'block';
            return;
        }

        let total = 0;
        cartItemsDiv.innerHTML = '';

        this.carrito.forEach((item, index) => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.nombre}</h4>
                    <p>Talla: ${item.talla}</p>
                </div>
                <div class="cart-item-price">$${item.precio.toFixed(2)}</div>
                <div class="cart-item-actions">
                    <button class="decrement" data-index="${index}">-</button>
                    <span>${item.cantidad}</span>
                    <button class="increment" data-index="${index}">+</button>
                    <button class="cart-item-remove" data-index="${index}">🗑️</button>
                </div>
            `;
            cartItemsDiv.appendChild(itemDiv);
        });

        totalSpan.textContent = total.toFixed(2);

        document.querySelectorAll('.decrement').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index);
                this.modificarCantidad(idx, -1);
            });
        });
        document.querySelectorAll('.increment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index);
                this.modificarCantidad(idx, 1);
            });
        });
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index);
                this.eliminarDelCarrito(idx);
            });
        });

        modal.style.display = 'block';
    }

    modificarCantidad(index, delta) {
        if (index < 0 || index >= this.carrito.length) return;
        const item = this.carrito[index];
        if (!item) return;

        const producto = this.productos.find(p => p.id === item.id);
        const stockDisponible = producto.stock[item.talla];

        const nuevaCantidad = item.cantidad + delta;
        if (nuevaCantidad < 1) {
            this.eliminarDelCarrito(index);
            return;
        }
        if (nuevaCantidad > stockDisponible) {
            this.mostrarNotificacion(`Solo hay ${stockDisponible} unidades disponibles`, 'error');
            return;
        }
        item.cantidad = nuevaCantidad;
        this.guardarCarrito();
        this.actualizarContadorCarrito();
        this.mostrarCarrito(); // refrescar modal
    }

    eliminarDelCarrito(index) {
        this.carrito.splice(index, 1);
        this.guardarCarrito();
        this.actualizarContadorCarrito();
        this.mostrarCarrito();
    }

    vaciarCarrito() {

        console.log("Botón Vaciar carrito presionado");

        if (this.carrito.length > 0 && confirm('¿Vaciar todo el carrito?')) {
            this.carrito = [];
            this.guardarCarrito();
            this.actualizarContadorCarrito();
            this.mostrarCarrito();
            this.mostrarNotificacion('Carrito vaciado', 'info');
        } else {
            console.log("Carrito vacío o confirmación cancelada");
        }
    }

    procederCompra() {
        if (this.carrito.length === 0) {
            this.mostrarNotificacion('El carrito está vacío', 'error');
            return;
        }
        // Mostrar modal de confirmación en lugar de redirigir
        const modal = document.getElementById('confirmacionModal');
        if (modal) {
            modal.style.display = 'block';
        } else {
            console.error("Modal de confirmación no encontrado");
        }
    }

    filtrarProductos() {
        const categoria = document.getElementById('filtroCategoria').value;
        const talla = document.getElementById('filtroTalla').value;
        const soloDisponibles = document.getElementById('filtroStock').checked;

        let filtrados = [...this.productos];

        if (categoria !== 'todos') {
            filtrados = filtrados.filter(p => p.categoria === categoria);
        }

        if (talla !== 'todos') {
            filtrados = filtrados.filter(p => p.tallas.includes(talla));
        }

        if (soloDisponibles) {
            filtrados = filtrados.filter(p => {
                return Object.values(p.stock).some(cant => cant > 0);
            });
        }

        this.productosFiltrados = filtrados;
        this.renderizarProductos(filtrados);
    }

    limpiarFiltros() {
        document.getElementById('filtroCategoria').value = 'todos';
        document.getElementById('filtroTalla').value = 'todos';
        document.getElementById('filtroStock').checked = false;
        document.getElementById('searchInput').value = '';
        this.productosFiltrados = [...this.productos];
        this.renderizarProductos(this.productos);
    }

    buscarProductos() {
        const termino = document.getElementById('searchInput').value.toLowerCase().trim();
        if (termino === '') {
            this.renderizarProductos(this.productosFiltrados);
            return;
        }
        const resultados = this.productosFiltrados.filter(p => p.nombre.toLowerCase().includes(termino));
        this.renderizarProductos(resultados);
    }

    configurarEventos() {
        const btnAplicar = document.getElementById('aplicarFiltros');
        const btnLimpiar = document.getElementById('limpiarFiltros');
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        const cartIcon = document.getElementById('cartIcon');
        const modal = document.getElementById('cartModal');
        const closeModal = document.querySelector('.close');
        const vaciarBtn = document.getElementById('vaciarCarrito');
        const procederBtn = document.getElementById('procederCompra');
        const categoryCards = document.querySelectorAll('.category-card');
        const productModal = document.getElementById('productModal');
        const closeDetailBtn = document.querySelector('.close-modal-btn');
        const productosContainer = document.getElementById('productosContainer');
        // Cerrar modal de confirmación
        const confirmModal = document.getElementById('confirmacionModal');
        const closeConfirm = document.querySelector('.close-confirmacion');
        const cerrarBtn = document.getElementById('cerrarConfirmacion');

        if (closeConfirm) {
            closeConfirm.addEventListener('click', () => {
                confirmModal.style.display = 'none';
            });
        }
        if (cerrarBtn) {
            cerrarBtn.addEventListener('click', () => {
                confirmModal.style.display = 'none';
            });
        }
        // Cerrar al hacer clic fuera
        window.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.style.display = 'none';
            }
        });



        if (vaciarBtn) {
            vaciarBtn.addEventListener('click', () => this.vaciarCarrito());
            console.log("Evento vaciarCarrito asignado");
        } else {
            console.error("Botón vaciarCarrito no encontrado");
        }

        // Delegación de eventos para botones del carrito
        document.addEventListener('click', (e) => {
            // Botón Vaciar carrito
            if (e.target.id === 'vaciarCarrito') {
                console.log("Delegación: vaciarCarrito clickeado");
                this.vaciarCarrito();
                e.preventDefault();
            }
            // Botón Proceder a compra
            if (e.target.id === 'procederCompra') {
                this.procederCompra();
                e.preventDefault();
            }
        });

        if (productosContainer) {
            productosContainer.addEventListener('click', (e) => {
                // Botón Agregar
                const agregarBtn = e.target.closest('.btn-agregar');
                if (agregarBtn && !agregarBtn.disabled) {
                    const productId = parseInt(agregarBtn.dataset.id);
                    const producto = this.productos.find(p => p.id === productId);
                    if (producto) {
                        this.mostrarSelectorTalla(producto);
                    }
                    e.preventDefault();
                    return;
                }

                // Botón Ver detalles
                const detalleBtn = e.target.closest('.btn-detalle');
                if (detalleBtn) {
                    const productId = parseInt(detalleBtn.dataset.id);
                    this.abrirDetalle(productId);
                    e.preventDefault();
                    return;
                }
            });
        }



        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => {
                productModal.style.display = 'none';
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === productModal) {
                productModal.style.display = 'none';
            }
        });
        if (btnAplicar) btnAplicar.addEventListener('click', () => this.filtrarProductos());
        if (btnLimpiar) btnLimpiar.addEventListener('click', () => this.limpiarFiltros());
        if (searchBtn) searchBtn.addEventListener('click', () => this.buscarProductos());
        if (searchInput) searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.buscarProductos();
        });
        if (cartIcon) cartIcon.addEventListener('click', () => this.mostrarCarrito());
        if (closeModal) closeModal.addEventListener('click', () => modal.style.display = 'none');
        if (vaciarBtn) vaciarBtn.addEventListener('click', () => this.vaciarCarrito());
        if (procederBtn) procederBtn.addEventListener('click', () => this.procederCompra());

        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === productModal) {
                productModal.style.display = 'none';
            }
        });

        categoryCards.forEach(card => {
            card.addEventListener('click', () => {
                const categoria = card.dataset.categoria;
                if (categoria) {
                    document.getElementById('filtroCategoria').value = categoria;
                    this.filtrarProductos();
                    document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        const menuToggle = document.getElementById('menuToggle');
        const navLinks = document.getElementById('navLinks');
        if (menuToggle && navLinks) {
            menuToggle.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-detalle')) {
                const productId = parseInt(e.target.dataset.id);
                this.abrirDetalle(productId);
            }
        });
    }

    abrirDetalle(productId) {
        const producto = this.productos.find(p => p.id === productId);
        if (!producto) return;

        this.productoSeleccionado = producto;
        this.tallaSeleccionadaDetalle = null;

        // Llenar el modal con los datos
        document.getElementById('detailImage').src = producto.imagen;
        document.getElementById('detailImage').alt = producto.nombre;
        document.getElementById('detailName').textContent = producto.nombre;
        document.getElementById('detailPrice').textContent = `$${producto.precio.toFixed(2)}`;
        document.getElementById('detailDescription').textContent = producto.descripcion;

        // Generar botones de tallas
        const sizesContainer = document.getElementById('detailSizes');
        sizesContainer.innerHTML = '';
        const tallasDisponibles = Object.entries(producto.stock)
            .filter(([talla, cantidad]) => cantidad > 0)
            .map(([talla]) => talla);

        if (tallasDisponibles.length === 0) {
            sizesContainer.innerHTML = '<p>No hay tallas disponibles</p>';
        } else {
            tallasDisponibles.forEach(talla => {
                const btn = document.createElement('button');
                btn.textContent = talla;
                btn.classList.add('size-btn');
                btn.dataset.talla = talla;
                btn.addEventListener('click', () => {
                    // Remover clase selected de todos
                    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.tallaSeleccionadaDetalle = talla;
                });
                sizesContainer.appendChild(btn);
            });
        }

        // Configurar botón "Agregar al carrito" del detalle
        const detailAddBtn = document.getElementById('detailAddToCart');
        // Remover event listener anterior para evitar duplicados
        const newBtn = detailAddBtn.cloneNode(true);
        detailAddBtn.parentNode.replaceChild(newBtn, detailAddBtn);
        newBtn.addEventListener('click', () => {
            if (!this.tallaSeleccionadaDetalle) {
                this.mostrarNotificacion('Por favor selecciona una talla', 'error');
                return;
            }
            this.agregarAlCarrito(producto.id, this.tallaSeleccionadaDetalle);
            // Opcional: cerrar modal después de agregar
            document.getElementById('productModal').style.display = 'none';
        });

        // Mostrar modal
        document.getElementById('productModal').style.display = 'block';
    }

    configurarModalDetalle() {
        const modal = document.getElementById('productModal');
        const closeBtn = document.querySelector('.close-product');
        const addToCartBtn = document.getElementById('addToCartFromDetail');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                if (this.productoActual) {
                    const selectedTalla = document.querySelector('.talla-btn.selected')?.dataset.talla;
                    if (!selectedTalla) {
                        this.mostrarNotificacion('Selecciona una talla', 'error');
                        return;
                    }
                    const stock = this.productoActual.stock[selectedTalla];
                    if (!stock || stock === 0) {
                        this.mostrarNotificacion('Talla agotada', 'error');
                        return;
                    }
                    this.agregarAlCarrito(this.productoActual.id, selectedTalla);
                    modal.style.display = 'none';
                }
            });
        }
    }

    mostrarDetalleProducto(producto) {
        this.productoActual = producto;
        const modal = document.getElementById('productModal');
        const img = document.getElementById('detailImage');
        const name = document.getElementById('detailName');
        const price = document.getElementById('detailPrice');
        const description = document.getElementById('detailDescription');
        const tallasDiv = document.getElementById('detailTallas');
        const stockSpan = document.getElementById('detailStock');

        img.src = producto.imagen;
        name.textContent = producto.nombre;
        price.textContent = `$${producto.precio.toFixed(2)}`;
        description.textContent = producto.descripcion;

        tallasDiv.innerHTML = '';
        const tallas = Object.keys(producto.stock);
        tallas.forEach(talla => {
            const stock = producto.stock[talla];
            const btn = document.createElement('button');
            btn.textContent = talla;
            btn.classList.add('talla-btn');
            if (stock > 0) {
                btn.classList.add('disponible');
            } else {
                btn.classList.add('agotado');
                btn.disabled = true;
            }
            btn.dataset.talla = talla;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.talla-btn').forEach(b => b.classList.remove('selected'));
                if (stock > 0) {
                    btn.classList.add('selected');
                }
            });
            tallasDiv.appendChild(btn);
        });

        const totalStock = Object.values(producto.stock).reduce((a, b) => a + b, 0);
        if (totalStock === 0) {
            stockSpan.textContent = 'Producto agotado';
            stockSpan.style.color = 'var(--danger)';
        } else {
            stockSpan.textContent = `${totalStock} unidades disponibles en total`;
            stockSpan.style.color = 'var(--success)';
        }

        modal.style.display = 'block';
    }

    mostrarNotificacion(mensaje, tipo = 'success') {
        const notificacion = document.createElement('div');
        notificacion.className = 'notification';
        notificacion.textContent = mensaje;
        notificacion.style.backgroundColor = tipo === 'error' ? '#E74C3C' : (tipo === 'info' ? '#3498db' : '#27AE60');
        document.body.appendChild(notificacion);
        setTimeout(() => {
            notificacion.remove();
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new JosueStore();
});