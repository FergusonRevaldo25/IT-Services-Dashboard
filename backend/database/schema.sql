-- Drop tables if they exist (SQL Server syntax)
IF OBJECT_ID('order_items', 'U') IS NOT NULL DROP TABLE order_items;
IF OBJECT_ID('orders', 'U') IS NOT NULL DROP TABLE orders;
IF OBJECT_ID('services', 'U') IS NOT NULL DROP TABLE services;
IF OBJECT_ID('news', 'U') IS NOT NULL DROP TABLE news;
IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users;
GO

-- Users table
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(100) UNIQUE NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    full_name NVARCHAR(200),
    phone NVARCHAR(20),
    address NVARCHAR(500),
    is_admin INT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    last_login DATETIME
);
GO

-- Orders table
CREATE TABLE orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    order_number NVARCHAR(50) UNIQUE,
    total_amount DECIMAL(10,2),
    tax DECIMAL(10,2),
    delivery_fee DECIMAL(10,2),
    status NVARCHAR(50) DEFAULT 'pending',
    payment_status NVARCHAR(50) DEFAULT 'unpaid',
    payment_intent_id NVARCHAR(255),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
GO

-- Order items table
CREATE TABLE order_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT,
    service_name NVARCHAR(200),
    quantity INT,
    price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);
GO

-- Services table
CREATE TABLE services (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) UNIQUE,
    description NVARCHAR(1000),
    price DECIMAL(10,2),
    category NVARCHAR(100),
    icon NVARCHAR(100),
    is_active INT DEFAULT 1
);
GO

-- News table
CREATE TABLE news (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(500),
    content NVARCHAR(MAX),
    image_url NVARCHAR(500),
    category NVARCHAR(100),
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- Insert sample services (SQL Server syntax)
INSERT INTO services (name, description, price, category, icon, is_active)
SELECT 'AnyDesk Support', '24/7 remote assistance via AnyDesk', 49, 'Remote Support', 'fa-desktop', 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'AnyDesk Support');

INSERT INTO services (name, description, price, category, icon, is_active)
SELECT 'Virus Removal', 'Complete malware and virus cleanup', 79, 'Security', 'fa-shield-virus', 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Virus Removal');

INSERT INTO services (name, description, price, category, icon, is_active)
SELECT 'Software Installation', 'Any software installation & configuration', 39, 'Software', 'fa-download', 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Software Installation');

INSERT INTO services (name, description, price, category, icon, is_active)
SELECT 'Hardware Diagnosis', 'Full hardware diagnostic checkup', 59, 'Hardware', 'fa-microchip', 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Hardware Diagnosis');

INSERT INTO services (name, description, price, category, icon, is_active)
SELECT 'Network Setup', 'Router, WiFi & network configuration', 99, 'Network', 'fa-network-wired', 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Network Setup');

INSERT INTO services (name, description, price, category, icon, is_active)
SELECT 'Data Recovery', 'Lost or deleted data recovery', 149, 'Data', 'fa-database', 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Data Recovery');
GO