const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');

dotenv.config();

const IMG = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=85`;

const starterProducts = [
    { name: 'Everyday Backpack', category: 'Accessories', price: 2499, stock: 25, featured: true, sku: 'EM-ACC-001', tags: ['bag', 'travel', 'everyday'], rating: 4.6, reviewCount: 214, description: 'A durable everyday backpack with a padded laptop sleeve and practical compartments.', image: IMG('1553062407-98eeb64c6a62') },
    { name: 'Classic Ceramic Mug', category: 'Home', price: 499, stock: 60, sku: 'EM-HOM-001', tags: ['kitchen', 'coffee', 'tea'], rating: 4.4, reviewCount: 156, description: 'A comfortable, reusable ceramic mug for your daily coffee or tea.', image: IMG('1514228742587-6b1558fcca3d') },
    { name: 'Wireless Headphones', category: 'Electronics', price: 3999, stock: 18, featured: true, sku: 'EM-ELE-001', tags: ['audio', 'wireless', 'gift'], rating: 4.7, reviewCount: 389, description: 'Comfortable over-ear headphones with wireless connectivity and clear sound.', image: IMG('1505740420928-5e560c06d30e') },
    { name: 'Cotton T-Shirt', category: 'Apparel', price: 899, stock: 40, sku: 'EM-APP-001', tags: ['cotton', 'basics', 'everyday'], rating: 4.3, reviewCount: 178, description: 'A soft, breathable cotton T-shirt for everyday wear.', image: IMG('1521572163474-6864f9cf17ab') },
    { name: 'Desk Organizer', category: 'Home', price: 799, stock: 30, sku: 'EM-HOM-002', tags: ['office', 'workspace', 'gift'], rating: 4.2, reviewCount: 87, description: 'Keep your workspace tidy with a compact desk organizer.', image: IMG('1498050108023-c5249f4df085') },
    { name: 'Insulated Water Bottle', category: 'Accessories', price: 1199, stock: 35, sku: 'EM-ACC-002', tags: ['travel', 'fitness', 'eco'], rating: 4.5, reviewCount: 203, description: 'A reusable insulated bottle designed to keep drinks at temperature.', image: IMG('1602143407151-7111542de6e8') }
];

const catalogProducts = [
    // Electronics
    { name: 'Wireless Earbuds', category: 'Electronics', price: 1999, stock: 45, sku: 'EM-ELE-002', tags: ['audio', 'wireless', 'compact'], rating: 4.4, reviewCount: 167, description: 'Lightweight earbuds with noise isolation, touch controls, and a pocket-sized charging case.', image: IMG('1590658268037-6bf12165a8df') },
    { name: 'Smartwatch', category: 'Electronics', price: 5999, stock: 22, featured: true, sku: 'EM-ELE-003', tags: ['fitness', 'wearable', 'gift'], rating: 4.5, reviewCount: 298, description: 'Track workouts, heart rate, sleep, and notifications with a bright always-on display.', image: IMG('1546868871-7041f2a55e12') },
    { name: 'Bluetooth Speaker', category: 'Electronics', price: 2999, stock: 30, sku: 'EM-ELE-004', tags: ['audio', 'wireless', 'portable'], rating: 4.3, reviewCount: 121, description: 'A compact wireless speaker with rich bass and up to 12 hours of playtime.', image: IMG('1589003077984-894e133dabab') },
    { name: 'Mechanical Keyboard', category: 'Electronics', price: 4499, stock: 20, sku: 'EM-ELE-005', tags: ['workspace', 'gaming', 'gift'], rating: 4.6, reviewCount: 94, description: 'A tactile mechanical keyboard with warm backlighting and durable switches.', image: IMG('1777259113729-9bda92fb8ce8') },
    // Apparel
    { name: 'Denim Jeans', category: 'Apparel', price: 1999, stock: 32, sku: 'EM-APP-002', tags: ['denim', 'everyday', 'classic'], rating: 4.4, reviewCount: 145, description: 'Classic straight-fit denim jeans in a sturdy, soft-washed cotton stretch fabric.', image: IMG('1542272604-787c3835535d') },
    { name: 'Baseball Cap', category: 'Apparel', price: 699, stock: 50, sku: 'EM-APP-003', tags: ['casual', 'cotton', 'accessory'], rating: 4.2, reviewCount: 76, description: 'A breathable washed-cotton twill cap with an adjustable strap for an easy fit.', image: IMG('1521369909029-2afed882baee') },
    { name: 'Chambray Shirt', category: 'Apparel', price: 1299, stock: 28, sku: 'EM-APP-004', tags: ['smart-casual', 'cotton', 'classic'], rating: 4.5, reviewCount: 88, description: 'An easy-wearing chambray button-up that works with jeans or chinos.', image: IMG('1596755094514-f87e34085b2c') },
    { name: 'Knit Poncho', category: 'Apparel', price: 1799, stock: 24, featured: true, sku: 'EM-APP-005', tags: ['knit', 'cozy', 'winter'], rating: 4.6, reviewCount: 59, description: 'A relaxed chunky-knit poncho with fringe trim, sized for easy layering.', image: IMG('1434389677669-e08b4cac3105') },
    { name: 'Cotton Hoodie', category: 'Apparel', price: 1499, stock: 38, sku: 'EM-APP-006', tags: ['fleece', 'casual', 'everyday'], rating: 4.4, reviewCount: 132, description: 'A relaxed-fit fleece hoodie with a roomy pocket and soft brushed interior.', image: IMG('1564557287817-3785e38ec1f5') },
    // Accessories
    { name: 'Polarised Sunglasses', category: 'Accessories', price: 1599, stock: 40, sku: 'EM-ACC-003', tags: ['summer', 'uv-protection', 'travel'], rating: 4.3, reviewCount: 118, description: 'UV400 polarised lenses in a featherweight round frame with a secure grip.', image: IMG('1511499767150-a48a237f0083') },
    { name: 'Structured Handbag', category: 'Accessories', price: 3499, stock: 16, featured: true, sku: 'EM-ACC-004', tags: ['leather', 'work', 'gift'], rating: 4.7, reviewCount: 64, description: 'A top-handle leather bag with a structured silhouette, inner zip pocket, and detachable strap.', image: IMG('1584917865442-de89df76afd3') },
    { name: 'Leather Wallet', category: 'Accessories', price: 1299, stock: 42, sku: 'EM-ACC-005', tags: ['leather', 'gift', 'everyday'], rating: 4.5, reviewCount: 151, description: 'A slim full-grain leather wallet with RFID protection and eight card slots.', image: IMG('1579014134953-1580d7f123f3') },
    { name: 'Minimalist Watch', category: 'Accessories', price: 3299, stock: 18, sku: 'EM-ACC-006', tags: ['classic', 'gift', 'work'], rating: 4.6, reviewCount: 97, description: 'A clean-dial analogue watch with a genuine leather strap and sapphire glass.', image: IMG('1524592094714-0f0654e20314') },
    // Home
    { name: 'Velvet Sofa', category: 'Home', price: 24999, stock: 8, featured: true, sku: 'EM-HOM-003', tags: ['living-room', 'statement', 'comfort'], rating: 4.8, reviewCount: 41, description: 'A two-seat velvet sofa with tapered solid-wood legs and deep, supportive cushions.', image: IMG('1555041469-a586c61ea9bc') },
    { name: 'Tufted Accent Chair', category: 'Home', price: 8999, stock: 12, sku: 'EM-HOM-004', tags: ['living-room', 'statement', 'comfort'], rating: 4.5, reviewCount: 28, description: 'A button-tufted accent chair with turned legs, as comfortable as it is photogenic.', image: IMG('1567538096630-e0c55bd6374c') },
    { name: 'Ceramic Plant Pot', category: 'Home', price: 799, stock: 36, sku: 'EM-HOM-005', tags: ['plants', 'decor', 'gift'], rating: 4.4, reviewCount: 83, description: 'A matte ceramic planter with a drainage hole and matching saucer.', image: IMG('1485955900006-10f4d324d411') },
    { name: 'Table Lamp', category: 'Home', price: 1699, stock: 26, sku: 'EM-HOM-006', tags: ['lighting', 'bedroom', 'workspace'], rating: 4.3, reviewCount: 55, description: 'A warm-glow bedside lamp with stepless touch dimming and a fabric shade.', image: IMG('1517991104123-1d56a6e81ed9') },
    { name: 'Scented Candle', category: 'Home', price: 599, stock: 55, sku: 'EM-HOM-007', tags: ['gift', 'cozy', 'relaxation'], rating: 4.6, reviewCount: 174, description: 'A hand-poured soy candle with notes of sandalwood and vanilla. 40-hour burn.', image: IMG('1758077223826-74f8ec22ebfd') },
    // Beauty
    { name: 'Vitamin C Face Serum', category: 'Beauty', price: 1199, stock: 50, featured: true, sku: 'EM-BEA-001', tags: ['skincare', 'brightening', 'daily'], rating: 4.5, reviewCount: 212, description: 'A brightening serum with 10% vitamin C, hyaluronic acid, and vitamin E.', image: IMG('1723951174326-2a97221d3b7f') },
    { name: 'Skincare Essentials Set', category: 'Beauty', price: 2499, stock: 25, sku: 'EM-BEA-002', tags: ['skincare', 'gift', 'routine'], rating: 4.7, reviewCount: 96, description: 'A four-step routine: gentle cleanser, toner, moisturiser, and SPF 50.', image: IMG('1718490953028-021d352b14fd') },
    { name: 'Eau de Parfum', category: 'Beauty', price: 2999, stock: 20, sku: 'EM-BEA-003', tags: ['fragrance', 'gift', 'evening'], rating: 4.4, reviewCount: 138, description: 'An amber-woody fragrance with citrus top notes and a lasting 8-hour trail.', image: IMG('1761659760494-32b921a2449f') },
    // Fitness
    { name: 'Non-slip Yoga Mat', category: 'Fitness', price: 999, stock: 46, sku: 'EM-FIT-001', tags: ['yoga', 'home-workout', 'grip'], rating: 4.3, reviewCount: 167, description: 'A 6mm cushioned mat with a textured non-slip surface and carry strap.', image: IMG('1763004871583-4183d64096b1') },
    { name: 'Adjustable Dumbbell Set', category: 'Fitness', price: 2799, stock: 18, featured: true, sku: 'EM-FIT-002', tags: ['strength', 'home-workout', 'space-saving'], rating: 4.8, reviewCount: 74, description: 'Two dumbbells that dial from 2.5kg to 24kg, replacing fifteen pairs of weights.', image: IMG('1638536532686-d610adfc8e5c') },
    { name: 'Resistance Bands Set', category: 'Fitness', price: 799, stock: 52, sku: 'EM-FIT-003', tags: ['travel', 'home-workout', 'recovery'], rating: 4.2, reviewCount: 189, description: 'Five latex loops from extra-light to extra-heavy with a door anchor and handles.', image: IMG('1584735935682-2f2b69dff9d2') },
    // Footwear
    { name: 'Trail Running Shoes', category: 'Footwear', price: 4299, stock: 20, sku: 'EM-FOT-001', tags: ['running', 'outdoor', 'grip'], rating: 4.5, reviewCount: 112, description: 'Grippy, cushioned trail runners with a breathable engineered-mesh upper.', image: IMG('1560769629-975ec94e6a86') },
    { name: 'Canvas Sneakers', category: 'Footwear', price: 2699, stock: 28, sku: 'EM-FOT-002', tags: ['casual', 'everyday', 'classic'], rating: 4.3, reviewCount: 143, description: 'Low-top vulcanised sneakers in durable canvas with a cushioned insole.', image: IMG('1676379760823-ebf91f45de0b') },
    { name: 'Leather Boots', category: 'Footwear', price: 3799, stock: 16, featured: true, sku: 'EM-FOT-003', tags: ['leather', 'outdoor', 'winter'], rating: 4.6, reviewCount: 67, description: 'Rugged lace-up boots with a lugged rubber sole and padded collar.', image: IMG('1520639888713-7851133b1ed0') },
    // Stationery
    { name: 'Hardcover Notebook', category: 'Stationery', price: 499, stock: 60, sku: 'EM-STA-001', tags: ['workspace', 'gift', 'journaling'], rating: 4.7, reviewCount: 231, description: 'A 192-page dot-grid notebook with lays-flat binding and acid-free paper.', image: IMG('1591195852468-03a01d1375d6') },
    { name: 'Gel Pen Set', category: 'Stationery', price: 349, stock: 65, sku: 'EM-STA-002', tags: ['workspace', 'journaling', 'everyday'], rating: 4.4, reviewCount: 108, description: 'Twelve quick-drying 0.5mm gel pens in assorted colours.', image: IMG('1522363890879-4bf9c65ee3f8') },
    // Kitchen
    { name: 'Chef Knife Set', category: 'Kitchen', price: 3999, stock: 14, sku: 'EM-KIT-001', tags: ['cooking', 'gift', 'steel'], rating: 4.6, reviewCount: 82, description: 'A five-piece high-carbon stainless steel set with a magnetic walnut block.', image: IMG('1547978074-bf0b7285d686') },
    { name: 'Stoneware Dinnerware Set', category: 'Kitchen', price: 2999, stock: 22, sku: 'EM-KIT-002', tags: ['dining', 'gift', 'ceramic'], rating: 4.5, reviewCount: 61, description: 'A sixteen-piece reactive-glaze set for four: dinner plates, bowls, and mugs.', image: IMG('1571987530791-58e3e7744d99') },
    { name: 'Non-stick Cookware Set', category: 'Kitchen', price: 4999, stock: 16, sku: 'EM-KIT-003', tags: ['cooking', 'everyday', 'gift'], rating: 4.4, reviewCount: 99, description: 'A seven-piece triply cookware set with stay-cool handles, oven-safe to 260 degrees.', image: IMG('1584990347193-6bebebfeaeee') }
];

const demoCustomers = [
    { name: 'Priya Sharma', email: 'priya@example.com' },
    { name: 'Rahul Verma', email: 'rahul@example.com' },
    { name: 'Sneha Iyer', email: 'sneha@example.com' },
    { name: 'Vikram Reddy', email: 'vikram@example.com' }
];

const demoOrderPlans = [
    { customer: 'priya@example.com', status: 'delivered', paymentMethod: 'cod', daysAgo: 12, items: [['Cotton T-Shirt', 2], ['Classic Ceramic Mug', 1]] },
    { customer: 'priya@example.com', status: 'shipped', paymentMethod: 'stripe', daysAgo: 5, items: [['Wireless Headphones', 1]] },
    { customer: 'rahul@example.com', status: 'delivered', paymentMethod: 'razorpay', daysAgo: 9, items: [['Everyday Backpack', 1], ['Insulated Water Bottle', 2]] },
    { customer: 'rahul@example.com', status: 'processing', paymentMethod: 'cod', daysAgo: 3, items: [['Denim Jeans', 1], ['Cotton Hoodie', 1]] },
    { customer: 'rahul@example.com', status: 'cancelled', paymentMethod: 'stripe', daysAgo: 7, items: [['Smartwatch', 1]] },
    { customer: 'sneha@example.com', status: 'delivered', paymentMethod: 'cod', daysAgo: 15, items: [['Velvet Sofa', 1]] },
    { customer: 'sneha@example.com', status: 'pending', paymentMethod: 'stripe', daysAgo: 1, items: [['Mechanical Keyboard', 1]] },
    { customer: 'sneha@example.com', status: 'delivered', paymentMethod: 'razorpay', daysAgo: 6, items: [['Polarised Sunglasses', 2], ['Baseball Cap', 1]] },
    { customer: 'vikram@example.com', status: 'shipped', paymentMethod: 'cod', daysAgo: 4, items: [['Trail Running Shoes', 1]] },
    { customer: 'vikram@example.com', status: 'processing', paymentMethod: 'razorpay', daysAgo: 2, items: [['Adjustable Dumbbell Set', 1], ['Non-slip Yoga Mat', 2]] }
];

const paymentStatusFor = (status, method) => {
    if (status === 'delivered') return 'paid';
    if (status === 'cancelled') return method === 'cod' ? 'unpaid' : 'failed';
    if (status === 'pending') return method === 'cod' ? 'unpaid' : 'pending';
    if (method === 'cod') return 'unpaid';
    return 'paid';
};

const addresses = {
    'priya@example.com': { fullName: 'Priya Sharma', phone: '9000000001', address: '14 Rose Villa, 3rd Cross', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'India' },
    'rahul@example.com': { fullName: 'Rahul Verma', phone: '9000000002', address: '22 Lake View Apartments', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'India' },
    'sneha@example.com': { fullName: 'Sneha Iyer', phone: '9000000003', address: '7 Palm Grove Road', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001', country: 'India' },
    'vikram@example.com': { fullName: 'Vikram Reddy', phone: '9000000004', address: '31 Jubilee Hills Lane', city: 'Hyderabad', state: 'Telangana', postalCode: '500033', country: 'India' }
};

const seedProducts = async () => {
    const allProducts = [...starterProducts, ...catalogProducts];
    let created = 0;
    let enriched = 0;

    for (const product of allProducts) {
        const existing = await Product.findOne({ name: product.name });
        if (!existing) {
            await Product.create(product);
            created += 1;
            continue;
        }
        const patch = {};
        if (!existing.sku) patch.sku = product.sku;
        if (!existing.tags || existing.tags.length === 0) patch.tags = product.tags;
        if (!existing.rating) patch.rating = product.rating;
        if (!existing.reviewCount) patch.reviewCount = product.reviewCount;
        if (!existing.image && product.image) patch.image = product.image;
        if (Object.keys(patch).length > 0) {
            await Product.updateOne({ _id: existing._id }, { $set: patch });
            enriched += 1;
        }
    }
    console.log(`Products: ${created} created, ${enriched} enriched with sku/tags/ratings.`);
};

const seedDemoData = async () => {
    const password = await bcrypt.hash('demo1234', 12);
    let customersCreated = 0;
    for (const customer of demoCustomers) {
        if (!(await User.exists({ email: customer.email }))) {
            await User.create({ ...customer, password, role: 'customer' });
            customersCreated += 1;
        }
    }

    let ordersCreated = 0;
    const plansByCustomer = new Map();
    for (const plan of demoOrderPlans) {
        if (!plansByCustomer.has(plan.customer)) plansByCustomer.set(plan.customer, []);
        plansByCustomer.get(plan.customer).push(plan);
    }
    for (const [email, plans] of plansByCustomer) {
        const user = await User.findOne({ email });
        if (!user) continue;
        if (await Order.exists({ user: user._id })) continue;

        for (const plan of plans) {
            const items = [];
            for (const [name, quantity] of plan.items) {
                const product = await Product.findOne({ name });
                if (!product) continue;
                items.push({ product: product._id, name: product.name, image: product.image, price: product.price, quantity });
            }
            if (items.length === 0) continue;

            const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const order = await Order.create({
                user: user._id,
                items,
                shippingAddress: addresses[email],
                subtotal,
                shippingFee: 0,
                total: subtotal,
                currency: (process.env.STORE_CURRENCY || 'INR').toLowerCase(),
                paymentMethod: plan.paymentMethod,
                paymentStatus: paymentStatusFor(plan.status, plan.paymentMethod),
                status: plan.status
            });
            await Order.updateOne({ _id: order._id }, {
                $set: {
                    createdAt: new Date(Date.now() - plan.daysAgo * 86400000),
                    updatedAt: new Date(Date.now() - plan.daysAgo * 86400000)
                }
            });
            if (plan.status !== 'cancelled') {
                for (const item of items) {
                    await Product.updateOne({ _id: item.product }, { $inc: { stock: -item.quantity } });
                }
            }
            ordersCreated += 1;
        }
    }
    console.log(`Demo data: ${customersCreated} customers, ${ordersCreated} orders created.`);
};

const seedAdministrator = async () => {
    if (!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)) {
        console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD in the local environment to create an administrator.');
        return;
    }
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    if (email === 'admin@example.com' || process.env.ADMIN_PASSWORD === 'replace-with-a-strong-password') {
        throw new Error('Replace the example admin email and password before creating an administrator.');
    }
    if (await User.findOne({ email })) {
        console.log(`Account ${email} already exists; administrator was not changed.`);
        return;
    }
    await User.create({
        name: process.env.ADMIN_NAME || 'Store Admin',
        email,
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
        role: 'admin'
    });
    console.log(`Created administrator account for ${email}.`);
};

const seed = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('Set MONGO_URI before running the seed command.');
    }
    await connectDB();
    await seedProducts();
    await seedDemoData();
    await seedAdministrator();
    process.exit(0);
};

seed().catch((error) => {
    console.error('Store seeding failed:', error.message);
    process.exit(1);
});
