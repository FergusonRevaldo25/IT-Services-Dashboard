// Services data
const services = [
  {
    name: "AnyDesk Support",
    price: 49,
    icon: "fa-desktop",
    category: "Remote Support",
    description: "24/7 remote assistance",
  },
  {
    name: "Virus Removal",
    price: 79,
    icon: "fa-shield-virus",
    category: "Security",
    description: "Complete malware cleanup",
  },
  {
    name: "Software Installation",
    price: 39,
    icon: "fa-download",
    category: "Software",
    description: "Any software installation",
  },
  {
    name: "Hardware Diagnosis",
    price: 59,
    icon: "fa-microchip",
    category: "Hardware",
    description: "Full hardware checkup",
  },
  {
    name: "Network Setup",
    price: 99,
    icon: "fa-network-wired",
    category: "Network",
    description: "Router & network config",
  },
  {
    name: "Data Recovery",
    price: 149,
    icon: "fa-database",
    category: "Data",
    description: "Lost data recovery",
  },
  {
    name: "Windows Installation",
    price: 69,
    icon: "fa-windows",
    category: "OS",
    description: "OS installation & activation",
  },
  {
    name: "Printer Setup",
    price: 45,
    icon: "fa-print",
    category: "Hardware",
    description: "Printer configuration",
  },
];

// Tax rate (10%)
const TAX_RATE = 0.1;
const DELIVERY_FEE = 5;

// Shopping cart
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

// Load services on homepage
function loadServices() {
  const grid = document.getElementById("servicesGrid");
  if (grid) {
    grid.innerHTML = services
      .slice(0, 6)
      .map(
        (service, index) => `
            <div class="service-card" onclick="addToCart('${service.name}', ${service.price})">
                <i class="fab ${service.icon.includes("fa-") ? service.icon : "fas " + service.icon} fa-2x"></i>
                <h3>${service.name}</h3>
                <p>${service.description}</p>
                <h2>$${service.price}</h2>
                <button class="btn-primary" style="margin-top: 1rem;">Book Now</button>
            </div>
        `,
      )
      .join("");
  }
}

// Add to cart function
function addToCart(name, price) {
  const item = {
    name: name,
    price: price,
    quantity: 1,
    timestamp: new Date().toISOString(),
  };

  const existingItem = cart.find((i) => i.name === name);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push(item);
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  showNotification(`${name} added to cart!`, "success");
}

// Update cart count in navigation
function updateCartCount() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  let cartBadge = document.querySelector(".cart-count");
  if (!cartBadge && totalItems > 0) {
    const navLinks = document.querySelector(".nav-links");
    if (navLinks) {
      cartBadge = document.createElement("span");
      cartBadge.className = "cart-count";
      navLinks.appendChild(cartBadge);
    }
  }
  if (cartBadge) {
    cartBadge.textContent = totalItems;
    cartBadge.style.display = totalItems > 0 ? "inline-block" : "none";
  }
}

// Calculate total with tax and delivery
function calculateTotal() {
  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const tax = subtotal * TAX_RATE;
  const delivery = subtotal > 100 ? 0 : DELIVERY_FEE;
  return {
    subtotal: subtotal,
    tax: tax,
    delivery: delivery,
    total: subtotal + tax + delivery,
  };
}

// Show notification
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === "success" ? "#4CAF50" : "#2196F3"};
        color: white;
        border-radius: 5px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// Update revenue display
function updateRevenue() {
  const revenueElement = document.getElementById("revenue");
  if (revenueElement) {
    const { total } = calculateTotal();
    const totalRevenue = 12450 + total;
    revenueElement.textContent = `$${totalRevenue.toLocaleString()}`;
  }
}

// Simulate real-time updates
setInterval(() => {
  const activeElement = document.getElementById("activeServices");
  if (activeElement) {
    const current = parseInt(activeElement.textContent);
    const change = Math.floor(Math.random() * 5) - 2;
    activeElement.textContent = Math.max(0, current + change);
  }
}, 30000);

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadServices();
  updateCartCount();
  updateRevenue();

  // Add CSS animation
  const style = document.createElement("style");
  style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .cart-count {
            background: #ff4444;
            color: white;
            border-radius: 50%;
            padding: 2px 6px;
            font-size: 12px;
            margin-left: 5px;
        }
    `;
  document.head.appendChild(style);
});
