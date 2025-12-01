# Mechanic Project Backend

A Node.js + Express + MongoDB backend following MVC architecture for a mechanic/workshop system.

## Features
- User, Product, Order, Car schemas
- JWT authentication & role-based authorization
- CRUD endpoints for all models
- Pagination, validation, error handling

## Folder Structure
```
/models
/controllers
/routes
/config
/middlewares
/services (optional)
server.js
.env
README.md
```

## Getting Started

### 1. Clone & Install
```
git clone <repo-url>
cd mechanic-project
npm install
```

### 2. Configure Environment
Create a `.env` file:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/mechanicdb
JWT_SECRET=your_jwt_secret_here
```

### 3. Run the Server
```
npm run dev
```

## API Endpoints

### Auth
- `POST /auth/register` — Register new user
- `POST /auth/login` — Login and get JWT

### Users
- `GET /users` — List users (admin only, paginated)
- `GET /users/:id` — Get user by ID
- `PUT /users/:id` — Update user (self or admin)
- `DELETE /users/:id` — Delete user (admin only)

### Products
- `GET /products` — List products (paginated)
- `POST /products` — Add product (workshopOwner only)
- `PUT /products/:id` — Edit product (workshopOwner only)
- `DELETE /products/:id` — Delete product (workshopOwner only)

### Orders
- `GET /orders` — List orders (user or admin, paginated)
- `POST /orders` — Create order (user only)
- `PUT /orders/:id` — Update order (user or admin)
- `DELETE /orders/:id` — Cancel order (user or admin)

### Cars
- `GET /cars` — List cars (user or admin, paginated)
- `POST /cars` — Add car (user only)
- `PUT /cars/:id` — Update car (user only)
- `DELETE /cars/:id` — Delete car (user only)

## Authentication & Roles
- Register/login to get JWT token
- Pass token as `Authorization: Bearer <token>`
- Roles: `user`, `mechanic`, `workshopOwner`, `admin`
- Role-based access enforced on endpoints

## Example Requests

**Register:**
```
POST /auth/register
{
  "role": "user",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "123456",
  "phone": "1234567890",
  "location": "City"
}
```

**Login:**
```
POST /auth/login
{
  "email": "john@example.com",
  "password": "123456"
}
```

**Add Product:**
```
POST /products
Authorization: Bearer <token>
{
  "name": "Brake Pad",
  "brand": "BrandX",
  "price": 100,
  "stock": 50,
  "inStock": true
}
```

## License
MIT
