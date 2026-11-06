function ProductCard({ product, formatPrice, onAdd, onOpen, index }) {
  return (
    <article className="product-card" style={{ '--card-index': index }}>
      <button className="product-image" onClick={() => onOpen(product)} aria-label={`View ${product.name}`}>
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" />
        ) : (
          <span className="product-placeholder"><span aria-hidden="true">✳</span></span>
        )}
        {product.featured ? <span className="product-badge">CURATED</span> : null}
        {product.stock < 1 ? <span className="sold-out-badge">SOLD OUT</span> : null}
        <span className="image-arrow" aria-hidden="true">↗</span>
      </button>
      <div className="product-info">
        <div className="product-meta"><span>{product.category}</span>{product.stock > 0 && product.stock < 5 ? <span>Only {product.stock} left</span> : null}</div>
        <button className="product-name" onClick={() => onOpen(product)}>{product.name}</button>
        {product.rating > 0 ? (
          <div className="product-rating" aria-label={`Rated ${product.rating.toFixed(1)} out of 5 from ${product.reviewCount} reviews`}>
            <span className="rating-stars" aria-hidden="true">★</span>
            <strong>{product.rating.toFixed(1)}</strong>
            <span>({product.reviewCount})</span>
          </div>
        ) : null}
        <div className="product-bottom">
          <strong>{formatPrice(product.price)}</strong>
          <button className="add-button" disabled={product.stock < 1} onClick={() => onAdd(product)} aria-label={`Add ${product.name} to bag`}>
            <span aria-hidden="true">+</span> Add to bag
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
