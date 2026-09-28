# NÉVORA — Luxury Skincare E-Commerce Platform

**NÉVORA** is a premium full-stack skincare e-commerce web application developed as an **internship task at Decode Labs**.

The project combines a luxury-focused, responsive frontend with a Node.js/Express backend and database integration to create a complete end-to-end e-commerce experience.

---

## ✨ Overview

NÉVORA was designed around a modern luxury skincare aesthetic, with a strong focus on:

* Premium visual presentation
* Responsive and interactive UI
* Dynamic product components
* Structured backend architecture
* REST API integration
* Database-driven product information
* Scalable full-stack development practices

The application includes **13 skincare product categories**, allowing products and their information to be presented through a dynamic and organized shopping experience.

---

## 🚀 Key Features

### 🎨 Frontend

* Modern luxury skincare-inspired interface
* Responsive design for desktop, tablet, and mobile
* Dynamic React.js components
* Interactive product sections
* Structured product categories
* Premium visual assets and layouts
* User-focused UI/UX
* Smooth frontend-to-backend integration

### ⚙️ Backend

* Node.js server-side environment
* Express.js backend framework
* RESTful API endpoints
* Server-side routing
* Product data handling
* Request and response management
* Backend integration with the database

### 🗄️ Database

* Database connection and configuration
* Product data storage
* Product pricing management
* Inventory-related data
* Database queries and data retrieval
* Dynamic data communication between the backend and frontend

---

## 🛠️ Technology Stack

| Layer                 | Technologies                      |
| --------------------- | --------------------------------- |
| **Frontend**          | HTML5, CSS3, JavaScript, React.js |
| **Backend**           | Node.js, Express.js               |
| **Database**          | SQL / NoSQL                       |
| **API**               | RESTful APIs                      |
| **Development Tools** | Git, GitHub, VS Code              |

---

## 🔄 Application Architecture

NÉVORA follows a full-stack architecture where the different layers communicate with each other:

```text
┌──────────────────────────┐
│        React.js          │
│        Frontend          │
└────────────┬─────────────┘
             │
             │ REST API
             ▼
┌──────────────────────────┐
│     Node.js + Express    │
│        Backend           │
└────────────┬─────────────┘
             │
             │ Database Queries
             ▼
┌──────────────────────────┐
│        Database          │
│ Product / Price / Stock  │
└──────────────────────────┘
```

This structure allows the frontend to request and display dynamic information while the backend handles application logic and database communication.

---

## 🛍️ Product Experience

The application includes **13 product categories** focused on skincare and beauty products.

Product information can be managed through the backend and database layer, allowing the frontend to consume and display dynamic data rather than relying entirely on static content.

---

## 📱 Responsive Design

NÉVORA is designed to provide a consistent experience across different screen sizes.

The interface focuses on:

* Desktop responsiveness
* Tablet layouts
* Mobile-friendly sections
* Flexible product displays
* Responsive navigation
* Adaptable visual assets

---

## 📂 Project Structure

The project is organized into separate frontend and backend responsibilities to maintain a clear full-stack architecture.

```text
NÉVORA/
│
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── assets/
│   └── ...
│
├── backend/
│   ├── routes/
│   ├── db.js
│   ├── server.js
│   └── ...
│
├── package.json
├── README.md
└── ...
```

> The exact folder structure may vary depending on the current implementation of the repository.

---

## 🎯 Internship Task

This project was completed as part of my **Decode Labs internship**.

The task provided hands-on experience with building a complete full-stack application rather than focusing only on the frontend.

Through NÉVORA, I worked with:

* React-based frontend development
* Backend development with Node.js and Express.js
* REST API integration
* Database connectivity
* Dynamic product data
* Responsive UI/UX
* Frontend-backend communication
* Full-stack project organization

---

## 💡 What I Learned

Working on NÉVORA strengthened my practical understanding of how the different layers of a web application communicate.

### Frontend → Backend

React components communicate with backend API endpoints to request and work with application data.

### Backend → Database

The Express.js backend handles database connections and queries through the database configuration.

### Database → Frontend

Stored product information is retrieved through the backend and ultimately displayed dynamically in the frontend.

This provided practical experience with the complete flow:

**UI → API → Server → Database → Server → API → UI**

---

## 🔮 Future Improvements

Possible future enhancements include:

* User authentication and authorization
* Shopping cart persistence
* Wishlist functionality
* Order management
* Payment gateway integration
* Admin dashboard
* Advanced product filtering
* Search functionality
* Product reviews and ratings
* User accounts and order history

---

## 👩‍💻 Developer

**Tashfah Ashraf**

BS Information Technology Student | Full-Stack Web Developer

Interested in building modern, responsive and production-oriented web applications.

### 🔗 Links

* **GitHub:** https://github.com/TashfahAshraf
* **Portfolio:** https://tashfahashraf.netlify.app

---

## 📌 Project Status

**Completed — Decode Labs Internship Task**

Built with ❤️ using React.js, Node.js, Express.js and database integration.
