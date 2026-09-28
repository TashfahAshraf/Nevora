# NÉVORA — Beauty as Ritual

> A premium full-stack skincare e-commerce experience designed around the idea that skincare is more than a routine — it is a ritual.

NÉVORA is a full-stack skincare e-commerce web application combining a cinematic, editorial-style frontend with a functional Node.js backend and SQLite database.

The project brings together premium visual design, product discovery, shopping functionality, order processing, reviews, sessions, database operations, server-side validation, and administrative product management in one complete web application.

---

## ✨ Features

### 🛍️ Customer Storefront

* Premium skincare-focused storefront
* Responsive product catalog
* Product categories and collections
* Product search and filtering
* Product detail pages
* Product images and thumbnails
* Product pricing, sizes, stock, and descriptions
* Skincare concerns and product information
* Shopping cart functionality
* Cart quantity management
* Checkout and order placement
* Cash on Delivery support
* Customer reviews and ratings
* Responsive desktop, tablet, and mobile layouts

### 🔐 Customer & Session Features

* Server-side session handling
* Customer account/session support
* Password hashing using `scrypt`
* Password reset functionality
* Server-side input validation
* Protected administrative functionality

### 🧑‍💼 Admin Dashboard

* Product management
* Add products
* Edit products
* Update prices
* Update stock
* Update product information
* Manage product categories
* Manage product descriptions
* Review order information
* Manage storefront data

### 🗄️ Database

* SQLite relational database
* Product data storage
* Customer/session data
* Order data
* Review data
* Database transactions
* Parameterized SQL queries
* Structured database operations

### ⚙️ Backend & API

* Node.js backend
* REST-style API architecture
* JSON request/response handling
* Server-side validation
* HTTP status code handling
* Product operations
* Cart and order processing
* Session management
* Static frontend hosting

---

## 🎨 Design & User Experience

NÉVORA is designed as a premium beauty brand rather than a conventional e-commerce template.

The interface focuses on:

* Editorial visual hierarchy
* Luxury skincare aesthetics
* Large product imagery
* Clean typography
* Spacious layouts
* Smooth interactions
* Responsive design
* Product-focused sections
* Mobile-friendly navigation
* Consistent visual branding

The goal is to combine **brand storytelling, product discovery, and functional e-commerce** within one immersive experience.

---

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Responsive Web Design
* WebP image assets

### Backend

* Node.js
* Native Node.js HTTP server
* REST-style API endpoints
* Server-side validation
* Session management

### Database

* SQLite
* SQL
* Transactions
* Parameterized queries
* `node:sqlite`

### Security

* `scrypt` password hashing
* Server-side validation
* Session-based access control
* Parameterized database queries

### Development Tools

* Git
* GitHub
* npm
* Node.js

---

## 📁 Project Structure

```text
N-VORA/
│
├── data/
│   ├── images.json
│   └── nevora.db
│
├── public/
│   ├── img/
│   │   └── p/
│   │       ├── product-images.webp
│   │       └── thumbnails.webp
│   │
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   ├── app.js
│   │   ├── pages.js
│   │   └── admin.js
│   │
│   └── index.html
│
├── .env.example
├── db.js
├── seed.js
├── server.js
├── package.json
└── README.md
```

---

## 🔄 Application Architecture

```text
                    ┌─────────────────────┐
                    │      NÉVORA UI      │
                    │    HTML / CSS / JS  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Node.js Server   │
                    │   REST-style APIs   │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
        ┌─────────────────┐        ┌─────────────────┐
        │ Validation &    │        │ Session / Order │
        │ Business Logic  │        │ Management      │
        └────────┬────────┘        └────────┬────────┘
                 │                          │
                 └────────────┬─────────────┘
                              ▼
                    ┌─────────────────────┐
                    │       SQLite        │
                    │      Database       │
                    └─────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

* Node.js 22.5+
* Git
* A modern web browser

NÉVORA uses Node's built-in `node:sqlite`, so a separate SQLite installation is not required.

Check your Node.js version:

```bash
node -v
```

---

## 📥 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/TashfahAshraf/N-VORA.git
```

### 2. Navigate to the Project

```bash
cd N-VORA
```

### 3. Install Dependencies

```bash
npm install
```

---

## 🔐 Environment Configuration

Create a `.env` file based on the provided example:

```bash
cp .env.example .env
```

Configure the required environment variables before running the application.

> Never commit private credentials, API keys, production secrets, or sensitive environment variables to GitHub.

