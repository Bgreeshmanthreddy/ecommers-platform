import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';
import ProductCard from './components/ProductCard';
import './styles.css';

const emptyAddress = {
  fullName: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
};

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  image: '',
  category: 'General',
  stock: '0',
  sku: '',
  active: true,
  featured: false,
};

function App() {
  const [page, setPage] = useState('shop');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('store-cart') || '[]');
    } catch (error) {
      console.error('Could not restore saved cart:', error);
      return [];
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('store-token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('store-user') || 'null');
    } catch (error) {
      console.error('Could not restore saved account:', error);
      return null;
    }
  });
  const [storeConfig, setStoreConfig] = useState({
    currency: 'INR',
    storeName: 'Everyday Market',
    payments: { cod: true, stripe: false, razorpay: false },
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [address, setAddress] = useState(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [orders, setOrders] = useState([]);
  const [adminTab, setAdminTab] = useState('products');
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sort, setSort] = useState('featured');
  const [detailQty, setDetailQty] = useState(1);
  const [reviews, setReviews] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  const request = useCallback((path, options = {}) => apiRequest(path, {
    ...options,
    token,
  }), [token]);

  const loadProducts = useCallback(async () => {
    const data = await apiRequest('/products');
    setProducts(data);
  }, []);

  useEffect(() => {
    localStorage.setItem('store-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    if (user && !address.fullName) {
      setAddress((current) => (current.fullName ? current : { ...current, fullName: user.name || '' }));
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest('/products'), apiRequest('/config')])
      .then(([productList, config]) => {
        if (!active) return;
        setProducts(productList);
        setStoreConfig(config);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('store-token', token);
    if (user) localStorage.setItem('store-user', JSON.stringify(user));
  }, [token, user]);

  useEffect(() => {
    if (!token || !user) return;
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get('payment');
    if (paymentState === 'success' && params.get('session_id') && params.get('orderId')) {
      request(`/orders/${params.get('orderId')}/verify-stripe`, {
        method: 'POST',
        body: { sessionId: params.get('session_id') },
      })
        .then(async () => {
          setCart([]);
          setOrders(await request('/orders/mine'));
          setNotice('Payment received. Your order is confirmed.');
          setPage('orders');
        })
        .catch((requestError) => setError(requestError.message))
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    } else if (paymentState === 'cancelled') {
      const orderId = params.get('orderId');
      const cancelPendingOrder = orderId
        ? request(`/orders/${orderId}/cancel`, { method: 'POST' })
        : Promise.resolve();
      cancelPendingOrder
        .then(() => request('/orders/mine'))
        .then((customerOrders) => {
          setOrders(customerOrders);
          setNotice('Payment was cancelled. You can try again with a new order.');
          setPage('orders');
        })
        .catch((requestError) => setError(requestError.message))
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    }
  }, [request, token, user]);

  const categories = useMemo(
    () => ['All', ...new Set(products.map((product) => product.category).filter(Boolean))],
    [products],
  );
  const filteredProducts = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    const list = products.filter((product) => {
      const matchesSearch = !searchText ||
        `${product.name} ${product.description} ${product.category} ${product.tags?.join(' ') || ''}`.toLowerCase().includes(searchText);
      const matchesCategory = category === 'All' || product.category === category;
      return matchesSearch && matchesCategory;
    });
    if (sort === 'price-asc') return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') return [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return list;
  }, [category, products, search, sort]);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const formatPrice = (price) => new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: storeConfig.currency || 'INR',
    maximumFractionDigits: 2,
  }).format(price);

  const addToCart = (product) => {
    const existing = cart.find((item) => item._id === product._id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        setError('You have added all available stock to your cart.');
        return;
      }
      setCart((items) => items.map((item) => item._id === product._id
        ? { ...item, quantity: item.quantity + 1 }
        : item));
    } else {
      if (product.stock < 1) {
        setError('This product is currently out of stock.');
        return;
      }
      setCart((items) => [...items, { ...product, quantity: 1 }]);
    }
    setError('');
    setNotice(`${product.name} added to your cart.`);
  };

  const addMultipleToCart = (product, quantity) => {
    const inCart = cart.find((item) => item._id === product._id)?.quantity || 0;
    const allowed = Math.min(quantity, product.stock - inCart);
    if (allowed < 1) {
      setError(product.stock < 1
        ? 'This product is currently out of stock.'
        : 'You have added all available stock to your cart.');
      return;
    }
    setCart((items) => {
      const existing = items.find((item) => item._id === product._id);
      if (existing) {
        return items.map((item) => item._id === product._id
          ? { ...item, quantity: item.quantity + allowed }
          : item);
      }
      return [...items, { ...product, quantity: allowed }];
    });
    setError('');
    setNotice(`${product.name} × ${allowed} added to your bag.`);
  };

  const changeCartQuantity = (productId, quantity) => {
    setCart((items) => {
      if (quantity < 1) return items.filter((item) => item._id !== productId);
      return items.map((item) => item._id === productId
        ? { ...item, quantity: Math.min(quantity, item.stock) }
        : item);
    });
  };

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setPage('account');
    setError('');
  };

  const authenticateUser = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
      const result = await apiRequest(endpoint, {
        method: 'POST',
        body: authForm,
      });
      setToken(result.token);
      setUser(result.user);
      localStorage.setItem('store-token', result.token);
      localStorage.setItem('store-user', JSON.stringify(result.user));
      setPage('shop');
      setNotice(`Welcome${result.user.name ? `, ${result.user.name}` : ''}!`);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('store-token');
    localStorage.removeItem('store-user');
    setToken('');
    setUser(null);
    setPage('shop');
    setNotice('You have signed out.');
  };

  const loadOrders = async () => {
    setBusy(true);
    setError('');
    try {
      setOrders(await request('/orders/mine'));
      setPage('orders');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      await request(`/orders/${orderId}/cancel`, { method: 'POST' });
      setOrders(await request('/orders/mine'));
      setNotice('Pending payment order cancelled. Reserved stock has been released.');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const checkout = async (event) => {
    event.preventDefault();
    if (!user) {
      openAuth('login');
      setNotice('Sign in before placing your order.');
      return;
    }
    if (cart.length === 0) return;

    setBusy(true);
    setError('');
    try {
      const result = await request('/orders', {
        method: 'POST',
        body: {
          items: cart.map((item) => ({ productId: item._id, quantity: item.quantity })),
          shippingAddress: address,
          paymentMethod,
        },
      });

      if (result.checkout.provider === 'stripe') {
        window.location.assign(result.checkout.url);
        return;
      }
      if (result.checkout.provider === 'razorpay') {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => {
          const checkoutWidget = new window.Razorpay({
            key: result.checkout.keyId,
            amount: result.checkout.amount,
            currency: result.checkout.currency,
            name: result.checkout.name,
            description: result.checkout.description,
            order_id: result.checkout.orderId,
            prefill: { name: address.fullName, contact: address.phone, email: user.email },
            handler: async (paymentResult) => {
              try {
                await request(`/orders/${result.order._id}/verify-razorpay`, {
                  method: 'POST',
                  body: paymentResult,
                });
                setCart([]);
                setNotice('Payment received. Your order is confirmed.');
                await loadOrders();
              } catch (requestError) {
                setError(requestError.message);
              }
            },
            modal: {
              ondismiss: () => cancelOrder(result.order._id),
            },
          });
          checkoutWidget.open();
        };
        script.onerror = () => setError('Could not load the Razorpay checkout. Please try again.');
        document.body.appendChild(script);
        return;
      }

      setCart([]);
      setNotice('Order placed successfully. You can follow its status in your order history.');
      setAddress(emptyAddress);
      setPage('orders');
      setOrders((existing) => [result.order, ...existing]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const openOrders = async () => {
    if (!token) {
      openAuth('login');
      return;
    }
    await loadOrders();
  };

  const loadAdminData = async (tab = adminTab) => {
    if (user?.role !== 'admin') {
      setError('Administrator access is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (tab === 'products') {
        setAdminProducts(await request('/products/admin/all'));
      } else {
        setAdminOrders(await request('/orders/admin/all'));
      }
      setAdminTab(tab);
      setPage('admin');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...productForm,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
      };
      const result = await request(
        editingProductId ? `/products/${editingProductId}` : '/products',
        { method: editingProductId ? 'PUT' : 'POST', body: payload },
      );
      setAdminProducts((items) => editingProductId
        ? items.map((item) => item._id === result._id ? result : item)
        : [result, ...items]);
      await loadProducts();
      setProductForm(emptyProduct);
      setEditingProductId('');
      setNotice(editingProductId ? 'Product updated.' : 'Product created.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const editProduct = (product) => {
    setEditingProductId(product._id);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      image: product.image || '',
      category: product.category || 'General',
      stock: String(product.stock),
      sku: product.sku || '',
      active: product.active,
      featured: product.featured,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    setError('');
    try {
      await request(`/products/${productId}`, { method: 'DELETE' });
      setAdminProducts((items) => items.filter((item) => item._id !== productId));
      await loadProducts();
      setNotice('Product deleted.');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const updated = await request(`/orders/admin/${orderId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      setAdminOrders((items) => items.map((order) => order._id === updated._id ? { ...updated, user: order.user } : order));
      setNotice('Order status updated.');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const viewProduct = (product) => {
    setSelectedProduct(product);
    setDetailQty(1);
    setPage('product');
    setReviews(null);
    apiRequest(`/products/${product._id}/reviews`)
      .then((list) => {
        setReviews(list);
        const mine = user ? list.find((review) => review.user?._id === user.id) : null;
        setReviewRating(mine?.rating || 0);
        setReviewComment(mine?.comment || '');
      })
      .catch(() => setReviews([]));
  };

  const refreshProductRating = async (productId) => {
    const fresh = await apiRequest(`/products/${productId}`);
    setSelectedProduct(fresh);
    setProducts((items) => items.map((item) => (item._id === fresh._id
      ? { ...item, rating: fresh.rating, reviewCount: fresh.reviewCount }
      : item)));
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!user) {
      openAuth('login');
      setNotice('Sign in to share your feedback.');
      return;
    }
    if (reviewRating < 1) {
      setError('Choose a star rating first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request(`/products/${selectedProduct._id}/reviews`, {
        method: 'POST',
        body: { rating: reviewRating, comment: reviewComment },
      });
      setReviews(await apiRequest(`/products/${selectedProduct._id}/reviews`));
      await refreshProductRating(selectedProduct._id);
      setNotice('Thanks for your feedback!');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const removeReview = async () => {
    try {
      await request(`/products/${selectedProduct._id}/reviews`, { method: 'DELETE' });
      setReviews(await apiRequest(`/products/${selectedProduct._id}/reviews`));
      setReviewRating(0);
      setReviewComment('');
      await refreshProductRating(selectedProduct._id);
      setNotice('Your review was removed.');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const renderShop = () => (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">CURATED FOR EVERY DAY</span>
          <h1>Good things.<br /><span>Thoughtfully chosen.</span></h1>
          <p>Find useful, well-made essentials for the way you live, work, and unwind.</p>
          <button className="button button-dark" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>
            Explore the collection <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-sun" />
          <div className="hero-shape shape-back" />
          <div className="hero-shape shape-front" />
          <div className="hero-badge">MADE FOR<br />THE EVERYDAY</div>
        </div>
      </section>

      <section className="catalog section" id="catalog">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE COLLECTION</span>
            <h2>Shop the essentials</h2>
          </div>
          <span className="result-count">{filteredProducts.length} items</span>
        </div>
        <div className="catalog-controls">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search products"
              placeholder="Search products..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? <button className="clear-search" aria-label="Clear search" onClick={() => setSearch('')}>×</button> : null}
          </label>
          <div className="catalog-tools">
            <label className="sort-select">
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>
        </div>
        <div className="category-list" aria-label="Filter by category">
          {categories.map((item) => (
            <button
              className={`category-chip${category === item ? ' selected' : ''}`}
              key={item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="product-grid" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <div className="skeleton-card" key={index}>
                <div className="skeleton-image" />
                <div className="skeleton-line wide" />
                <div className="skeleton-line narrow" />
              </div>
            ))}
          </div>
        ) : null}
        {!loading && filteredProducts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✳</span>
            <h3>No products found</h3>
            <p>Nothing matches your search{category !== 'All' ? ` in ${category}` : ''} just yet.</p>
            <button className="button button-dark" onClick={() => { setSearch(''); setCategory('All'); }}>
              Clear filters
            </button>
          </div>
        ) : null}
        <div className="product-grid">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={product._id}
              product={product}
              formatPrice={formatPrice}
              onAdd={addToCart}
              onOpen={viewProduct}
              index={index}
            />
          ))}
        </div>
      </section>
    </>
  );

  const renderCart = () => (
    <section className="page-section">
      <div className="page-title">
        <span className="eyebrow">YOUR SELECTION</span>
        <h1>Shopping bag</h1>
      </div>
      {!cart.length ? (
        <div className="empty-state">
          <span className="empty-icon">♡</span>
          <h3>Your bag is taking a breather</h3>
          <p>Discover something useful for your everyday.</p>
          <button className="button button-dark" onClick={() => setPage('shop')}>Continue shopping</button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map((item) => (
              <article className="cart-row" key={item._id}>
                <button className="cart-image" onClick={() => viewProduct(item)} aria-label={`View ${item.name}`}>
                  {item.image ? <img src={item.image} alt="" /> : <span>✳</span>}
                </button>
                <div className="cart-details">
                  <span className="eyebrow">{item.category}</span>
                  <button className="text-button cart-name" onClick={() => viewProduct(item)}>{item.name}</button>
                  <span className="muted">{formatPrice(item.price)}</span>
                  <div className="quantity-control">
                    <button aria-label="Decrease quantity" onClick={() => changeCartQuantity(item._id, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button aria-label="Increase quantity" disabled={item.quantity >= item.stock} onClick={() => changeCartQuantity(item._id, item.quantity + 1)}>+</button>
                  </div>
                </div>
                <div className="cart-line-total">
                  <strong>{formatPrice(item.price * item.quantity)}</strong>
                  <button className="text-button remove-button" onClick={() => changeCartQuantity(item._id, 0)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
          <aside className="summary-card sticky-summary">
            <span className="eyebrow">ORDER SUMMARY</span>
            <div className="summary-line"><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div>
            <div className="summary-line"><span>Shipping</span><strong>Free</strong></div>
            <div className="summary-line summary-total"><span>Total</span><strong>{formatPrice(cartTotal)}</strong></div>
            <p>Shipping and any applicable taxes are calculated at checkout.</p>
            <button className="button button-dark full-width" onClick={() => setPage(user ? 'checkout' : 'account')}>
              {user ? 'Continue to checkout' : 'Sign in to checkout'}
            </button>
            {!user ? <button className="button button-light full-width" onClick={() => openAuth('register')}>Create an account</button> : null}
          </aside>
        </div>
      )}
    </section>
  );

  const renderAccount = () => (
    <section className="account-wrap">
      <div className="account-panel">
        <span className="eyebrow">{authMode === 'register' ? 'JOIN OUR COMMUNITY' : 'WELCOME BACK'}</span>
        <h1>{authMode === 'register' ? 'Create your account' : 'Sign in'}</h1>
        <p className="muted">Keep your orders and everyday favorites in one place.</p>
        <form className="form-stack" onSubmit={authenticateUser}>
          {authMode === 'register' ? (
            <label>Full name<input required minLength="2" autoComplete="name" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} /></label>
          ) : null}
          <label>Email address<input required type="email" autoComplete="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} /></label>
          <label>Password<input required type="password" minLength={authMode === 'register' ? 8 : undefined} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} /></label>
          {authMode === 'register' ? <small>Use at least 8 characters.</small> : null}
          <button className="button button-dark full-width" disabled={busy}>{busy ? 'Please wait...' : authMode === 'register' ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="account-switch">
          {authMode === 'register' ? 'Already have an account?' : 'New here?'}
          <button className="text-button" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setError(''); }}>
            {authMode === 'register' ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </section>
  );

  const renderProduct = () => {
    if (!selectedProduct) return renderShop();
    return (
      <section className="product-detail page-section">
        <button className="back-link" onClick={() => setPage('shop')}>← Back to collection</button>
        <div className="detail-layout">
          <div className="detail-image">
            {selectedProduct.image ? <img src={selectedProduct.image} alt={selectedProduct.name} /> : <div className="product-placeholder"><span>✳</span></div>}
          </div>
          <div className="detail-copy">
            <span className="eyebrow">{selectedProduct.category}</span>
            <h1>{selectedProduct.name}</h1>
            {selectedProduct.rating > 0 ? (
              <div className="product-rating detail-rating">
                <span className="rating-stars" aria-hidden="true">★</span>
                <strong>{selectedProduct.rating.toFixed(1)}</strong>
                <span>({selectedProduct.reviewCount} {selectedProduct.reviewCount === 1 ? 'review' : 'reviews'})</span>
              </div>
            ) : null}
            <div className="detail-price">{formatPrice(selectedProduct.price)}</div>
            <p>{selectedProduct.description || 'A thoughtfully selected essential for everyday living.'}</p>
            {selectedProduct.tags?.length ? (
              <div className="product-tags">{selectedProduct.tags.map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}</div>
            ) : null}
            <p className={`stock-label${selectedProduct.stock < 1 ? ' out-of-stock' : ''}`}>
              {selectedProduct.stock > 0
                ? (selectedProduct.stock < 5 ? `Only ${selectedProduct.stock} left in stock` : `${selectedProduct.stock} in stock`)
                : 'Currently out of stock'}
            </p>
            {selectedProduct.stock > 0 ? (
              <div className="detail-actions">
                <div className="quantity-control detail-qty">
                  <button aria-label="Decrease quantity" disabled={detailQty < 2} onClick={() => setDetailQty((q) => q - 1)}>−</button>
                  <span>{detailQty}</span>
                  <button aria-label="Increase quantity" disabled={detailQty >= selectedProduct.stock} onClick={() => setDetailQty((q) => q + 1)}>+</button>
                </div>
                <button className="button button-dark" onClick={() => addMultipleToCart(selectedProduct, detailQty)}>
                  Add to bag <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : (
              <button className="button button-light" onClick={() => setPage('shop')}>Browse other products</button>
            )}
            <div className="detail-promise">
              <span>🔒 Secure checkout</span>
              <span>🚚 Free shipping</span>
              <span>↩ Easy order tracking</span>
            </div>
          </div>
        </div>

        <section className="reviews-section" aria-label="Customer feedback">
          <div className="reviews-heading">
            <h2>Customer feedback</h2>
            <span>{reviews === null ? 'Loading...' : `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`}</span>
          </div>
          <div className="reviews-layout">
            {user ? (
              <form className="review-form" onSubmit={submitReview}>
                <span className="detail-label">{reviews?.some((review) => review.user?._id === user.id) ? 'UPDATE YOUR FEEDBACK' : 'SHARE YOUR FEEDBACK'}</span>
                <div className="star-picker" role="radiogroup" aria-label="Your rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      role="radio"
                      aria-checked={reviewRating === star}
                      className={`star${star <= reviewRating ? ' active' : ''}`}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      onClick={() => setReviewRating(star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  rows="3"
                  maxLength="1000"
                  placeholder="Tell others about your experience... (optional)"
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                />
                <button className="button button-dark full-width" disabled={busy}>
                  {busy ? 'Saving...' : 'Submit feedback'}
                </button>
                {reviews?.some((review) => review.user?._id === user.id) ? (
                  <button type="button" className="text-button remove-button center" onClick={removeReview}>Remove my review</button>
                ) : null}
              </form>
            ) : (
              <div className="review-signin">
                <h3>Wear it, use it, review it</h3>
                <p>Your feedback helps other shoppers choose with confidence.</p>
                <button className="button button-dark" onClick={() => openAuth('login')}>Sign in to review</button>
              </div>
            )}
            <div className="reviews-list">
              {reviews === null ? (
                <>
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line" />
                </>
              ) : null}
              {reviews?.length === 0 ? (
                <p className="muted">No reviews yet — be the first to share feedback.</p>
              ) : null}
              {reviews?.map((review) => (
                <article className="review-card" key={review._id}>
                  <div className="review-top">
                    <strong>{review.user?.name || 'Customer'}</strong>
                    <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
                      {'★'.repeat(review.rating)}<span className="star-off">{'★'.repeat(5 - review.rating)}</span>
                    </span>
                    <small>{new Date(review.createdAt).toLocaleDateString()}</small>
                  </div>
                  {review.comment ? <p>{review.comment}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
        {products.filter((p) => p._id !== selectedProduct._id && p.category === selectedProduct.category).length ? (
          <div className="related-section">
            <h2 className="related-heading">More from {selectedProduct.category}</h2>
            <div className="product-grid related-grid">
              {products
                .filter((p) => p._id !== selectedProduct._id && p.category === selectedProduct.category)
                .slice(0, 4)
                .map((product, index) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    formatPrice={formatPrice}
                    onAdd={addToCart}
                    onOpen={viewProduct}
                    index={index}
                  />
                ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const renderCheckout = () => (
    <section className="page-section">
      <div className="page-title">
        <span className="eyebrow">ALMOST YOURS</span>
        <h1>Checkout</h1>
      </div>
      {!user ? (
        <div className="empty-state"><p>Please sign in to continue to checkout.</p><button className="button button-dark" onClick={() => openAuth('login')}>Sign in</button></div>
      ) : !cart.length ? (
        <div className="empty-state"><p>Your bag is empty.</p><button className="button button-dark" onClick={() => setPage('shop')}>Browse products</button></div>
      ) : (
        <form className="checkout-layout" onSubmit={checkout}>
          <div className="checkout-form">
            <section className="checkout-block">
              <div className="checkout-heading"><span>01</span><h2>Delivery details</h2></div>
              <div className="form-grid">
                {[
                  ['fullName', 'Full name', 'text'],
                  ['phone', 'Phone number', 'tel'],
                  ['address', 'Street address', 'text'],
                  ['city', 'City', 'text'],
                  ['state', 'State / region', 'text'],
                  ['postalCode', 'Postal code', 'text'],
                  ['country', 'Country', 'text'],
                ].map(([field, label, type]) => (
                  <label className={field === 'address' ? 'wide-field' : ''} key={field}>
                    {label}
                    <input required autoComplete={field} type={type} value={address[field]} onChange={(event) => setAddress({ ...address, [field]: event.target.value })} />
                  </label>
                ))}
              </div>
            </section>
            <section className="checkout-block">
              <div className="checkout-heading"><span>02</span><h2>Payment method</h2></div>
              <div className="payment-options">
                {[
                  ['cod', 'Cash on delivery', 'Pay when your order arrives.'],
                  ['razorpay', 'Razorpay', 'Pay securely with cards, UPI, or supported wallets.'],
                  ['stripe', 'Card payment', 'Secure checkout powered by Stripe.'],
                ].filter(([method]) => storeConfig.payments[method]).map(([method, title, detail]) => (
                  <label className={`payment-option${paymentMethod === method ? ' selected' : ''}`} key={method}>
                    <input type="radio" name="payment" value={method} checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} />
                    <span><strong>{title}</strong><small>{detail}</small></span>
                  </label>
                ))}
              </div>
            </section>
          </div>
          <aside className="summary-card checkout-summary">
            <span className="eyebrow">YOUR ORDER</span>
            {cart.map((item) => (
              <div className="summary-line" key={item._id}>
                <span>{item.name} × {item.quantity}</span>
                <strong>{formatPrice(item.price * item.quantity)}</strong>
              </div>
            ))}
            <div className="summary-line"><span>Shipping</span><strong>Free</strong></div>
            <div className="summary-line summary-total"><span>Total</span><strong>{formatPrice(cartTotal)}</strong></div>
            <button className="button button-dark full-width" disabled={busy || !storeConfig.payments[paymentMethod]}>
              {busy ? 'Placing order...' : 'Place order'}
            </button>
            <small className="secure-note">Your order is processed securely. We never store payment card details.</small>
          </aside>
        </form>
      )}
    </section>
  );

  const renderOrders = () => (
    <section className="page-section">
      <div className="page-title">
        <span className="eyebrow">YOUR ACCOUNT</span>
        <h1>Order history</h1>
      </div>
      {!user ? <div className="empty-state"><p>Sign in to see your orders.</p><button className="button button-dark" onClick={() => openAuth('login')}>Sign in</button></div> : null}
      {user && busy ? <div className="empty-state">Loading your orders...</div> : null}
      {user && !busy && orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">▤</span>
          <h3>No orders yet</h3>
          <p>Your next favorite is waiting to be discovered.</p>
          <button className="button button-dark" onClick={() => setPage('shop')}>Explore the collection</button>
        </div>
      ) : null}
      <div className="orders-list">
        {orders.map((order) => (
          <article className="order-card" key={order._id}>
            <div className="order-header">
              <div><span className="eyebrow">ORDER #{order._id.slice(-8).toUpperCase()}</span><small>{new Date(order.createdAt).toLocaleDateString()}</small></div>
              <span className={`status-pill status-${order.status}`}>{order.status}</span>
            </div>
            <div className="order-items">
              {order.items.map((item, index) => (
                <div className="order-item-row" key={`${order._id}-${index}`}>
                  {item.image
                    ? <img src={item.image} alt="" loading="lazy" />
                    : <span className="order-item-fallback">✳</span>}
                  <span className="order-item-name">{item.name}</span>
                  <span className="muted">{item.quantity} × {formatPrice(item.price)}</span>
                </div>
              ))}
            </div>
            <div className="order-delivery muted">
              Delivering to {order.shippingAddress?.city}, {order.shippingAddress?.state}
            </div>
            <div className="order-footer">
              <span>{order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod} · {order.paymentStatus}</span>
              <strong>{formatPrice(order.total)}</strong>
            </div>
            {order.status === 'pending' && order.paymentMethod !== 'cod' ? (
              <button className="text-button remove-button" onClick={() => cancelOrder(order._id)}>Cancel pending order</button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );

  const renderAdmin = () => {
    if (user?.role !== 'admin') {
      return <section className="page-section"><div className="empty-state"><h2>Administrator access only</h2><p>Please sign in with an admin account.</p></div></section>;
    }

    const productStats = [
      ['Products', adminProducts.length],
      ['Active', adminProducts.filter((p) => p.active).length],
      ['Low stock', adminProducts.filter((p) => p.stock > 0 && p.stock < 5).length],
      ['Out of stock', adminProducts.filter((p) => p.stock < 1).length],
    ];
    const orderStats = [
      ['Orders', adminOrders.length],
      ['Pending', adminOrders.filter((o) => o.status === 'pending').length],
      ['Delivered', adminOrders.filter((o) => o.status === 'delivered').length],
      ['Revenue (paid)', formatPrice(adminOrders.filter((o) => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0))],
    ];
    const stats = adminTab === 'products' ? productStats : orderStats;

    return (
      <section className="page-section admin-page">
        <div className="page-title">
          <span className="eyebrow">STORE MANAGEMENT</span>
          <h1>Admin dashboard</h1>
        </div>
        <div className="admin-stats">
          {stats.map(([label, value]) => (
            <div className="stat-card" key={label}>
              <span className="detail-label">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="admin-tabs">
          <button className={adminTab === 'products' ? 'active' : ''} onClick={() => loadAdminData('products')}>Products</button>
          <button className={adminTab === 'orders' ? 'active' : ''} onClick={() => loadAdminData('orders')}>Orders</button>
        </div>
        {adminTab === 'products' ? (
          <div className="admin-layout">
            <form className="admin-form" onSubmit={saveProduct}>
              <span className="eyebrow">{editingProductId ? 'EDIT ITEM' : 'ADD TO COLLECTION'}</span>
              <h2>{editingProductId ? 'Update product' : 'New product'}</h2>
              <label>Product name<input required maxLength="160" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
              <label>Description<textarea rows="4" maxLength="5000" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
              <div className="form-grid">
                <label>Price<input required type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
                <label>Stock<input required type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label>
              </div>
              <label>Category<input required value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} /></label>
              <label>Image URL<input type="url" value={productForm.image} onChange={(event) => setProductForm({ ...productForm, image: event.target.value })} /></label>
              <label>SKU<input value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} /></label>
              <div className="checkbox-row">
                <label><input type="checkbox" checked={productForm.active} onChange={(event) => setProductForm({ ...productForm, active: event.target.checked })} /> Active</label>
                <label><input type="checkbox" checked={productForm.featured} onChange={(event) => setProductForm({ ...productForm, featured: event.target.checked })} /> Featured</label>
              </div>
              <button className="button button-dark full-width" disabled={busy}>{editingProductId ? 'Save changes' : 'Create product'}</button>
              {editingProductId ? <button className="button button-light full-width" type="button" onClick={() => { setProductForm(emptyProduct); setEditingProductId(''); }}>Cancel edit</button> : null}
            </form>
            <div className="admin-table-wrap">
              <div className="admin-list-heading"><h2>Products</h2><span>{adminProducts.length} total</span></div>
              <div className="admin-product-list">
                {adminProducts.map((product) => (
                  <article className="admin-product-row" key={product._id}>
                    <div className="admin-product-thumb">{product.image ? <img src={product.image} alt="" /> : <span>✳</span>}</div>
                    <div className="admin-product-info"><strong>{product.name}</strong><span>{product.category} · {formatPrice(product.price)} · {product.stock} in stock</span></div>
                    <button className="small-button" onClick={() => editProduct(product)}>Edit</button>
                    <button className="small-button danger-text" onClick={() => deleteProduct(product._id)}>Delete</button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-order-list">
            {!adminOrders.length ? <div className="empty-state">No orders have been placed yet.</div> : null}
            {adminOrders.map((order) => (
              <article className="order-card admin-order-card" key={order._id}>
                <div className="order-header">
                  <div>
                    <span className="eyebrow">ORDER #{order._id.slice(-8).toUpperCase()}</span>
                    <small>Placed {new Date(order.createdAt).toLocaleString()}</small>
                  </div>
                  <div className="order-header-side">
                    <span className={`status-pill status-${order.status}`}>{order.status}</span>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>
                </div>
                <div className="order-customer">
                  <div className="customer-detail">
                    <span className="detail-label">Customer</span>
                    <strong>{order.user?.name || 'Deleted account'}</strong>
                    {order.user?.email ? <span>{order.user.email}</span> : null}
                    {order.shippingAddress?.phone ? <span>Phone: {order.shippingAddress.phone}</span> : null}
                    {order.user?.role ? <span>Account type: {order.user.role}</span> : null}
                    {order.user?.createdAt ? <span>Joined: {new Date(order.user.createdAt).toLocaleDateString()}</span> : null}
                  </div>
                  <div className="customer-detail">
                    <span className="detail-label">Delivery address</span>
                    <strong>{order.shippingAddress?.fullName}</strong>
                    <span>{order.shippingAddress?.address}</span>
                    <span>{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.postalCode}</span>
                    <span>{order.shippingAddress?.country}</span>
                  </div>
                </div>
                <div className="admin-order-items">
                  {order.items.map((item, index) => (
                    <div className="admin-order-item" key={`${order._id}-${index}`}>
                      {item.image ? <img src={item.image} alt={item.name} loading="lazy" /> : <span className="product-placeholder admin-item-thumb"><span aria-hidden="true">✳</span></span>}
                      <div className="admin-order-item-info">
                        <strong>{item.name}</strong>
                        <span>{item.quantity} × {formatPrice(item.price)}</span>
                      </div>
                      <span className="admin-order-item-total">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="order-totals">
                  <div><span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong></div>
                  <div><span>Shipping</span><strong>{order.shippingFee ? formatPrice(order.shippingFee) : 'Free'}</strong></div>
                  <div className="order-total-line"><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
                </div>
                <div className="admin-order-controls">
                  <span>Payment: {order.paymentMethod.toUpperCase()} · {order.paymentStatus}</span>
                  <label>Status
                    <select value={order.status} onChange={(event) => updateOrderStatus(order._id, event.target.value)}>
                      {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="app-shell">
      <div className="announcement">Thoughtfully chosen essentials for your everyday <span>✳</span></div>
      <header className="site-header">
        <button className="menu-button icon-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? '✕' : '☰'}
        </button>
        <button className="wordmark" onClick={() => setPage('shop')} aria-label={`${storeConfig.storeName} home`}>
          <span className="wordmark-mark">e</span>{storeConfig.storeName}
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={page === 'shop' || page === 'product' ? 'nav-active' : ''} aria-current={page === 'shop' ? 'page' : undefined} onClick={() => setPage('shop')}>Shop</button>
          <button className={page === 'orders' ? 'nav-active' : ''} onClick={openOrders}>My orders</button>
          {user?.role === 'admin' ? <button className={page === 'admin' ? 'nav-active' : ''} onClick={() => loadAdminData('products')}>Admin</button> : null}
        </nav>
        <div className="header-actions">
          {user ? (
            <button className="account-link" onClick={signOut} title="Sign out">{user.name?.split(' ')[0]} <span>↗</span></button>
          ) : (
            <button className="icon-button account-icon" onClick={() => openAuth('login')} aria-label="Sign in">♙</button>
          )}
          <button className={`icon-button bag-button${page === 'cart' ? ' nav-active' : ''}`} onClick={() => setPage('cart')} aria-label={`Shopping bag, ${cartCount} items`}>
            <span>Bag</span><span className="bag-count">{cartCount}</span>
          </button>
        </div>
      </header>
      {menuOpen ? (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button className={page === 'shop' || page === 'product' ? 'nav-active' : ''} onClick={() => setPage('shop')}>Shop</button>
          <button className={page === 'orders' ? 'nav-active' : ''} onClick={openOrders}>My orders</button>
          <button className={page === 'cart' ? 'nav-active' : ''} onClick={() => setPage('cart')}>Bag ({cartCount})</button>
          {user?.role === 'admin' ? <button className={page === 'admin' ? 'nav-active' : ''} onClick={() => loadAdminData('products')}>Admin</button> : null}
          {user ? (
            <button onClick={signOut}>Sign out ({user.name?.split(' ')[0]})</button>
          ) : (
            <button onClick={() => openAuth('login')}>Sign in</button>
          )}
        </nav>
      ) : null}
      {menuOpen ? <button className="nav-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}

      <main>
        {error ? <div className="alert alert-error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div> : null}
        {notice ? <div className="alert alert-notice" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div> : null}
        {page === 'shop' ? renderShop() : null}
        {page === 'product' ? renderProduct() : null}
        {page === 'cart' ? renderCart() : null}
        {page === 'checkout' ? renderCheckout() : null}
        {page === 'account' ? renderAccount() : null}
        {page === 'orders' ? renderOrders() : null}
        {page === 'admin' ? renderAdmin() : null}
      </main>
      <footer className="site-footer">
        <div className="footer-main">
          <div><button className="wordmark footer-brand" onClick={() => setPage('shop')}><span className="wordmark-mark">e</span>{storeConfig.storeName}</button><p>Useful things, chosen with care.</p></div>
          <div><span className="eyebrow">CUSTOMER CARE</span><button onClick={openOrders}>Track an order</button><button onClick={() => setPage('cart')}>Your shopping bag</button></div>
          <div><span className="eyebrow">SHOP</span><button onClick={() => setPage('shop')}>Browse all</button><button onClick={() => { setCategory('All'); setSearch(''); setPage('shop'); }}>New arrivals</button></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} {storeConfig.storeName}</span><span>Made for the everyday.</span></div>
      </footer>
    </div>
  );
}

export default App;
