# Saree Ecommerce Backend

Serverless backend using Node.js, Express, MongoDB Atlas, Mongoose, JWT auth, and AWS Lambda via `serverless-http`.

## Setup

```bash
npm install
cp .env.example .env
```

Update `.env` with your MongoDB Atlas URI and JWT secret.

## Run Locally

```bash
npm start
```

Local API:

```txt
http://localhost:4000
```

## Create First Admin

Update these in `.env`:

```txt
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=password123
```

Then run:

```bash
npm run seed:admin
```

## Deploy to AWS Lambda

```bash
npm run deploy
```

## API Endpoints

### Login

```http
POST /api/auth/login
```

Body:

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

### Add Product

```http
POST /api/products
Authorization: Bearer <token>
```

Body:

```json
{
  "name": "Tussar Silk Saree",
  "description": "Premium handloom saree",
  "price": 7999,
  "stock": 10
}
```

### Update Product

```http
PUT /api/products/:id
Authorization: Bearer <token>
```

### Delete Product

```http
DELETE /api/products/:id
Authorization: Bearer <token>
```

### Create Order

```http
POST /api/orders
Authorization: Bearer <token>
```

Body:

```json
{
  "products": [
    {
      "productId": "MONGO_PRODUCT_ID",
      "quantity": 2
    }
  ]
}
```
# pratibhasilks_be