---

## 🗄️ Initialize the Database

Run the seed script:

```bash
node seed.js
```

This initializes the NÉVORA database and populates the initial product catalog and development data.

---

## ▶️ Run the Application

Start the server:

```bash
node server.js
```

The application will be available at:

```text
http://localhost:3000
```

Open the URL in your browser to view the NÉVORA storefront.

---

## 🔄 Reset the Database

If the reset script is available in `package.json`, the database can be reset and reseeded using:

```bash
npm run reset
```

> **Warning:** Resetting the database recreates the seeded development database state.

---

## 🛒 E-Commerce Flow

The primary customer journey is structured around:

```text
Browse Products
      ↓
Search / Filter / Discover
      ↓
View Product
      ↓
Add to Cart
      ↓
Review Cart
      ↓
Checkout
      ↓
Place Order
      ↓
Order Stored in Database
```

This demonstrates both the visual storefront experience and the underlying e-commerce workflow.

---

## 💳 Payment

The current implementation supports:

**Cash on Delivery (COD)**

The payment structure can be extended in the future to support online payment providers and additional payment methods.

---

## ⭐ Reviews

NÉVORA supports product reviews and ratings.

Development/demo reviews are included with the seeded application data.

> Demo reviews and product information should be reviewed or replaced before using the application as a production storefront.

---

## 🔐 Security

The project implements several backend security practices, including:

* Password hashing with `scrypt`
* Parameterized SQL queries
* Server-side input validation
* Session-based access control
* Database transactions
* Separation of frontend and backend responsibilities

Before production deployment, additional security hardening should be performed, including:

* HTTPS
* Secure production session configuration
* Rate limiting
* Production credential management
* Secure cookie configuration
* Payment security
* Production database security
* Additional input/output sanitization where applicable

---

## ⚠️ Development & Production Notes

The current repository is primarily a portfolio and development project.

Before using NÉVORA as a production commercial store, review and replace:

* Product information
* Product pricing
* Product stock
* Product descriptions
* Product imagery
* Demo reviews
* Contact information
* Administrative credentials
* Environment variables
* Payment configuration
* Production database configuration

Any demonstration or placeholder content should be replaced with real business data before deployment.

---

## 📱 Responsive Design

NÉVORA is designed to provide a responsive experience across:

* Desktop
* Laptop
* Tablet
* Mobile devices

The interface adapts navigation, product grids, typography, imagery, and interactive elements according to screen size.

---

## 📸 Screenshots

Screenshots can be added here to showcase the application.

### Homepage

*Add homepage screenshot here.*

### Product Catalog

*Add product catalog screenshot here.*

### Product Details

*Add product detail screenshot here.*

### Shopping Cart

*Add shopping cart screenshot here.*

### Checkout

*Add checkout screenshot here.*

### Admin Dashboard

*Add admin dashboard screenshot here.*

---

## 🌐 Live Demo

**Live Website:**
*Add your deployed NÉVORA URL here.*

**GitHub Repository:**
https://github.com/TashfahAshraf/N-VORA

---

## 📌 Future Improvements

Potential future improvements include:

* Online payment gateway integration
* Customer order history
* Order tracking
* Wishlist functionality
* Advanced product filtering
* Product recommendations
* Inventory alerts
* Verified purchase reviews
* Image upload management
* Admin analytics dashboard
* Customer profile management
* Email notifications
* Production-grade authentication
* Automated testing
* API documentation
* Cloud database integration
* Production monitoring

---

## 🎯 Project Goals

NÉVORA was developed to demonstrate the ability to build a complete web application rather than only a static frontend.

The project focuses on:

* Full-stack web development
* Responsive UI/UX
* REST-style backend architecture
* Database design
* CRUD operations
* Server-side validation
* Authentication and session management
* E-commerce workflows
* Administrative functionality
* Clean project organization
* Production-oriented development practices

---

## 👩‍💻 Author

### Tashfah Ashraf

**Full-Stack Web Developer | BS Information Technology**

GitHub:
https://github.com/TashfahAshraf

Portfolio:
https://tashfahashraf.netlify.app

---

## 📄 License

This project was created for educational, portfolio, and development purposes.

Please review the licensing of all third-party assets, fonts, images, icons, and product imagery before using the project commercially.

---

## 💖 NÉVORA

**Beauty as Ritual.**

*A skincare e-commerce experience where technology meets thoughtful design.*
